# Track Decision — Final

## Track: 2 — AI Risk Manager (abuse-ring / collusion detection)

This supersedes an earlier build on Track 3 (Revenue Recovery), which was scoped, built, tested, and evaluated end-to-end before being deliberately abandoned. That work is preserved at `~/Desktop/razorpay-revenue-recovery` for reference; nothing from it is reused here except proven engineering patterns (policy-gate architecture, held-out evaluation discipline, audit-trail design).

## Why the pivot from Track 3
Razorpay's own Agent Studio already ships a Subscription Recovery Agent, a Dispute Responder Agent, and an Abandoned Cart Conversion Agent (confirmed via `razorpay.com/agent-studio/`). Any Track 1 or Track 3 submission — however well engineered — is a better-tested version of a product Razorpay already has. That's a real, structural novelty ceiling, not a fixable framing problem.

## Why abuse-ring detection (Track 2) wins
1. **Zero shipped-product overlap.** Razorpay's Dispute Responder handles *individual* chargebacks. Nothing in their public roadmap detects *coordinated* abuse — accounts that look independent one at a time but share device fingerprints, payout destinations, or timing patterns as a group. The track's own brief names this directly: "abuse-ring sentinel."
2. **It's a genuinely different problem shape.** Track 3 was classification + optimization + policy over independent events. This is graph structure — the fraud signal only exists at the *relationship* level, not the account level. That's real technical differentiation, not a reskin.
3. **It plays to the team's proven strength**, not just a generic "AI is good at everything" claim: [[project-mitra-kirana-engine]] (Paytm hackathon, 7th/5000) was won on held-out validation rigor — randomized holdout, p-values, honest metrics — not on flashy agent orchestration. Abuse-ring detection lives or dies on precision/recall and false-positive cost, exactly the discipline already demonstrated.
4. **Strictly defense-only by construction**, satisfying the track's explicit disqualification rule: the system only ever *flags for human review* — it never auto-bans, freezes funds, or takes an irreversible action. A ring score is evidence, not a verdict.
5. **The demo is visual and inherently compelling**: a graph of accounts that individually look unremarkable, visibly reorganizing into a dense cluster the moment shared-attribute edges are drawn. That's a stronger 15-second "I get it" moment than a KPI dashboard.

## What "the bar" requires (from the brief) and how this meets it
> "Honest metrics including false-positive cost." → precision/recall/F1 on a held-out test split, PLUS an explicit false-positive cost model (a wrongly flagged legitimate cluster — e.g. a shared household or office network — has a real cost: blocked genuine customers).
> "Strictly defense-only: anything offense-capable is disqualified." → the system has no action layer beyond "queue for human review with evidence." No ban, no fund freeze, no automated punitive action anywhere in the code.
