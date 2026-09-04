"""
Evaluation on REAL data (IEEE-CIS), run as `python -m app.core.real_evaluation`.

Mirrors evaluation.py's structure but swaps the synthetic ring-labelled
dataset for real transactions with real audited fraud labels. Read
real_dataset.py's docstring first: the cluster label here is
"materially elevated real fraud rate", NOT "confirmed collusion ring".
Results must be described that way.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib

from . import real_dataset, real_features
from .graph_real import build_graph_rarity_weighted, find_clusters_real

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
RESULTS_PATH = DATA_DIR / "real_evaluation_results.json"
MODEL_PATH = DATA_DIR / "real_model.joblib"

# See real_features.py — features that genuinely vary in IEEE-CIS. Deliberately
# no fraud-derived feature, since the label itself is fraud-derived.
REAL_FEATURES = real_features.REAL_FEATURES


def run() -> dict:
    accounts = real_dataset.load_accounts()
    g = build_graph_rarity_weighted(accounts)
    clusters = find_clusters_real(g)
    if not clusters:
        raise RuntimeError("no clusters found in real data")

    cluster_df = real_features.build_real_cluster_table(clusters, accounts)
    cluster_df = real_dataset.label_clusters(cluster_df, accounts)

    train = cluster_df[cluster_df["split"] == "train"]
    test = cluster_df[cluster_df["split"] == "test"]

    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score

    clf = GradientBoostingClassifier(n_estimators=140, max_depth=3, learning_rate=0.08, random_state=7)
    clf.fit(train[REAL_FEATURES], train["label"])
    joblib.dump(clf, MODEL_PATH)

    proba = clf.predict_proba(test[REAL_FEATURES])[:, 1]
    pred = (proba >= 0.5).astype(int)
    y = test["label"].to_numpy()

    # policy layer + naive baseline, same comparison as the synthetic run
    flagged_ai = [(p, row) for p, (_, row) in zip(pred, test.iterrows()) if p == 1]
    ai_fp = sum(1 for p, row in flagged_ai if row["label"] == 0)
    ai_tp = sum(1 for p, row in flagged_ai if row["label"] == 1)
    baseline_fp = int((test["label"] == 0).sum())   # naive: flag every cluster
    baseline_tp = int((test["label"] == 1).sum())

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_source": {
            "name": "IEEE-CIS Fraud Detection (real transactions)",
            "url": "https://huggingface.co/datasets/aliceczr/ieee-fraud-detection",
            "n_transactions": int(accounts["order_count"].sum()),
            "n_account_entities": int(len(accounts)),
            "population_fraud_rate": round(float(accounts["n_fraud_tx"].sum() / accounts["order_count"].sum()), 4),
        },
        "label_definition": {
            "type": "PROXY — not ring ground truth",
            "rule": f"cluster labelled abusive if transaction-weighted real fraud rate >= {real_dataset.ABUSIVE_CLUSTER_FRAUD_RATE}",
            "caveat": "IEEE-CIS labels transactions, not collusion rings. Results describe "
                      "clusters with materially elevated REAL fraud rates, not confirmed rings.",
        },
        "clusters": {
            "n_found": int(len(cluster_df)),
            "n_train": int(len(train)),
            "n_test": int(len(test)),
            "n_abusive_train": int(train["label"].sum()),
            "n_abusive_test": int(test["label"].sum()),
        },
        "held_out_test": {
            "precision": round(float(precision_score(y, pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y, pred, zero_division=0)), 4),
            "f1": round(float(f1_score(y, pred, zero_division=0)), 4),
            "roc_auc": round(float(roc_auc_score(y, proba)), 4) if len(set(y)) > 1 else None,
        },
        "vs_naive_baseline": {
            "ai_clusters_flagged": len(flagged_ai),
            "ai_false_positives": ai_fp,
            "ai_true_positives": ai_tp,
            "baseline_clusters_flagged": int(len(test)),
            "baseline_false_positives": baseline_fp,
            "baseline_true_positives": baseline_tp,
        },
    }
    RESULTS_PATH.write_text(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
