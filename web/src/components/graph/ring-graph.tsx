"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { bidirectional } from "graphology-shortest-path";
import gsap from "gsap";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Search, Route, X } from "lucide-react";
import { buildEntityGraph, ACTION_COLOR, ENTITY_COLOR, ENTITY_LABEL, attributeLabel, type EntityType } from "@/lib/entity-graph";
import type { GraphAccountNode } from "@/types/api";
import { GraphLegend } from "./graph-legend";

interface RingGraphProps {
  accounts: GraphAccountNode[];
  selectedId: string | null;
  onSelectAccount: (id: string | null) => void;
  className?: string;
  /** Bare canvas only -- no search/filter toolbar, trace banner, or legend.
   *  For a real (not fabricated) preview of the graph outside the full
   *  investigation workspace, e.g. the landing page hero. */
  minimal?: boolean;
  /** Canvas height in px. Defaults to 480 (the full workspace view). */
  height?: number;
  /** Initial camera zoom. Lower = more zoomed in. Defaults to 0.5, tuned
   *  for the full 480px workspace canvas -- a shorter canvas (e.g. a
   *  decorative preview) needs a higher value or the same cluster count
   *  crowds the smaller area. */
  initialRatio?: number;
}

const ENTITY_TYPES: EntityType[] = ["device", "ip", "payment", "address"];

export function RingGraph({ accounts, selectedId, onSelectAccount, className, minimal = false, height = 480, initialRatio = 0.5 }: RingGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const graphBoxRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hiddenTypes, setHiddenTypes] = useState<Set<EntityType>>(new Set());
  const [hiddenRisk, setHiddenRisk] = useState<Set<string>>(new Set());
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [hideLowSignal, setHideLowSignal] = useState(false);
  const [tracePath, setTracePath] = useState<{ nodes: string[]; edges: string[]; steps: string[]; accountCount: number } | null>(null);

  const entityGraph = useMemo(() => buildEntityGraph(accounts), [accounts]);

  useEffect(() => {
    if (toolbarRef.current) {
      gsap.fromTo(
        toolbarRef.current.children,
        { opacity: 0, y: -6 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", stagger: 0.03 }
      );
    }
  }, []);

  useEffect(() => {
    if (accounts.length > 0 && graphBoxRef.current) {
      gsap.fromTo(graphBoxRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.out" });
    }
  }, [accounts.length]);

  // ── Build the graphology graph once per dataset ──────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Sigma throws ("Container has no width") if it initializes before the
    // surrounding flex/grid layout has actually given the container a real
    // size -- a real race on first paint, not a hypothetical one (reproduced
    // via a cold page load). Wait for a genuine non-zero size instead of
    // constructing Sigma unconditionally.
    let cancelled = false;
    let cleanupInner: (() => void) | null = null;

    function mount() {
      if (cancelled || !container) return;
      cleanupInner = build(container);
    }

    if (container.clientWidth > 0 && container.clientHeight > 0) {
      mount();
    }
    const observer = new ResizeObserver((entries) => {
      if (cleanupInner) return; // already mounted
      const box = entries[0]?.contentRect;
      if (box && box.width > 0 && box.height > 0) mount();
    });
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
      cleanupInner?.();
    };

    function build(containerEl: HTMLDivElement) {
    // Undirected by construction: a shared attribute has no direction, and
    // entity edges are always built as account -> entity (see
    // buildEntityGraph), so a directed traversal could never go
    // account -> entity -> account -- which silently broke "Trace evidence"
    // (bidirectional() found no path because the return leg didn't exist).
    const graph = new Graph({ type: "undirected" });
    for (const n of entityGraph.nodes) {
      const isAccount = n.type === "account";
      graph.addNode(n.id, {
        x: 0,
        y: 0,
        size: isAccount ? 5.5 + Math.min(n.degree, 3) : 3.5 + Math.min(n.degree, 2),
        // Plain risk-colored fill (red/amber/green) -- a separate blue fill
        // with a risk-colored ring around it read as confusingly close to
        // the payout-instrument entity color once nodes were small.
        color: isAccount ? ACTION_COLOR[n.account!.action] : ENTITY_COLOR[n.type as Exclude<EntityType, "account">],
        label: isAccount ? n.id.slice(0, 8) : n.label,
        entityType: n.type,
        raw: n,
      });
    }
    for (const e of entityGraph.edges) {
      if (!graph.hasEdge(e.source, e.target)) {
        graph.addEdge(e.source, e.target, { relation: e.relation, size: 1 });
      }
    }

    // Most clusters share nothing with any other cluster -- the graph is a
    // disjoint union of many small components. Running forceAtlas2 straight
    // off random positions makes every component repel every other equally,
    // which (with nothing to break the symmetry) settles into a hollow ring
    // instead of scattered groups. Fix: find each connected component first,
    // place its center on a golden-angle spiral (evenly spread, no overlap),
    // seed its nodes near that center, THEN run forceAtlas2 -- at that point
    // it only has to relax each component locally, not fight a global
    // symmetry problem.
    const visited = new Set<string>();
    const components: string[][] = [];
    graph.forEachNode((id) => {
      if (visited.has(id)) return;
      const stack = [id];
      const comp: string[] = [];
      visited.add(id);
      while (stack.length) {
        const cur = stack.pop()!;
        comp.push(cur);
        graph.forEachNeighbor(cur, (nb) => {
          if (!visited.has(nb)) {
            visited.add(nb);
            stack.push(nb);
          }
        });
      }
      components.push(comp);
    });

    const golden = Math.PI * (3 - Math.sqrt(5));
    const spread = 170 * Math.sqrt(components.length || 1);
    components.forEach((comp, i) => {
      const r = spread * Math.sqrt((i + 0.5) / components.length);
      const theta = i * golden;
      const cx = r * Math.cos(theta);
      const cy = r * Math.sin(theta);
      for (const id of comp) {
        graph.setNodeAttribute(id, "x", cx + (Math.random() - 0.5) * 12);
        graph.setNodeAttribute(id, "y", cy + (Math.random() - 0.5) * 12);
      }
    });

    // Stronger repulsion (scalingRatio) and more iterations than the default
    // so accounts inside a cluster fan out instead of packing into one
    // overlapping blob -- the previous settings left dense clusters looking
    // like a single smear at the default zoom level.
    forceAtlas2.assign(graph, {
      iterations: 220,
      settings: {
        // Gravity pulls toward the GLOBAL origin, not each component's own
        // spiral position -- keep it small (as before) or every component
        // gets dragged back toward the center and the spiral placement is
        // undone. Only the repulsion (scalingRatio) needed to go up.
        gravity: 0.02,
        scalingRatio: 35,
        strongGravityMode: false,
        adjustSizes: true,
        outboundAttractionDistribution: true,
        barnesHutOptimize: graph.order > 200,
        slowDown: 6,
      },
    });

    // forceAtlas2's repulsion only guarantees nodes don't hard-overlap, not
    // that they read as visually separate at a glance -- with 3-8 tightly
    // interconnected nodes it converges to a small tight knot regardless of
    // scalingRatio. Directly push each node away from its own component's
    // centroid instead of continuing to fight the physics: guaranteed, easy
    // to reason about, and doesn't touch the actual graph data.
    for (const comp of components) {
      if (comp.length < 2) continue;
      let cx = 0;
      let cy = 0;
      for (const id of comp) {
        cx += graph.getNodeAttribute(id, "x");
        cy += graph.getNodeAttribute(id, "y");
      }
      cx /= comp.length;
      cy /= comp.length;
      const factor = 1.6 + Math.min(comp.length / 6, 1.4);
      for (const id of comp) {
        const x = graph.getNodeAttribute(id, "x");
        const y = graph.getNodeAttribute(id, "y");
        graph.setNodeAttribute(id, "x", cx + (x - cx) * factor);
        graph.setNodeAttribute(id, "y", cy + (y - cy) * factor);
      }
    }

    // Pop nodes in from zero size instead of having the whole cluster snap
    // into view at once -- one tween drives every node's size so it's a
    // single rAF loop, not hundreds of independent tweens.
    const targetSizes = new Map<string, number>();
    graph.forEachNode((id, attrs) => {
      targetSizes.set(id, attrs.size as number);
      graph.setNodeAttribute(id, "size", 0);
    });
    const pop = { p: 0 };
    const popTween = gsap.to(pop, {
      p: 1,
      duration: 0.6,
      delay: 0.1,
      ease: "back.out(1.7)",
      onUpdate: () => {
        graph.forEachNode((id) => {
          graph.setNodeAttribute(id, "size", (targetSizes.get(id) ?? 0) * pop.p);
        });
        sigma?.refresh();
      },
    });

    graphRef.current = graph;
    const sigma = new Sigma(graph, containerEl, {
      renderLabels: true,
      // High by default so the overview stays readable -- individual
      // account IDs aren't meaningful at a glance across hundreds of nodes.
      // forceLabel in the reducer below still shows a label for whatever
      // the analyst is actually looking at (hover/selection/search/trace).
      labelRenderedSizeThreshold: 30,
      labelColor: { color: "#52525b" },
      labelFont: "system-ui, sans-serif",
      defaultEdgeColor: "rgba(24,24,27,0.35)",
      minCameraRatio: 0.08,
      maxCameraRatio: 3,
    });
    sigmaRef.current = sigma;

    // Sigma's default camera fits the ENTIRE bounding box (ratio 1) -- with
    // ~40-90 spread-out clusters that shrinks every one of them to a few
    // px, right back to looking like an unreadable blob. Start already
    // zoomed to the level that actually reads as separated clusters (close
    // to the min zoom floor below, since that's what "legible" turned out
    // to require once clusters were spread apart).
    sigma.getCamera().setState({ ratio: initialRatio });

    sigma.on("clickNode", ({ node }) => {
      const attrs = graph.getNodeAttributes(node);
      if (attrs.entityType === "account") onSelectAccount(node);
    });
    sigma.on("clickStage", () => onSelectAccount(null));
    sigma.on("enterNode", ({ node }) => setHoveredId(node));
    sigma.on("leaveNode", () => setHoveredId(null));

    return () => {
      popTween.kill();
      sigma.kill();
      sigmaRef.current = null;
      graphRef.current = null;
    };
    } // end build()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityGraph]);

  // ── Reducers: highlight selection/hover/search/filters without touching
  //    graph data or re-rendering React on every interaction. ────────────
  useEffect(() => {
    const sigma = sigmaRef.current;
    const graph = graphRef.current;
    if (!sigma || !graph) return;

    const focusId = selectedId ?? hoveredId;
    const neighborhood = focusId && graph.hasNode(focusId) ? new Set([focusId, ...graph.neighbors(focusId)]) : null;
    const searchLower = search.trim().toLowerCase();
    const traceNodes = tracePath ? new Set(tracePath.nodes) : null;
    const traceEdges = tracePath ? new Set(tracePath.edges) : null;

    sigma.setSetting("nodeReducer", (node, data) => {
      const res = { ...data };
      const entityType = data.entityType as EntityType;
      const isAccount = entityType === "account";
      const action = isAccount ? (data.raw.account.action as string) : null;

      if (hiddenTypes.has(entityType) || (isAccount && action && hiddenRisk.has(action))) {
        return { ...res, hidden: true };
      }
      if (hideLowSignal && !isAccount && data.raw.degree < 3) {
        return { ...res, hidden: true };
      }
      if (traceNodes) {
        if (!traceNodes.has(node)) return { ...res, color: "#e4e4e7", label: "" };
        return { ...res, zIndex: 2, size: (res.size ?? 6) + 2, label: res.label, forceLabel: true };
      }
      if (searchLower && !node.toLowerCase().includes(searchLower) && !String(data.label ?? "").toLowerCase().includes(searchLower)) {
        return { ...res, color: "#ececef", label: "" };
      }
      if (searchLower) {
        return { ...res, forceLabel: true };
      }
      if (neighborhood) {
        if (!neighborhood.has(node)) return { ...res, color: "#e4e4e7", label: node === focusId ? res.label : "" };
        return { ...res, zIndex: 1, forceLabel: node === focusId };
      }
      return res;
    });

    sigma.setSetting("edgeReducer", (edge, data) => {
      const res = { ...data };
      const [s, t] = graph.extremities(edge);
      if (traceEdges) {
        if (!traceEdges.has(edge)) return { ...res, hidden: true };
        return { ...res, color: "#4338ca", size: 2.5, zIndex: 2 };
      }
      if (neighborhood) {
        if (!(neighborhood.has(s) && neighborhood.has(t))) return { ...res, hidden: true };
        return { ...res, color: "rgba(24,24,27,0.4)", zIndex: 1 };
      }
      if (showEdgeLabels) {
        return { ...res, label: attributeLabel(data.relation) };
      }
      return res;
    });

    sigma.refresh();
  }, [selectedId, hoveredId, search, hiddenTypes, hiddenRisk, showEdgeLabels, hideLowSignal, tracePath]);

  // ── Center camera on selection ────────────────────────────────────────
  useEffect(() => {
    const sigma = sigmaRef.current;
    const graph = graphRef.current;
    if (!sigma || !graph || !selectedId || !graph.hasNode(selectedId)) return;
    const pos = sigma.getNodeDisplayData(selectedId);
    if (pos) sigma.getCamera().animate({ x: pos.x, y: pos.y, ratio: 0.35 }, { duration: 400 });
  }, [selectedId]);

  const toggleType = useCallback((t: EntityType) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const toggleRisk = useCallback((r: string) => {
    setHiddenRisk((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }, []);

  const zoomIn = useCallback(() => sigmaRef.current?.getCamera().animatedZoom({ duration: 200 }), []);
  const zoomOut = useCallback(() => sigmaRef.current?.getCamera().animatedUnzoom({ duration: 200 }), []);
  // Not a true animatedReset (ratio 1) -- that shows the whole spread-out
  // layout at once, back to illegibly tiny clusters. Match the same
  // comfortable ratio the view opens at.
  const fit = useCallback(() => sigmaRef.current?.getCamera().animate({ x: 0.5, y: 0.5, ratio: 0.5 }, { duration: 250 }), []);

  const traceEvidence = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || !selectedId) return;
    // Find the nearest other account by real hop count (BFS shortest path) —
    // this is genuine graph traversal, not a fabricated relationship.
    let best: { id: string; path: string[] } | null = null;
    graph.forEachNode((node, attrs) => {
      if (attrs.entityType !== "account" || node === selectedId) return;
      const path = bidirectional(graph, selectedId, node);
      if (path && (!best || path.length < best.path.length)) best = { id: node, path };
    });
    if (!best) return;
    const path: string[] = (best as { id: string; path: string[] }).path;
    const nodes = path;
    const edges: string[] = [];
    const steps: string[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const edgeKey = graph.edge(path[i], path[i + 1]);
      if (edgeKey) {
        edges.push(edgeKey);
        const relation = graph.getEdgeAttribute(edgeKey, "relation");
        const isEntityStep = graph.getNodeAttribute(path[i + 1], "entityType") !== "account";
        steps.push(isEntityStep ? `shared ${attributeLabel(relation)}` : "");
      }
    }
    const accountCount = nodes.filter((n) => graph.getNodeAttribute(n, "entityType") === "account").length;
    setTracePath({ nodes, edges, steps: steps.filter(Boolean), accountCount });
  }, [selectedId]);

  const clearTrace = useCallback(() => setTracePath(null), []);

  return (
    <div className={className}>
      {!minimal && (
      <div
        ref={toolbarRef}
        className="flex flex-wrap items-center gap-2 mb-3 rounded-lg border border-border bg-surface-raised/50 p-2"
      >
        <div className="relative flex-1 min-w-[160px] max-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entity…"
            className="w-full rounded-md border border-border bg-muted/40 py-1.5 pl-8 pr-2.5 text-[12.5px] text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex items-center gap-1 border-l border-border pl-2 ml-1">
          {ENTITY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                hiddenTypes.has(t) ? "text-muted-foreground/50 line-through" : "text-foreground bg-secondary"
              }`}
            >
              {ENTITY_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border-l border-border pl-2 ml-1">
          {(["priority_review", "queue_for_review", "no_action"] as const).map((r) => (
            <button
              key={r}
              onClick={() => toggleRisk(r)}
              className={`size-4 rounded-full border border-white/20 transition-opacity ${hiddenRisk.has(r) ? "opacity-25" : ""}`}
              style={{ backgroundColor: ACTION_COLOR[r] }}
              title={r}
            />
          ))}
        </div>

        <div className="flex items-center gap-1 border-l border-border pl-2 ml-1">
          <button
            onClick={() => setShowEdgeLabels((v) => !v)}
            className={`rounded px-2 py-1 text-[11px] font-medium ${showEdgeLabels ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
          >
            Edge labels
          </button>
          <button
            onClick={() => setHideLowSignal((v) => !v)}
            className={`rounded px-2 py-1 text-[11px] font-medium ${hideLowSignal ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
          >
            Hide low-signal
          </button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {selectedId && (
            <button
              onClick={tracePath ? clearTrace : traceEvidence}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                tracePath ? "bg-brand text-brand-foreground" : "border border-border text-foreground hover:bg-secondary"
              }`}
            >
              {tracePath ? <X className="size-3.5" /> : <Route className="size-3.5" />}
              {tracePath ? "Clear trace" : "Trace evidence"}
            </button>
          )}
          <button onClick={zoomIn} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary" title="Zoom in">
            <ZoomIn className="size-3.5" />
          </button>
          <button onClick={zoomOut} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary" title="Zoom out">
            <ZoomOut className="size-3.5" />
          </button>
          <button onClick={fit} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary" title="Fit graph">
            <Maximize2 className="size-3.5" />
          </button>
          <button onClick={() => { setHiddenTypes(new Set()); setHiddenRisk(new Set()); setSearch(""); clearTrace(); fit(); }} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary" title="Reset view">
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>
      )}

      {!minimal && tracePath && (
        <div className="mb-3 rounded-md border border-brand/30 bg-brand/5 px-3 py-2 text-[12px] text-foreground">
          <span className="font-medium">Evidence path</span> ({tracePath.accountCount} accounts,{" "}
          {tracePath.edges.length} hop{tracePath.edges.length === 1 ? "" : "s"}): {tracePath.steps.join(" → ")}
        </div>
      )}

      <div
        ref={graphBoxRef}
        className="relative rounded-lg border border-border overflow-hidden"
        style={{
          height,
          backgroundColor: "#fafafa",
          backgroundImage: "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div ref={containerRef} className="absolute inset-0" />
        {accounts.length === 0 && !minimal && (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-neutral-400">
            Run analysis to load the graph.
          </div>
        )}
      </div>

      {!minimal && <GraphLegend />}
    </div>
  );
}
