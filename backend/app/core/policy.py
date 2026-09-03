"""
Deterministic review-gate policy — the only module allowed to decide what
happens to a scored cluster.

STRICTLY DEFENSE-ONLY (per the track's explicit rule): the only actions this
system can ever take are `no_action`, `queue_for_review`, and
`priority_review`. There is no ban, no fund freeze, no account suspension,
and no code path that could be extended into one without touching this file.
A human always makes the final call; this module only decides who gets a
human's attention and how urgently.
"""
from __future__ import annotations

from dataclasses import dataclass

REVIEW_THRESHOLD = 0.45
PRIORITY_THRESHOLD = 0.75
ALLOWED_ACTIONS = {"no_action", "queue_for_review", "priority_review"}

# cost model — deliberately simple and stated, not hidden inside a number.
REVIEW_FRICTION_COST_PER_ACCOUNT_INR = 40.0  # analyst time + customer friction if wrong


@dataclass
class ReviewDecision:
    action: str
    reason: str


def decide(abuse_score: float, cluster_size: int) -> ReviewDecision:
    if abuse_score >= PRIORITY_THRESHOLD:
        return ReviewDecision(
            action="priority_review",
            reason=f"abuse_score {abuse_score:.2f} >= priority threshold {PRIORITY_THRESHOLD} "
                    f"({cluster_size} linked accounts) — routed to senior review queue",
        )
    if abuse_score >= REVIEW_THRESHOLD:
        return ReviewDecision(
            action="queue_for_review",
            reason=f"abuse_score {abuse_score:.2f} >= review threshold {REVIEW_THRESHOLD} "
                    f"({cluster_size} linked accounts) — queued for standard review",
        )
    return ReviewDecision(
        action="no_action",
        reason=f"abuse_score {abuse_score:.2f} below review threshold {REVIEW_THRESHOLD} — no action taken",
    )


def false_positive_cost_inr(n_accounts_wrongly_flagged: int) -> float:
    return round(n_accounts_wrongly_flagged * REVIEW_FRICTION_COST_PER_ACCOUNT_INR, 2)
