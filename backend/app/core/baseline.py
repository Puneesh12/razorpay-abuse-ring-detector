"""
Naive baseline: "any cluster of 2+ accounts sharing an attribute is
suspicious" — i.e. the graph alone, no learned scoring. This is a fair,
non-strawman baseline: it's exactly what a rules-only fraud system would do,
and it's what tests whether the classifier layer earns its keep.
"""
from __future__ import annotations

import pandas as pd

from . import policy


def run_baseline(cluster_df: pd.DataFrame, split: str) -> dict:
    df = cluster_df[cluster_df["split"] == split]
    if df.empty:
        return {"n_clusters": 0}

    flagged = df  # every cluster in the candidate set gets flagged, score=1.0 implicitly
    tp = flagged[flagged["label"] == 1]
    fp = flagged[flagged["label"] == 0]

    n_fp_accounts = int(sum(len(m) for m in fp["member_ids"]))
    n_tp_accounts = int(sum(len(m) for m in tp["member_ids"]))

    precision = len(tp) / len(flagged) if len(flagged) else 0.0
    recall = 1.0  # flags every cluster that exists in the candidate set -> recall over candidates is 100%

    return {
        "n_clusters_flagged": int(len(flagged)),
        "true_positive_clusters": int(len(tp)),
        "false_positive_clusters": int(len(fp)),
        "cluster_precision": round(precision, 4),
        "cluster_recall": round(recall, 4),
        "n_accounts_wrongly_flagged": n_fp_accounts,
        "n_accounts_correctly_flagged": n_tp_accounts,
        "false_positive_cost_inr": policy.false_positive_cost_inr(n_fp_accounts),
    }
