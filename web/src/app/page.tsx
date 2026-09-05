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
      {/* -mt-20 pulls the photo up underneath the transparent landing nav
          (which stays a normal sticky/in-flow element, not position:absolute
          -- that broke the logo layout the last time this was tried) so the
          header reads as floating over one continuous image instead of a
          separate solid bar stacked on top of it. */}
      <section id="problem" className="scroll-mt-20 relative -mt-20 border-b border-border overflow-hidden min-h-[760px] flex flex-col justify-end">
        <Image
          src="/assets/hero-skyline.png"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover object-center animate-ken-burns"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, transparent 20%, color-mix(in oklch, var(--background) 18%, transparent) 42%, color-mix(in oklch, var(--background) 62%, transparent) 62%, color-mix(in oklch, var(--background) 88%, transparent) 80%, color-mix(in oklch, var(--background) 95%, transparent) 100%)",
          }}
          aria-hidden
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-48"
          style={{ background: "linear-gradient(to top, color-mix(in oklch, var(--background) 90%, transparent) 0%, transparent 100%)" }}
          aria-hidden
        />

        <div ref={heroRef} className="relative mx-auto w-full max-w-[1440px] px-6 pb-20 md:pb-28 pt-40">
          <div className="ml-auto w-full md:w-[52%] lg:w-[42%]">
            <div data-reveal className="flex items-center gap-2.5 mb-6">
              <span className="h-px w-4 bg-brand inline-block" />
              <span className="text-brand text-[11px] font-semibold tracking-[0.16em] uppercase">AI Risk Intelligence</span>
            </div>

            <h1
              data-reveal
              className="text-foreground leading-[1.06] mb-5 font-medium"
              style={{ fontFamily: "var(--font-hero-serif)", fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)", letterSpacing: "-0.01em" }}
            >
              Stop abuse
              <br />
              <em style={{ color: "var(--amber-warm)" }}>before</em> it scales.
            </h1>

            <p data-reveal className="text-muted-foreground leading-relaxed mb-8 font-light text-[15px] md:text-[17px] max-w-[38ch]">
              Ring detects coordinated cross-account fraud across the Razorpay network — surfacing the
              evidence for a human reviewer to act on. It never blocks anyone on its own.
            </p>

            <div data-reveal className="flex flex-wrap items-center gap-4 mb-14">
              <Link
                href="/investigate"
                className="inline-flex items-center gap-2 text-brand-foreground text-sm font-medium px-6 py-3.5 rounded-full transition-all duration-300 hover:-translate-y-px"
                style={{
                  background: "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklch, var(--brand) 75%, black) 100%)",
                  boxShadow: "0 4px 24px color-mix(in oklch, var(--brand) 28%, transparent)",
                }}
              >
                See Ring in action
                <span className="cta-arrow">
                  <ArrowRight className="size-3.5" />
                </span>
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 text-foreground/75 text-sm font-medium transition-colors duration-200 hover:text-foreground"
              >
                See how it works
                <span className="cta-arrow">
                  <ArrowRight className="size-3.5" />
                </span>
              </a>
            </div>

            {/* Real metrics only — the same held-out evaluation used everywhere else on this page */}
            <div data-reveal className="flex flex-wrap gap-x-8 gap-y-4 pt-7 border-t border-border">
              <div className="flex flex-col gap-0.5">
                <span className="stat-shimmer font-semibold text-[1.15rem] tracking-tight">
                  {accounts != null ? Math.round(accountsCount).toLocaleString("en-IN") : "—"}
                </span>
                <span className="text-muted-foreground text-xs">accounts analyzed (held-out test)</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="stat-shimmer font-semibold text-[1.15rem] tracking-tight">
                  {precision != null ? formatPct(precisionCount) : "—"}
                </span>
                <span className="text-muted-foreground text-xs">held-out precision</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="stat-shimmer font-semibold text-[1.15rem] tracking-tight">
                  {recall != null ? formatPct(recallCount) : "—"}
                </span>
                <span className="text-muted-foreground text-xs">held-out recall</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between px-6 md:px-16 pb-6 animate-fade-in delay-800">
          <span className="text-muted-foreground/60 text-xs tracking-wide">
            Independent build · Razorpay AI Buildathon · Track 2 — not an official Razorpay product
          </span>
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
