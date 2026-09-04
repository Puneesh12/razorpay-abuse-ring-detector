"use client";

import Link from "next/link";
import { ArrowRight, Network, ScanSearch, FileSearch, UserCheck } from "lucide-react";
import { useMetrics } from "@/hooks/use-api";
import { formatPct } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

const STAGES = [
  { icon: Network, title: "Connect entities", body: "Accounts sharing a device, IP, payout instrument, or address are linked into a graph — a fact, not a guess." },
  { icon: ScanSearch, title: "Detect coordinated behaviour", body: "A model trained on signup timing, refund behaviour, and reuse patterns scores whether a linked group looks coordinated." },
  { icon: FileSearch, title: "Build evidence", body: "Every flagged cluster gets a case file naming the specific accounts, the specific shared signal, and the reasoning — not just a number." },
  { icon: UserCheck, title: "Prioritize human review", body: "Ring never bans, freezes, or blocks. It only ever queues a case — no_action, queue_for_review, or priority_review — for a person to decide." },
];

function StatValue({ loading, value }: { loading: boolean; value: string }) {
  if (loading) return <Skeleton className="h-8 w-20" />;
  return <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>;
}

export default function LandingPage() {
  const { data: metrics, loading } = useMetrics();

  const accounts = metrics
    ? metrics.policy_run_test_split.n_accounts_correctly_flagged + metrics.policy_run_test_split.n_accounts_wrongly_flagged
    : null;
  const clusters = metrics?.dataset.n_clusters_found ?? null;
  const precision = metrics?.detector_metrics.held_out_test.cluster_precision ?? null;
  const recall = metrics?.detector_metrics.held_out_test.cluster_recall ?? null;

  return (
    <div className="flex-1">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1440px] px-6 py-20 md:py-28">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold tracking-widest text-brand uppercase mb-5">
              Razorpay AI Buildathon · Track 2 · AI Risk Manager
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-[1.08]">
              Find the network behind the risk.
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground max-w-xl">
              Ring detects coordinated account abuse across shared devices, identities and payment
              signals — then gives analysts the evidence to review it. It never blocks anyone; a
              human always makes the call.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/investigate"
                className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-brand-foreground transition-opacity hover:opacity-90"
              >
                Open investigation
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/evaluation"
                className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-[13.5px] font-medium text-foreground transition-colors hover:bg-secondary"
              >
                View evaluation
              </Link>
            </div>
          </div>

          {/* Real metrics only — nothing invented */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border border-border max-w-3xl">
            <div className="bg-surface-raised px-5 py-4">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1.5">Accounts analyzed</div>
              <StatValue loading={loading} value={accounts != null ? accounts.toLocaleString("en-IN") : "—"} />
            </div>
            <div className="bg-surface-raised px-5 py-4">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1.5">Clusters found</div>
              <StatValue loading={loading} value={clusters != null ? clusters.toLocaleString("en-IN") : "—"} />
            </div>
            <div className="bg-surface-raised px-5 py-4">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1.5">Held-out precision</div>
              <StatValue loading={loading} value={formatPct(precision)} />
            </div>
            <div className="bg-surface-raised px-5 py-4">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1.5">Held-out recall</div>
              <StatValue loading={loading} value={formatPct(recall)} />
            </div>
          </div>
          {!loading && !metrics && (
            <p className="mt-3 text-xs text-muted-foreground">
              No evaluation run yet — run <code className="bg-muted px-1.5 py-0.5 rounded">python -m app.core.evaluation</code> in the backend.
            </p>
          )}
        </div>
      </section>

      {/* ── Four stages ──────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1440px] px-6 py-16">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-8">How it works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {STAGES.map((s, i) => (
              <div key={s.title}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground">
                    {i + 1}
                  </span>
                  <s.icon className="size-4 text-muted-foreground" />
                </div>
                <h3 className="text-[14px] font-semibold text-foreground mb-1.5">{s.title}</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Safety statement ─────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-[1440px] px-6 py-10">
          <p className="text-[13px] text-muted-foreground max-w-2xl">
            <span className="font-semibold text-foreground">Strictly defense-only.</span> Ring cannot ban, freeze,
            suspend, or take a financial action. Every output is one of three review-queue states — a human always
            decides. This is an independent build for the Razorpay AI Buildathon, Track 2 — not an official Razorpay
            product.
          </p>
        </div>
      </section>
    </div>
  );
}
