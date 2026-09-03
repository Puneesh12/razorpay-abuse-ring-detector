"""
End-to-end evaluation harness. Run via `python -m app.core.evaluation`.

The classifier is trained only on clusters whose account-split majority is
TRAIN. Every number reported here comes from clusters whose majority split is
TEST, touched once. See dataset.py::split_accounts docstring for the
documented (not hidden) transductive-leakage caveat inherent to graph
problems: a test-majority cluster can still contain a minority of train
accounts, because cluster membership is structural, not assignable.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pandas as pd

from . import baseline, dataset, detector, policy
from .graph import build_graph, find_clusters

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
MODEL_PATH = DATA_DIR / "model.joblib"
RESULTS_PATH = DATA_DIR / "evaluation_results.json"


def estimated_loss_inr(accounts: pd.DataFrame, member_ids: list[str]) -> float:
    members = accounts[accounts["account_id"].isin(member_ids)]
    return float((members["refund_count"] * members["avg_order_value"]).sum())


def run_full_evaluation() -> dict:
    accounts = dataset.generate_accounts()
    accounts.to_csv(DATA_DIR / "accounts.csv", index=False)

    g = build_graph(accounts)
    clusters = find_clusters(g)
    cluster_df = detector.build_cluster_table(clusters, accounts)
    cluster_df.to_csv(DATA_DIR / "clusters.csv", index=False)

    clf = detector.train(cluster_df)
    import joblib
    joblib.dump(clf, MODEL_PATH)

    val_metrics = detector.evaluate(clf, cluster_df, "val")
    test_metrics = detector.evaluate(clf, cluster_df, "test")

    scored = detector.score_clusters(clf, cluster_df)
    test_scored = scored[scored["split"] == "test"].copy()
    test_scored["action"] = test_scored["abuse_score"].apply(
        lambda s: policy.decide(s, 0).action
    )

    fp_clusters = test_scored[(test_scored["action"] != "no_action") & (test_scored["label"] == 0)]
    tp_clusters = test_scored[(test_scored["action"] != "no_action") & (test_scored["label"] == 1)]
    n_fp_accounts = int(sum(len(m) for m in fp_clusters["member_ids"]))
    n_tp_accounts = int(sum(len(m) for m in tp_clusters["member_ids"]))
    caught_loss = sum(estimated_loss_inr(accounts, m) for m in tp_clusters["member_ids"])
    missed_loss = sum(
        estimated_loss_inr(accounts, m)
        for m in test_scored[(test_scored["action"] == "no_action") & (test_scored["label"] == 1)]["member_ids"]
    )

    base = baseline.run_baseline(cluster_df, "test")
    base_caught_loss = sum(
        estimated_loss_inr(accounts, m)
        for m in cluster_df[(cluster_df["split"] == "test") & (cluster_df["label"] == 1)]["member_ids"]
    )

    summary = {
        "generated_at": datetime.utcnow().isoformat(),
        "dataset": {
            "n_accounts": int(len(accounts)),
            "n_ring_accounts_ground_truth": int(accounts["is_ring_member"].sum()),
            "n_rings_ground_truth": int(accounts["ring_id"].nunique()),
            "n_clusters_found": int(len(cluster_df)),
        },
        "detector_metrics": {"validation": val_metrics, "held_out_test": test_metrics},
        "policy_run_test_split": {
            "n_clusters_evaluated": int(len(test_scored)),
            "n_flagged": int((test_scored["action"] != "no_action").sum()),
            "n_priority_review": int((test_scored["action"] == "priority_review").sum()),
            "n_standard_review": int((test_scored["action"] == "queue_for_review").sum()),
            "n_accounts_wrongly_flagged": n_fp_accounts,
            "n_accounts_correctly_flagged": n_tp_accounts,
            "false_positive_cost_inr": policy.false_positive_cost_inr(n_fp_accounts),
            "estimated_loss_caught_inr": round(caught_loss, 2),
            "estimated_loss_missed_inr": round(missed_loss, 2),
        },
        "baseline_graph_only_test_split": {
            **base,
            "estimated_loss_caught_inr": round(base_caught_loss, 2),
        },
        "comparison": {
            "fp_cost_reduction_inr": round(base.get("false_positive_cost_inr", 0) - policy.false_positive_cost_inr(n_fp_accounts), 2),
            "fp_accounts_reduction": int(base.get("n_accounts_wrongly_flagged", 0) - n_fp_accounts),
        },
    }
    RESULTS_PATH.write_text(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    result = run_full_evaluation()
    print(json.dumps(result, indent=2))
