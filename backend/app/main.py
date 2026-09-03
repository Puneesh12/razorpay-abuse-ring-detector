"""
FastAPI app exposing the abuse-ring detector for the graph dashboard.

Single-process monolith, matching the pattern proven in the earlier build:
in-process pipeline over on-disk CSV/joblib artifacts, no message queue, no
microservices. STRICTLY DEFENSE-ONLY: every endpoint here is read-only or
queues a review action — nothing here can ban, freeze, or take an
irreversible action on an account.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .core import detector, explain, policy
from .core.graph import build_graph, find_clusters

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"

app = FastAPI(title="Razorpay AI Risk Manager — Abuse Ring Detector", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/metrics")
def metrics():
    path = DATA_DIR / "evaluation_results.json"
    if not path.exists():
        raise HTTPException(404, "No evaluation results yet. Run `python -m app.core.evaluation`.")
    return json.loads(path.read_text())


@app.get("/api/graph")
def graph_snapshot(split: str = "test", limit_clusters: int = 40):
    """Return the account graph for the requested split, scored, for the
    dashboard's force-directed visualization — nodes, edges, and each
    cluster's abuse score + review decision."""
    accounts_path = DATA_DIR / "accounts.csv"
    model_path = DATA_DIR / "model.joblib"
    clusters_path = DATA_DIR / "clusters.csv"
    if not (accounts_path.exists() and model_path.exists()):
        raise HTTPException(404, "No evaluation run yet. Run `python -m app.core.evaluation`.")

    accounts = pd.read_csv(accounts_path)
    clf = joblib.load(model_path)
    g = build_graph(accounts)
    clusters = find_clusters(g)
    cluster_df = detector.build_cluster_table(clusters, accounts)
    scored = detector.score_clusters(clf, cluster_df)

    if split != "all":
        scored = scored[scored["split"] == split]
    scored = scored.sort_values("abuse_score", ascending=False).head(limit_clusters)

    nodes, edges, cluster_out = [], [], []
    seen_nodes = set()
    id_to_cluster = {}
    cluster_lookup = {c.cluster_id: c for c in clusters}

    for _, row in scored.iterrows():
        cid = row["cluster_id"]
        decision = policy.decide(row["abuse_score"], row["cluster_size"])
        member_accounts = accounts[accounts["account_id"].isin(row["member_ids"])]
        cluster_out.append({
            "cluster_id": cid,
            "size": int(row["cluster_size"]),
            "abuse_score": round(float(row["abuse_score"]), 4),
            "action": decision.action,
            "reason": decision.reason,
            "ground_truth_is_ring": bool(row["label"]),
            "mean_refund_rate": row["mean_refund_rate"],
            "registration_burstiness_hours": row["registration_burstiness_hours"],
            "device_reuse_ratio": row["device_reuse_ratio"],
            "payout_reuse_ratio": row["payout_reuse_ratio"],
            "kyc_verified_ratio": row["kyc_verified_ratio"],
        })
        for aid in row["member_ids"]:
            id_to_cluster[aid] = cid
            if aid not in seen_nodes:
                seen_nodes.add(aid)
                acct = member_accounts[member_accounts["account_id"] == aid].iloc[0]
                nodes.append({
                    "id": aid, "cluster_id": cid,
                    "abuse_score": round(float(row["abuse_score"]), 4),
                    "action": decision.action,
                    "is_ring": bool(acct["is_ring_member"]),
                    "kyc_verified": bool(acct["kyc_verified"]),
                    "refund_rate": float(acct["refund_rate"]),
                })
        sub = cluster_lookup[cid]
        for a, b, d in sub.edges:
            if a in seen_nodes and b in seen_nodes:
                edges.append({"source": a, "target": b, "weight": d["weight"], "attrs": d["attrs"]})

    return {"nodes": nodes, "edges": edges, "clusters": cluster_out}


@app.get("/api/cluster/{cluster_id}")
def cluster_detail(cluster_id: str):
    accounts_path = DATA_DIR / "accounts.csv"
    model_path = DATA_DIR / "model.joblib"
    if not (accounts_path.exists() and model_path.exists()):
        raise HTTPException(404, "No evaluation run yet.")
    accounts = pd.read_csv(accounts_path)
    clf = joblib.load(model_path)
    g = build_graph(accounts)
    clusters = find_clusters(g)
    match = next((c for c in clusters if c.cluster_id == cluster_id), None)
    if not match:
        raise HTTPException(404, f"cluster {cluster_id} not found")
    cluster_df = detector.build_cluster_table([match], accounts)
    scored = detector.score_clusters(clf, cluster_df).iloc[0]
    decision = policy.decide(scored["abuse_score"], scored["cluster_size"])
    members = accounts[accounts["account_id"].isin(match.member_ids)].to_dict("records")
    shared_attrs = list({a for _, _, d in match.edges for a in d["attrs"]})
    case_file = explain.explain(
        cluster_id=cluster_id, abuse_score=float(scored["abuse_score"]), action=decision.action,
        cluster_size=int(scored["cluster_size"]), shared_attributes=shared_attrs,
        mean_refund_rate=float(scored["mean_refund_rate"]),
        registration_burstiness_hours=float(scored["registration_burstiness_hours"]),
        device_reuse_ratio=float(scored["device_reuse_ratio"]),
        payout_reuse_ratio=float(scored["payout_reuse_ratio"]),
        kyc_verified_ratio=float(scored["kyc_verified_ratio"]),
    )
    return {
        "cluster_id": cluster_id, "abuse_score": round(float(scored["abuse_score"]), 4),
        "action": decision.action, "reason": decision.reason,
        "case_file": case_file["case_file"], "case_file_mode": case_file["mode"],
        "features": {k: (scored[k].item() if hasattr(scored[k], "item") else scored[k]) for k in detector.FEATURES},
        "members": [
            {k: (v.item() if hasattr(v, "item") else v) for k, v in m.items()}
            for m in members
        ],
        "shared_attributes": shared_attrs,
    }


if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
