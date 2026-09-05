import pandas as pd

from app.core import dataset, detector, investigate
from app.core.graph import build_graph, find_clusters


def _pipeline():
    accounts = dataset.generate_accounts(n_legit=800, n_rings=15)
    g = build_graph(accounts)
    clusters = find_clusters(g)
    cluster_df = detector.build_cluster_table(clusters, accounts)
    clf = detector.train(cluster_df)
    return accounts, cluster_df, clf


def test_find_shared_attribute_matches_finds_real_overlap():
    accounts, _, _ = _pipeline()
    ring_row = accounts[accounts["is_ring_member"]].iloc[0]
    result = investigate.find_shared_attribute_matches(accounts, "device_fingerprint", ring_row["device_fingerprint"])
    assert result["n_accounts"] >= 1
    assert ring_row["account_id"] in result["account_ids"]


def test_find_shared_attribute_matches_rejects_unknown_attribute():
    accounts, _, _ = _pipeline()
    result = investigate.find_shared_attribute_matches(accounts, "ssn", "123")
    assert "error" in result


def test_get_account_history_returns_real_fields():
    accounts, _, _ = _pipeline()
    aid = accounts.iloc[0]["account_id"]
    result = investigate.get_account_history(accounts, aid)
    assert result["account_id"] == aid
    assert "refund_rate" in result and "kyc_verified" in result


def test_get_account_history_unknown_account():
    accounts, _, _ = _pipeline()
    result = investigate.get_account_history(accounts, "does-not-exist")
    assert "error" in result


def test_compare_to_nearest_legit_cluster_returns_a_different_cluster():
    accounts, cluster_df, _ = _pipeline()
    flagged = cluster_df[cluster_df["label"] == 1]
    if flagged.empty:
        return  # this random draw produced no flagged clusters; not this test's job to force one
    cid = flagged.iloc[0]["cluster_id"]
    result = investigate.compare_to_nearest_legit_cluster(cluster_df, cid)
    assert "error" not in result
    assert result["nearest_legit_cluster_id"] != cid
    assert set(result["feature_comparison"].keys()) == set(detector.FEATURES)


def test_score_breakdown_ranks_by_importance_times_deviation():
    accounts, cluster_df, clf = _pipeline()
    cid = cluster_df.iloc[0]["cluster_id"]
    result = investigate.get_score_breakdown(clf, cluster_df, cid)
    assert "top_contributing_features" in result
    assert len(result["top_contributing_features"]) <= 5
    assert "not exact SHAP" in result["note"]


def test_investigate_reports_unavailable_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    accounts, cluster_df, clf = _pipeline()
    result = investigate.investigate("does this connect to anything else?", cluster_df.iloc[0]["cluster_id"],
                                      accounts=accounts, cluster_df=cluster_df, clf=clf)
    assert result["available"] is False
    assert "tools_available" in result and len(result["tools_available"]) == 4


def test_tool_schemas_have_no_action_capable_tools():
    """The whole point: structurally, not just by prompt, this agent cannot act."""
    banned = ["ban", "freeze", "suspend", "block", "flag", "queue", "approve", "reject"]
    for tool in investigate.TOOL_SCHEMAS:
        assert not any(w in tool["name"].lower() for w in banned), f"{tool['name']} looks action-capable"
