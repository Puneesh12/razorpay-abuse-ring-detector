"use client";

import { useState } from "react";
import { Sparkles, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import type { AskResponse } from "@/types/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

const SUGGESTIONS = [
  "Has this device shown up in any other cluster?",
  "Why wasn't the closest legitimate cluster flagged?",
  "Which feature drove this score the most?",
];

// Read-only by construction: this component only ever calls
// api.askCluster, which hits POST /api/cluster/{id}/ask -- an endpoint whose
// backing tool schema (backend/app/core/investigate.py::TOOL_SCHEMAS) has no
// action-capable tool for the model to call. There is nothing here for a
// reviewer to accidentally trigger; it can only explain, never act.
export function InvestigationAssistant({ clusterId }: { clusterId: string }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.askCluster(clusterId, trimmed);
      setResult(res);
    } catch (err) {
      setResult({
        available: false,
        reason: err instanceof Error ? err.message : "Could not reach the investigation assistant.",
        tools_available: [],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section data-reveal>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
        Ask the investigation assistant
      </h2>
      <div className="rounded-lg border border-border bg-surface-raised/50 p-4">
        <p className="text-[12px] text-muted-foreground mb-3">
          Read-only. It can look up evidence for you — it cannot flag, queue, or change anything.
        </p>
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(question)}
            placeholder="e.g. has this device shown up anywhere else?"
            className="text-[13px]"
          />
          <Button size="default" disabled={loading} onClick={() => ask(question)}>
            {loading ? "…" : "Ask"}
          </Button>
        </div>

        {!result && !loading && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQuestion(s);
                  ask(s);
                }}
                className="text-[11.5px] text-muted-foreground border border-border rounded-full px-2.5 py-1 hover:text-foreground hover:border-ring transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {result && result.available === false && (
          <p className="text-[12.5px] text-muted-foreground mt-3">{result.reason}</p>
        )}

        {result && result.available === true && (
          <div className="mt-4 space-y-3">
            {result.tool_trace.length > 0 && (
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                  <Wrench className="size-3" /> {result.tool_trace.length} tool call
                  {result.tool_trace.length === 1 ? "" : "s"} — show evidence trail
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ol className="mt-2 space-y-1.5">
                    {result.tool_trace.map((t, i) => (
                      <li key={i} className="font-mono text-[11px] text-muted-foreground">
                        → {t.tool}({JSON.stringify(t.input)})
                      </li>
                    ))}
                  </ol>
                </CollapsibleContent>
              </Collapsible>
            )}
            <div className="flex gap-2.5">
              <Sparkles className="size-4 shrink-0 text-brand mt-0.5" />
              <div>
                <p className="text-[13.5px] leading-relaxed text-foreground/90">{result.answer}</p>
                <p className="text-[10.5px] text-muted-foreground mt-1.5">via {result.provider}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
