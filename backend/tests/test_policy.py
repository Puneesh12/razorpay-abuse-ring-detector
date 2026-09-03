from app.core import policy


def test_low_score_is_no_action():
    d = policy.decide(0.1, 5)
    assert d.action == "no_action"


def test_mid_score_is_standard_review():
    d = policy.decide(0.6, 5)
    assert d.action == "queue_for_review"


def test_high_score_is_priority_review():
    d = policy.decide(0.9, 5)
    assert d.action == "priority_review"


def test_only_defense_only_actions_exist_in_module():
    """The whole point of Track 2's 'strictly defense-only' rule: no action
    string anywhere in the allowed set can freeze funds, ban, or suspend."""
    banned_words = ["ban", "freeze", "suspend", "block", "terminate", "delete"]
    for action in policy.ALLOWED_ACTIONS:
        assert not any(w in action for w in banned_words), f"{action} looks offense-capable"


def test_false_positive_cost_scales_linearly():
    assert policy.false_positive_cost_inr(10) == 10 * policy.REVIEW_FRICTION_COST_PER_ACCOUNT_INR


def test_boundary_scores_are_deterministic():
    assert policy.decide(policy.REVIEW_THRESHOLD, 3).action == "queue_for_review"
    assert policy.decide(policy.PRIORITY_THRESHOLD, 3).action == "priority_review"
