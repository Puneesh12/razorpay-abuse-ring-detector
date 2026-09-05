"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useMetrics } from "@/hooks/use-api";
import { useCountUp } from "@/hooks/use-count-up";
import { formatPct } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroMockup } from "@/components/landing/hero-mockup";
import { KeywordUnderline } from "@/components/landing/keyword-underline";
import { DecisionLoop } from "@/components/landing/decision-loop";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const STAGES = [
  {
    eyebrow: "Connect entities",
    headline: "Link accounts by what they actually share.",
    body: "Accounts sharing a device, IP, payout instrument, or address are linked into a graph — a fact, not a guess.",
  },
  {
    eyebrow: "Detect coordinated behaviour",
    headline: "Score whether that link looks coordinated.",
    body: "A model trained on signup timing, refund behaviour, and reuse patterns scores whether a linked group looks coordinated.",
  },
  {
    eyebrow: "Build evidence",
    headline: "Name the evidence, not just a number.",
    body: "Every flagged cluster gets a case file naming the specific accounts, the specific shared signal, and the reasoning.",
  },
  {
    eyebrow: "Prioritize human review",
    headline: "Queue it for a person. Never act alone.",
    body: "Ring never bans, freezes, or blocks. It only ever queues a case — no_action, queue_for_review, or priority_review.",
  },
];

function StatValue({ loading, value }: { loading: boolean; value: string }) {
  if (loading) return <Skeleton className="h-8 w-20" />;
  return <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>;
}

export default function LandingPage() {
  const { data: metrics, loading } = useMetrics();
  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  // All four stats are scoped to the same held-out test evaluation, so they
  // read consistently together instead of mixing dataset-wide and test-split
  // numbers next to each other.
  const accounts = metrics?.detector_metrics.held_out_test.n_accounts_in_clusters ?? null;
  const clusters = metrics?.detector_metrics.held_out_test.n_clusters ?? null;
  const precision = metrics?.detector_metrics.held_out_test.cluster_precision ?? null;
  const recall = metrics?.detector_metrics.held_out_test.cluster_recall ?? null;

  const accountsCount = useCountUp(accounts);
  const clustersCount = useCountUp(clusters);
  const precisionCount = useCountUp(precision);
  const recallCount = useCountUp(recall);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const heroItems = heroRef.current?.querySelectorAll("[data-reveal]");
      if (heroItems?.length) {
        gsap.fromTo(
          heroItems,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.55, ease: "power2.out", stagger: 0.08 }
        );
      }
    });
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (loading || !statsRef.current) return;
    gsap.fromTo(
      statsRef.current.children,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", stagger: 0.06 }
    );
  }, [loading]);

  return (
    <div className="flex-1">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section id="problem" className="scroll-mt-20 relative border-b border-border overflow-hidden min-h-[720px] flex items-center">
        <Image
          src="/assets/hero-photo.png"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* The source photo has its own headline/CTA copy baked into it
            (it's a flattened screenshot, not a layered file) roughly up to
            the horizontal midpoint -- a single, precisely-stopped linear
            gradient covers that fully, then fades quickly so the shop
            interior on the right stays clearly visible, matching the
            reference. (Deliberately not `filter: blur()`: that on a sibling
            of the GSAP-transformed hero text triggered a real Chromium/
            WebKit compositing bug that double-painted the text.) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, var(--background) 0%, var(--background) 50%, color-mix(in oklch, var(--background) 35%, transparent) 60%, transparent 72%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-transparent" aria-hidden />
        <div ref={heroRef} className="relative mx-auto w-full max-w-[1440px] px-6 py-20 md:py-28">
          <div>
            <div className="max-w-2xl">
              <div data-reveal className="text-[11px] font-semibold tracking-widest text-brand uppercase mb-5">
                A safer payments ecosystem
              </div>
              <h1 data-reveal className="font-sans text-[2.75rem] md:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
                <span className="bg-gradient-to-br from-brand to-sky-300 bg-clip-text text-transparent">Ring —</span>
                <br />
                your fraud watch buddy.
              </h1>
              <p data-reveal className="mt-5 text-[15px] leading-relaxed text-muted-foreground max-w-xl">
                Detect cross-account abuse rings for Razorpay. Not auto-blocks — just clear,
                evidence-backed cases for human review.
              </p>
              <div data-reveal className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/investigate"
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-[13.5px] font-semibold text-brand-foreground shadow-[0_8px_30px_-8px_oklch(0.62_0.19_255_/_55%)] transition-all duration-150 hover:opacity-90 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_-6px_oklch(0.62_0.19_255_/_65%)] active:translate-y-0 active:scale-[0.98]"
                >
                  See Ring in action
                  <ArrowRight className="size-4" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-[13.5px] font-medium text-foreground transition-all duration-150 hover:bg-secondary hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                >
                  How it works
                </a>
              </div>
            </div>
          </div>

          <div data-reveal className="mt-16 flex items-center gap-2">
            <span className="h-3.5 w-px bg-brand" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Built for a trusted India
            </span>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-[1440px] px-6 py-16">
          <p className="text-[11px] font-semibold tracking-widest text-brand uppercase mb-6">See it live</p>
          <div className="grid lg:grid-cols-[1fr_460px] gap-12 items-start">
            <div>
              {/* Real metrics only — nothing invented */}
              <div ref={statsRef} className="grid grid-cols-2 gap-px bg-border rounded-lg overflow-hidden border border-border max-w-lg">
                <div className="bg-surface-raised px-5 py-4">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1.5">Accounts (held-out test)</div>
                  <StatValue loading={loading} value={accounts != null ? Math.round(accountsCount).toLocaleString("en-IN") : "—"} />
                </div>
                <div className="bg-surface-raised px-5 py-4">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1.5">Clusters (held-out test)</div>
                  <StatValue loading={loading} value={clusters != null ? Math.round(clustersCount).toLocaleString("en-IN") : "—"} />
                </div>
                <div className="bg-surface-raised px-5 py-4">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1.5">Held-out precision</div>
                  <StatValue loading={loading} value={precision != null ? formatPct(precisionCount) : "—"} />
                </div>
                <div className="bg-surface-raised px-5 py-4">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1.5">Held-out recall</div>
                  <StatValue loading={loading} value={recall != null ? formatPct(recallCount) : "—"} />
                </div>
              </div>
              {!loading && !metrics && (
                <p className="mt-3 text-xs text-muted-foreground">
                  No evaluation run yet — run <code className="bg-muted px-1.5 py-0.5 rounded">python -m app.core.evaluation</code> in the backend.
                </p>
              )}
            </div>
            <HeroMockup />
          </div>
        </div>
      </section>

      <KeywordUnderline />

      <DecisionLoop
        steps={STAGES.map((s, i) => ({
          ...s,
          // Real numbers from the same held-out evaluation as the hero
          // stats -- no fabricated per-step metrics.
          fact: [
            accounts != null ? `${accounts.toLocaleString("en-IN")} accounts analyzed` : null,
            precision != null ? `${formatPct(precision)} held-out precision` : null,
            clusters != null ? `${clusters.toLocaleString("en-IN")} clusters scored` : null,
            "3 allowed actions — never a ban",
          ][i] ?? "",
        }))}
      />

      {/* ── Safety statement ─────────────────────────────────────────── */}
      <section id="trust" className="scroll-mt-20">
        <div className="mx-auto max-w-[1440px] px-6 py-12">
          <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground max-w-2xl">
            <ShieldCheck className="size-4 shrink-0 text-brand mt-0.5" />
            <span>
              <span className="font-semibold text-foreground">Strictly defense-only.</span> Ring cannot ban, freeze,
              suspend, or take a financial action. Every output is one of three review-queue states — a human always
              decides. This is an independent build for the Razorpay AI Buildathon, Track 2 — not an official
              Razorpay product.
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}
