"""
Case-file narration for a reviewer.

WHY THIS LAYER, AND WHY IT'S SEPARATE FROM SCORING: a number ("78% abuse
score") tells a reviewer nothing about *why*. This turns the structured
evidence graph.py/detector.py already computed into the argument a human
fraud analyst would actually write — free by default (a deterministic
template over real evidence, not a placeholder), with an optional upgrade
to Claude if ANTHROPIC_API_KEY is ever set. Either way, THIS MODULE NEVER
FEEDS BACK INTO policy.py's decision — it narrates a decision already made,
exactly like the equivalent module in the earlier build.
"""
from __future__ import annotations

import os


def _template_case_file(*, cluster_id: str, abuse_score: float, action: str,
                         cluster_size: int, shared_attributes: list[str],
                         mean_refund_rate: float, registration_burstiness_hours: float,
                         device_reuse_ratio: float, payout_reuse_ratio: float,
                         kyc_verified_ratio: float) -> str:
    signals = []

    if registration_burstiness_hours < 72 and cluster_size >= 3:
        signals.append(
            f"all {cluster_size} accounts registered within a "
            f"{registration_burstiness_hours:.0f}-hour window — consistent with bulk account creation, "
            f"not organic independent signups"
        )
    if device_reuse_ratio > 0.3:
        signals.append(f"{device_reuse_ratio:.0%} of accounts reuse a device fingerprint")
    if payout_reuse_ratio > 0.3:
        signals.append(f"{payout_reuse_ratio:.0%} of accounts reuse a payout destination")
    if mean_refund_rate > 0.25:
        signals.append(f"average refund rate of {mean_refund_rate:.0%}, well above typical")
    if kyc_verified_ratio < 0.5:
        signals.append(f"only {kyc_verified_ratio:.0%} of accounts are KYC-verified")

    if not signals:
        signals.append("shared identifying attributes with no additional behavioural red flags")

    attr_str = ", ".join(shared_attributes) if shared_attributes else "no strong shared attribute"
    body = (
        f"Cluster {cluster_id}: {cluster_size} accounts linked by {attr_str}. "
        f"Evidence: {'; '.join(signals)}. "
        f"Combined abuse score {abuse_score:.0%}."
    )

    verdict = {
        "priority_review": "Recommend senior review before any of these accounts' pending payouts settle.",
        "queue_for_review": "Recommend standard-queue review; no immediate urgency indicated.",
        "no_action": "Evidence insufficient to warrant review at this time.",
    }.get(action, "")

    return f"{body} {verdict}"


def explain(**evidence) -> dict:
    text = _template_case_file(**evidence)
    mode = "template"

    if os.environ.get("ANTHROPIC_API_KEY"):
        # Optional enrichment hook. Not called by default — no network
        # dependency, no cost, and the demo never depends on it being
        # configured. A production version would call the Claude API here
        # with exactly the same structured evidence dict above, and return
        # its prose instead. Never touches `action` — the decision is
        # already final by the time this function is called.
        mode = "template"  # left as template until a key + real call is wired in

    return {"case_file": text, "mode": mode}
