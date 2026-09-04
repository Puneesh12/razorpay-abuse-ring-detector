"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { bidirectional } from "graphology-shortest-path";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Search, Route, X } from "lucide-react";
import { buildEntityGraph, ACTION_COLOR, ENTITY_COLOR, ENTITY_LABEL, attributeLabel, type EntityType } from "@/lib/entity-graph";
import type { GraphAccountNode } from "@/types/api";
import { GraphLegend } from "./graph-legend";

interface RingGraphProps {
  accounts: GraphAccountNode[];
  selectedId: string | null;
  onSelectAccount: (id: string | null) => void;
  className?: string;
}

const ENTITY_TYPES: EntityType[] = ["device", "ip", "payment", "address"];

export function RingGraph({ accounts, selectedId, onSelectAccount, className }: RingGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hiddenTypes, setHiddenTypes] = useState<Set<EntityType>>(new Set());
  const [hiddenRisk, setHiddenRisk] = useState<Set<string>>(new Set());
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [hideLowSignal, setHideLowSignal] = useState(false);
  const [tracePath, setTracePath] = useState<{ nodes: string[]; edges: string[]; steps: string[] } | null>(null);

  const entityGraph = useMemo(() => buildEntityGraph(accounts), [accounts]);

  // ── Build the graphology graph once per dataset ──────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph();
    for (const n of entityGraph.nodes) {
      const isAccount = n.type === "account";
      graph.addNode(n.id, {
        x: Math.random(),
        y: Math.random(),
        size: isAccount ? 7 + Math.min(n.degree, 4) : 4 + Math.min(n.degree, 3),
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

    forceAtlas2.assign(graph, { iterations: 120, settings: { gravity: 1, scalingRatio: 12, strongGravityMode: true } });

    graphRef.current = graph;
    const sigma = new Sigma(graph, containerRef.current, {
      renderLabels: true,
      labelRenderedSizeThreshold: 8,
      labelColor: { color: "#a1a1aa" },
      defaultEdgeColor: "rgba(255,255,255,0.12)",
      minCameraRatio: 0.08,
      maxCameraRatio: 3,
    });
    sigmaRef.current = sigma;

    sigma.on("clickNode", ({ node }) => {
      const attrs = graph.getNodeAttributes(node);
      if (attrs.entityType === "account") onSelectAccount(node);
    });
    sigma.on("clickStage", () => onSelectAccount(null));
    sigma.on("enterNode", ({ node }) => setHoveredId(node));
    sigma.on("leaveNode", () => setHoveredId(null));

    return () => {
      sigma.kill();
      sigmaRef.current = null;
      graphRef.current = null;
    };
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
        if (!traceNodes.has(node)) return { ...res, color: "#2a2a2e", label: "" };
        return { ...res, zIndex: 2, size: (res.size ?? 6) + 2, label: res.label };
      }
      if (searchLower && !node.toLowerCase().includes(searchLower) && !String(data.label ?? "").toLowerCase().includes(searchLower)) {
        return { ...res, color: "#242428", label: "" };
      }
      if (neighborhood) {
        if (!neighborhood.has(node)) return { ...res, color: "#2a2a2e", label: node === focusId ? res.label : "" };
        return { ...res, zIndex: 1 };
      }
      return res;
    });

    sigma.setSetting("edgeReducer", (edge, data) => {
      const res = { ...data };
      const [s, t] = graph.extremities(edge);
      if (traceEdges) {
        if (!traceEdges.has(edge)) return { ...res, hidden: true };
        return { ...res, color: "#FDE047", size: 2.5, zIndex: 2 };
      }
      if (neighborhood && !(neighborhood.has(s) && neighborhood.has(t))) {
        return { ...res, hidden: true };
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
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }, []);

  const toggleRisk = useCallback((r: string) => {
    setHiddenRisk((prev) => {
      const next = new Set(prev);
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });
  }, []);

  const zoomIn = useCallback(() => sigmaRef.current?.getCamera().animatedZoom({ duration: 200 }), []);
  const zoomOut = useCallback(() => sigmaRef.current?.getCamera().animatedUnzoom({ duration: 200 }), []);
  const fit = useCallback(() => sigmaRef.current?.getCamera().animatedReset({ duration: 250 }), []);

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
    setTracePath({ nodes, edges, steps: steps.filter(Boolean) });
  }, [selectedId]);

  const clearTrace = useCallback(() => setTracePath(null), []);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
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

      {tracePath && (
        <div className="mb-3 rounded-md border border-brand/30 bg-brand/5 px-3 py-2 text-[12px] text-foreground">
          <span className="font-medium">Evidence path</span> ({tracePath.nodes.filter((n) => graphRef.current?.getNodeAttribute(n, "entityType") === "account").length} accounts,{" "}
          {tracePath.edges.length} hop{tracePath.edges.length === 1 ? "" : "s"}): {tracePath.steps.join(" → ")}
        </div>
      )}

      <div className="relative rounded-lg border border-border bg-black overflow-hidden" style={{ height: 480 }}>
        <div ref={containerRef} className="absolute inset-0" />
        {accounts.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-muted-foreground">
            Run analysis to load the graph.
          </div>
        )}
      </div>

      <GraphLegend />
    </div>
  );
}
