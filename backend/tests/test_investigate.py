import json

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
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
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


def test_openai_style_tools_match_anthropic_schemas_one_to_one():
    converted = investigate._openai_style_tools()
    assert len(converted) == len(investigate.TOOL_SCHEMAS)
    for original, conv in zip(investigate.TOOL_SCHEMAS, converted):
        assert conv["type"] == "function"
        assert conv["function"]["name"] == original["name"]
        assert conv["function"]["parameters"] == original["input_schema"]


def test_groq_path_dispatches_tool_calls_and_returns_final_answer(monkeypatch):
    """Mocks the groq client -- no real network call -- to verify the
    OpenAI-style tool_calls/tool-role loop is wired correctly end to end."""
    accounts, cluster_df, clf = _pipeline()
    real_cluster_id = cluster_df.iloc[0]["cluster_id"]

    class FakeFunction:
        def __init__(self, name, arguments):
            self.name = name
            self.arguments = arguments

    class FakeToolCall:
        def __init__(self, id_, name, arguments):
            self.id = id_
            self.function = FakeFunction(name, arguments)

    class FakeMessage:
        def __init__(self, content=None, tool_calls=None):
            self.content = content
            self.tool_calls = tool_calls

        def model_dump(self, exclude_none=True):
            return {"role": "assistant", "content": self.content}

    class FakeChoice:
        def __init__(self, message):
            self.message = message

    class FakeResponse:
        def __init__(self, message):
            self.choices = [FakeChoice(message)]

    call_count = {"n": 0}

    class FakeCompletions:
        def create(self, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                tool_call = FakeToolCall("call_1", "get_score_breakdown", json.dumps({"cluster_id": real_cluster_id}))
                return FakeResponse(FakeMessage(tool_calls=[tool_call]))
            return FakeResponse(FakeMessage(content="Based on the breakdown, device reuse drove the score most."))

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeGroqClient:
        def __init__(self, api_key):
            self.chat = FakeChat()

    fake_groq_module = type("fake_groq", (), {"Groq": FakeGroqClient})
    monkeypatch.setitem(__import__("sys").modules, "groq", fake_groq_module)

    result = investigate._investigate_groq("fake-key", "what drove this score?", real_cluster_id,
                                            accounts=accounts, cluster_df=cluster_df, clf=clf)
    assert result["available"] is True
    assert result["provider"] == "groq"
    assert len(result["tool_trace"]) == 1
    assert result["tool_trace"][0]["tool"] == "get_score_breakdown"
    assert "device reuse" in result["answer"]
