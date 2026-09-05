"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Wrench, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { AskResponse } from "@/types/api";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

const SUGGESTIONS = [
  "Has this device shown up in any other cluster?",
  "Why wasn't the closest legitimate cluster flagged?",
  "Which feature drove this score the most?",
];

interface ChatMessage {
  role: "user" | "assistant";
  question?: string;
  result?: AskResponse;
}

// Defense in depth, not a substitute for the system prompt telling the
// model not to write markdown tables/headers for a narrow chat bubble
// (backend/app/core/investigate.py): a prompt instruction isn't a
// guarantee, and **bold**/"- " bullets are common enough that a plain <p>
// would show the literal asterisks. Deliberately NOT a full markdown
// renderer (no tables, no headers) -- those genuinely don't belong in an
// 85%-wide chat bubble even if parsed correctly.
function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`${keyPrefix}-${i}`} className="text-[12px] bg-neutral-100 rounded px-1 py-0.5">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

function AnswerText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const isList = lines.length > 0 && lines.every((l) => /^[-*]\s/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="list-disc pl-4 space-y-1">
              {lines.map((l, li) => (
                <li key={li} className="text-[13px] leading-relaxed text-neutral-800">
                  {renderInline(l.replace(/^[-*]\s/, ""), `${bi}-${li}`)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="text-[13px] leading-relaxed text-neutral-800">
            {renderInline(lines.join(" "), String(bi))}
          </p>
        );
      })}
    </div>
  );
}

// Read-only by construction: this component only ever calls
// api.askCluster, which hits POST /api/cluster/{id}/ask -- an endpoint whose
// backing tool schema (backend/app/core/investigate.py::TOOL_SCHEMAS) has no
// action-capable tool for the model to call. There is nothing here for a
// reviewer to accidentally trigger; it can only explain, never act.
export function InvestigationAssistant({ clusterId }: { clusterId: string }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setMessages((m) => [...m, { role: "user", question: trimmed }]);
    setQuestion("");
    setLoading(true);
    try {
      const res = await api.askCluster(clusterId, trimmed);
      setMessages((m) => [...m, { role: "assistant", result: res }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          result: {
            available: false,
            reason: err instanceof Error ? err.message : "Could not reach the investigation assistant.",
            tools_available: [],
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section data-reveal>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Ask the investigation assistant
      </h2>

      <div className="rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-100">
          <span className="flex size-8 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Sparkles className="size-4" />
          </span>
          <div>
            <div className="text-[13px] font-semibold text-neutral-900">Investigation assistant</div>
            <div className="flex items-center gap-1 text-[10.5px] text-neutral-400">
              <ShieldCheck className="size-3" /> Read-only — cannot flag, queue, or change anything
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 max-h-[420px] overflow-y-auto">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="text-[12px] text-neutral-600 border border-neutral-200 rounded-full px-3 py-1.5 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div
                  className="max-w-[80%] rounded-2xl rounded-br-sm px-3.5 py-2 text-[13px] text-white"
                  style={{ background: "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklch, var(--brand) 75%, black) 100%)" }}
                >
                  {m.question}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand mt-0.5">
                  <Sparkles className="size-3.5" />
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-neutral-50 border border-neutral-100 px-3.5 py-2.5">
                  {m.result?.available === false ? (
                    <p className="text-[13px] text-neutral-500">{m.result.reason}</p>
                  ) : (
                    <>
                      {m.result?.answer && <AnswerText text={m.result.answer} />}
                      {m.result?.tool_trace && m.result.tool_trace.length > 0 && (
                        <Collapsible defaultOpen={false} className="mt-2">
                          <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-700">
                            <Wrench className="size-3" /> {m.result.tool_trace.length} tool call
                            {m.result.tool_trace.length === 1 ? "" : "s"} — show evidence trail
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <ol className="mt-1.5 space-y-1">
                              {m.result.tool_trace.map((t, j) => (
                                <li key={j} className="font-mono text-[10.5px] text-neutral-400">
                                  → {t.tool}({JSON.stringify(t.input)})
                                </li>
                              ))}
                            </ol>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      {m.result?.available === true && (
                        <p className="text-[10.5px] text-neutral-400 mt-1.5">via {m.result.provider}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          )}

          {loading && (
            <div className="flex gap-2.5 items-center">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Sparkles className="size-3.5" />
              </span>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-neutral-50 border border-neutral-100 px-3.5 py-3.5">
                <span className="size-1.5 rounded-full bg-neutral-300 animate-bounce [animation-delay:-0.3s]" />
                <span className="size-1.5 rounded-full bg-neutral-300 animate-bounce [animation-delay:-0.15s]" />
                <span className="size-1.5 rounded-full bg-neutral-300 animate-bounce" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex items-center gap-2 border-t border-neutral-100 px-3 py-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(question)}
            placeholder="Ask about this case…"
            className="flex-1 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-brand/40 focus:bg-white transition-colors"
          />
          <button
            onClick={() => ask(question)}
            disabled={loading || !question.trim()}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40 transition-opacity"
            style={{ background: "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklch, var(--brand) 75%, black) 100%)" }}
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
