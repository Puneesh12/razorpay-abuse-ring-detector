from app.core import explain


def _base_kwargs(**overrides):
    kwargs = dict(
        cluster_id="cluster_1", abuse_score=0.82, action="priority_review",
        cluster_size=6, shared_attributes=["device_fingerprint", "payout_account_hash"],
        mean_refund_rate=0.4, registration_burstiness_hours=12.0,
        device_reuse_ratio=0.8, payout_reuse_ratio=0.9, kyc_verified_ratio=0.2,
    )
    kwargs.update(overrides)
    return kwargs


def test_runs_free_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    result = explain.explain(**_base_kwargs())
    assert result["mode"] == "template"
    assert "cluster_1" in result["case_file"]


def test_high_burst_and_reuse_signals_appear_in_text():
    result = explain.explain(**_base_kwargs())
    text = result["case_file"]
    assert "hour window" in text
    assert "reuse a device fingerprint" in text
    assert "reuse a payout destination" in text


def test_priority_action_gets_urgent_recommendation():
    result = explain.explain(**_base_kwargs(action="priority_review"))
    assert "senior review" in result["case_file"]


def test_no_action_gets_insufficient_evidence_text():
    result = explain.explain(**_base_kwargs(action="no_action", abuse_score=0.1,
                                             device_reuse_ratio=0.0, payout_reuse_ratio=0.0,
                                             mean_refund_rate=0.05, kyc_verified_ratio=0.9,
                                             registration_burstiness_hours=2000.0))
    assert "insufficient" in result["case_file"]


def test_never_crashes_on_empty_shared_attributes():
    result = explain.explain(**_base_kwargs(shared_attributes=[]))
    assert "no strong shared attribute" in result["case_file"]
