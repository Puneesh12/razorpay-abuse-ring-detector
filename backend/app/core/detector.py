"""
Cluster-level abuse scoring.

WHY ML HERE: given a candidate cluster (already found deterministically by
graph.py), whether its *behaviour* looks like coordinated abuse — registration
bursts, elevated refund/promo rates, low KYC — versus an innocent coincidence
(a family sharing one address, an office sharing one IP) is a genuine
classification problem over noisy, overlapping features. This is the one
place in the pipeline where prediction is the right frame.
"""
from __future__ import annotations

import hashlib
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score

from .graph import Cluster

FEATURES = [
    "cluster_size", "edge_density", "mean_refund_rate", "mean_account_age_days",
    "mean_promo_usage", "registration_burstiness_hours", "device_reuse_ratio",
    "payout_reuse_ratio", "addr_reuse_ratio", "kyc_verified_ratio", "mean_order_value",
    "distinct_attr_types",
]


def _account_split(account_id: str) -> str:
    h = int(hashlib.sha256(account_id.encode()).hexdigest(), 16) % 100
    if h < 60:
        return "train"
    if h < 80:
        return "val"
    return "test"


def cluster_features(cluster: Cluster, accounts: pd.DataFrame) -> dict:
    members = accounts[accounts["account_id"].isin(cluster.member_ids)]
    n = len(members)
    possible_edges = n * (n - 1) / 2
    edge_density = len(cluster.edges) / possible_edges if possible_edges else 0.0

    signups = pd.to_datetime(members["signup_date"], format="ISO8601")
    burstiness = (signups.max() - signups.min()).total_seconds() / 3600 if n > 1 else 0.0

    attr_types = set()
    for _, _, d in cluster.edges:
        attr_types.update(d.get("attrs", []))

    splits = [_account_split(a) for a in cluster.member_ids]
    split = pd.Series(splits).mode().iloc[0]
    label = int(members["is_ring_member"].mean() >= 0.5)

    return {
        "cluster_id": cluster.cluster_id,
        "member_ids": cluster.member_ids,
        "split": split,
        "label": label,
        "cluster_size": n,
        "edge_density": round(edge_density, 4),
        "mean_refund_rate": round(float(members["refund_rate"].mean()), 4),
        "mean_account_age_days": round(float(members["account_age_days"].mean()), 2),
        "mean_promo_usage": round(float(members["promo_usage_count"].mean()), 3),
        "registration_burstiness_hours": round(min(burstiness, 24 * 365), 2),
        "device_reuse_ratio": round(1 - members["device_fingerprint"].nunique() / n, 4),
        "payout_reuse_ratio": round(1 - members["payout_account_hash"].nunique() / n, 4),
        "addr_reuse_ratio": round(1 - members["shipping_address_hash"].nunique() / n, 4),
        "kyc_verified_ratio": round(float(members["kyc_verified"].mean()), 4),
        "mean_order_value": round(float(members["avg_order_value"].mean()), 2),
        "distinct_attr_types": len(attr_types),
    }


def build_cluster_table(clusters: list[Cluster], accounts: pd.DataFrame) -> pd.DataFrame:
    rows = [cluster_features(c, accounts) for c in clusters]
    return pd.DataFrame(rows)


def train(cluster_df: pd.DataFrame) -> GradientBoostingClassifier:
    train_df = cluster_df[cluster_df["split"] == "train"]
    clf = GradientBoostingClassifier(n_estimators=140, max_depth=3, learning_rate=0.08, random_state=7)
    clf.fit(train_df[FEATURES], train_df["label"])
    return clf


def evaluate(clf: GradientBoostingClassifier, cluster_df: pd.DataFrame, split: str, threshold: float = 0.5) -> dict:
    df = cluster_df[cluster_df["split"] == split]
    if df.empty:
        return {"n_clusters": 0}
    proba = clf.predict_proba(df[FEATURES])[:, 1]
    pred = (proba >= threshold).astype(int)
    y = df["label"].to_numpy()

    # account-level metrics: every member inherits the cluster's prediction
    member_pred, member_true = [], []
    for p, row in zip(pred, df.itertuples()):
        for _ in row.member_ids:
            member_pred.append(p)
    for _, row in df.iterrows():
        member_true.extend([row["label"]] * len(row["member_ids"]))

    return {
        "n_clusters": int(len(df)),
        "n_accounts_in_clusters": int(sum(len(m) for m in df["member_ids"])),
        "cluster_precision": round(float(precision_score(y, pred, zero_division=0)), 4),
        "cluster_recall": round(float(recall_score(y, pred, zero_division=0)), 4),
        "cluster_f1": round(float(f1_score(y, pred, zero_division=0)), 4),
        "cluster_roc_auc": round(float(roc_auc_score(y, proba)), 4) if len(set(y)) > 1 else None,
        "account_precision": round(float(precision_score(member_true, member_pred, zero_division=0)), 4),
        "account_recall": round(float(recall_score(member_true, member_pred, zero_division=0)), 4),
        "false_positive_clusters": int(((pred == 1) & (y == 0)).sum()),
        "false_negative_clusters": int(((pred == 0) & (y == 1)).sum()),
        "true_positive_clusters": int(((pred == 1) & (y == 1)).sum()),
    }


def score_clusters(clf: GradientBoostingClassifier, cluster_df: pd.DataFrame) -> pd.DataFrame:
    df = cluster_df.copy()
    df["abuse_score"] = clf.predict_proba(df[FEATURES])[:, 1]
    return df
