"""
Read-only investigation agent for the human reviewer.

WHY AN AGENT HERE, AND NOWHERE ELSE: every other module in this codebase is
either deterministic (graph.py, policy.py) or a narrow classifier
(detector.py) — correct, because scoring and deciding aren't reasoning
problems. Answering an open-ended follow-up question from a reviewer
("has this device shown up anywhere else? why wasn't the look-alike cluster
flagged?") *is* a reasoning problem over evidence that varies case to case,
which is exactly what a tool-calling agent is for.

THE GUARDRAIL IS STRUCTURAL, NOT PROMPTED: every tool below is read-only.
There is no tool that can flag, queue, ban, or change anything — not "the
agent is told not to," there is literally no such function for it to call.
policy.py remains the only code path that can produce a review decision.
This module can only ever help a human understand one that's already made.

If ANTHROPIC_API_KEY is not set, `investigate()` returns a clear
"unavailable" response — the tool functions themselves (used directly, no
API key needed) are the tested, load-bearing part; the chat loop on top is
an optional convenience layer.
"""
from __future__ import annotations

import json
import os

import numpy as np
import pandas as pd

from .detector import FEATURES

MAX_TOOL_TURNS = 6
MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """You are a read-only investigation assistant helping a fraud-risk reviewer \
understand one flagged account cluster on Razorpay's abuse-ring detector.

Rules, not suggestions:
- You cannot flag, queue, ban, freeze, or change anything. No such tool exists for you to call.
- If asked to take an action, say plainly that this system is strictly defense-only and only a \
human reviewer can act — then answer the underlying question with evidence instead.
- Only state what the tools return. Never invent an account, a number, or a match that a tool \
did not give you.
- Be concise. The reviewer wants an answer with evidence, not a essay."""


# ---- tool implementations: pure data-layer, no API key required, fully testable ----

def find_shared_attribute_matches(accounts: pd.DataFrame, attribute: str, value: str) -> dict:
    if attribute not in {"device_fingerprint", "payout_account_hash", "shipping_address_hash", "ip_subnet"}:
        return {"error": f"unknown attribute '{attribute}'"}
    matches = accounts[accounts[attribute] == value]
    return {
        "attribute": attribute,
        "value": value,
        "n_accounts": int(len(matches)),
        "account_ids": matches["account_id"].tolist()[:25],
    }


def get_account_history(accounts: pd.DataFrame, account_id: str) -> dict:
    row = accounts[accounts["account_id"] == account_id]
    if row.empty:
        return {"error": f"no account '{account_id}'"}
    r = row.iloc[0]
    return {
        "account_id": account_id,
        "account_age_days": float(r["account_age_days"]),
        "order_count": int(r["order_count"]),
        "refund_count": int(r["refund_count"]),
        "refund_rate": float(r["refund_rate"]),
        "avg_order_value": float(r["avg_order_value"]),
        "promo_usage_count": int(r["promo_usage_count"]),
        "kyc_verified": bool(r["kyc_verified"]),
    }


def compare_to_nearest_legit_cluster(cluster_df: pd.DataFrame, cluster_id: str) -> dict:
    target = cluster_df[cluster_df["cluster_id"] == cluster_id]
    if target.empty:
        return {"error": f"no cluster '{cluster_id}'"}
    target_row = target.iloc[0]
    legit = cluster_df[(cluster_df["cluster_id"] != cluster_id) & (cluster_df["label"] == 0)]
    if legit.empty:
        return {"error": "no legitimate clusters to compare against"}

    X = legit[FEATURES].to_numpy(dtype=float)
    mean, std = X.mean(axis=0), X.std(axis=0)
    std[std == 0] = 1.0
    target_vec = (target_row[FEATURES].to_numpy(dtype=float) - mean) / std
    legit_norm = (X - mean) / std
    dists = np.linalg.norm(legit_norm - target_vec, axis=1)
    nearest_idx = int(np.argmin(dists))
    nearest = legit.iloc[nearest_idx]

    diffs = {
        f: {"this_cluster": round(float(target_row[f]), 4), "nearest_legit": round(float(nearest[f]), 4)}
        for f in FEATURES
    }
    return {
        "cluster_id": cluster_id,
        "nearest_legit_cluster_id": nearest["cluster_id"],
        "feature_comparison": diffs,
    }


def get_score_breakdown(clf, cluster_df: pd.DataFrame, cluster_id: str) -> dict:
    """Approximate, not true SHAP: feature_importances_ times the feature's
    deviation from the training population mean. Good enough to say "this
    feature pushed the score up," not precise enough to claim exact
    attribution — stated here, not hidden."""
    row = cluster_df[cluster_df["cluster_id"] == cluster_id]
    if row.empty:
        return {"error": f"no cluster '{cluster_id}'"}
    r = row.iloc[0]
    importances = clf.named_steps["clf"].feature_importances_ if hasattr(clf, "named_steps") else clf.feature_importances_
    pop_mean = cluster_df[FEATURES].mean()
    pop_std = cluster_df[FEATURES].std().replace(0, 1.0)
    contributions = []
    for i, f in enumerate(FEATURES):
        z = (r[f] - pop_mean[f]) / pop_std[f]
        contributions.append({"feature": f, "value": round(float(r[f]), 4), "z_score_vs_population": round(float(z), 2),
                               "model_importance": round(float(importances[i]), 4)})
    contributions.sort(key=lambda c: abs(c["z_score_vs_population"]) * c["model_importance"], reverse=True)
    return {"cluster_id": cluster_id, "note": "approximate attribution (importance x deviation), not exact SHAP",
            "top_contributing_features": contributions[:5]}


TOOL_SCHEMAS = [
    {
        "name": "find_shared_attribute_matches",
        "description": "Find every account sharing a given device fingerprint, payout account, shipping address, or IP subnet value.",
        "input_schema": {
            "type": "object",
            "properties": {
                "attribute": {"type": "string", "enum": ["device_fingerprint", "payout_account_hash", "shipping_address_hash", "ip_subnet"]},
                "value": {"type": "string"},
            },
            "required": ["attribute", "value"],
        },
    },
    {
        "name": "get_account_history",
        "description": "Get one account's order/refund/KYC history.",
        "input_schema": {"type": "object", "properties": {"account_id": {"type": "string"}}, "required": ["account_id"]},
    },
    {
        "name": "compare_to_nearest_legit_cluster",
        "description": "Find the nearest non-flagged (legitimate) cluster to this one in feature space, with a side-by-side feature comparison.",
        "input_schema": {"type": "object", "properties": {"cluster_id": {"type": "string"}}, "required": ["cluster_id"]},
    },
    {
        "name": "get_score_breakdown",
        "description": "Get an approximate breakdown of which features drove this cluster's abuse score.",
        "input_schema": {"type": "object", "properties": {"cluster_id": {"type": "string"}}, "required": ["cluster_id"]},
    },
]


def _dispatch(name: str, tool_input: dict, *, accounts: pd.DataFrame, cluster_df: pd.DataFrame, clf) -> dict:
    if name == "find_shared_attribute_matches":
        return find_shared_attribute_matches(accounts, tool_input["attribute"], tool_input["value"])
    if name == "get_account_history":
        return get_account_history(accounts, tool_input["account_id"])
    if name == "compare_to_nearest_legit_cluster":
        return compare_to_nearest_legit_cluster(cluster_df, tool_input["cluster_id"])
    if name == "get_score_breakdown":
        return get_score_breakdown(clf, cluster_df, tool_input["cluster_id"])
    return {"error": f"unknown tool '{name}'"}


GROQ_MODEL = "llama-3.3-70b-versatile"


def _openai_style_tools() -> list[dict]:
    """Groq's API is OpenAI-compatible: function-calling tools use a
    different envelope than Anthropic's, even though the same JSON schema
    describes the parameters either way."""
    return [
        {"type": "function", "function": {
            "name": t["name"], "description": t["description"], "parameters": t["input_schema"],
        }}
        for t in TOOL_SCHEMAS
    ]


def _investigate_anthropic(api_key: str, question: str, cluster_id: str, *,
                            accounts: pd.DataFrame, cluster_df: pd.DataFrame, clf) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)

    messages = [{"role": "user", "content": f"Cluster under review: {cluster_id}\n\nReviewer's question: {question}"}]
    trace = []

    for _ in range(MAX_TOOL_TURNS):
        response = client.messages.create(
            model=MODEL, max_tokens=1024, system=SYSTEM_PROMPT,
            tools=TOOL_SCHEMAS, messages=messages,
        )
        messages.append({"role": "assistant", "content": response.content})

        tool_calls = [b for b in response.content if b.type == "tool_use"]
        if not tool_calls:
            final_text = "".join(b.text for b in response.content if b.type == "text")
            return {"available": True, "answer": final_text, "tool_trace": trace, "provider": "anthropic"}

        tool_results = []
        for call in tool_calls:
            result = _dispatch(call.name, call.input, accounts=accounts, cluster_df=cluster_df, clf=clf)
            trace.append({"tool": call.name, "input": call.input, "result": result})
            tool_results.append({
                "type": "tool_result", "tool_use_id": call.id, "content": json.dumps(result),
            })
        messages.append({"role": "user", "content": tool_results})

    return {"available": True, "answer": "Reached the investigation turn limit without a final answer.",
            "tool_trace": trace, "provider": "anthropic"}


def _investigate_groq(api_key: str, question: str, cluster_id: str, *,
                       accounts: pd.DataFrame, cluster_df: pd.DataFrame, clf) -> dict:
    import groq
    client = groq.Groq(api_key=api_key)
    tools = _openai_style_tools()

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Cluster under review: {cluster_id}\n\nReviewer's question: {question}"},
    ]
    trace = []

    for _ in range(MAX_TOOL_TURNS):
        response = client.chat.completions.create(
            model=GROQ_MODEL, max_tokens=1024, tools=tools, messages=messages,
        )
        msg = response.choices[0].message
        messages.append(msg.model_dump(exclude_none=True))

        if not msg.tool_calls:
            return {"available": True, "answer": msg.content or "", "tool_trace": trace, "provider": "groq"}

        for call in msg.tool_calls:
            tool_input = json.loads(call.function.arguments)
            result = _dispatch(call.function.name, tool_input, accounts=accounts, cluster_df=cluster_df, clf=clf)
            trace.append({"tool": call.function.name, "input": tool_input, "result": result})
            messages.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(result)})

    return {"available": True, "answer": "Reached the investigation turn limit without a final answer.",
            "tool_trace": trace, "provider": "groq"}


def investigate(question: str, cluster_id: str, *, accounts: pd.DataFrame, cluster_df: pd.DataFrame, clf) -> dict:
    # Anthropic first if both happen to be configured, purely because that
    # was the original design target; Groq is equally supported, not a
    # fallback in capability terms -- just second in this if-chain.
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    groq_key = os.environ.get("GROQ_API_KEY")

    if anthropic_key:
        return _investigate_anthropic(anthropic_key, question, cluster_id, accounts=accounts, cluster_df=cluster_df, clf=clf)
    if groq_key:
        return _investigate_groq(groq_key, question, cluster_id, accounts=accounts, cluster_df=cluster_df, clf=clf)

    return {
        "available": False,
        "reason": "No ANTHROPIC_API_KEY or GROQ_API_KEY configured. The core detection pipeline does "
                  "not need one — this investigation assistant is an optional layer on top of it.",
        "tools_available": [t["name"] for t in TOOL_SCHEMAS],
    }
