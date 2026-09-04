"""
Cluster features for REAL data.

detector.cluster_features() was written for synthetic accounts and reads
fields real data doesn't have (refund_rate, promo_usage_count, kyc_verified)
or that this adapter can only fill with constants (signup_date). Feeding it
real accounts produced several dead features — most importantly
`registration_burstiness_hours`, which was identically 0 for every cluster
because every synthetic-shaped `signup_date` was the same constant. A
constant feature contributes nothing, so the model was effectively training
on a handful of structural columns.

These features use only signals that genuinely vary in IEEE-CIS, plus the
one signal rarity-weighted linking adds: HOW rare the shared attribute was.
An edge formed on a fingerprint only 2 accounts share is far stronger
evidence than one shared by 12 — the classifier should see that.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .graph import Cluster

REAL_FEATURES = [
    "cluster_size",
    "edge_density",
    "mean_edge_weight",        # rarity of the shared attributes (IDF-weighted)
    "max_edge_weight",
    "distinct_attr_types",
    "mean_order_count",
    "mean_order_value",
    "amount_dispersion",       # do members spend near-identically? (scripted behaviour)
    "mean_activity_span_h",
    "activity_synchrony",      # do members transact in the same window?
    "mean_distinct_devices",
    "mean_distinct_emails",
    "device_reuse_ratio",
    "addr_reuse_ratio",
]


def real_cluster_features(cluster: Cluster, accounts: pd.DataFrame) -> dict:
    members = accounts[accounts["account_id"].isin(cluster.member_ids)]
    n = len(members)
    possible = n * (n - 1) / 2
    weights = [d.get("weight", 0.0) for _, _, d in cluster.edges]
    attr_types = {a for _, _, d in cluster.edges for a in d.get("attrs", [])}

    # activity_synchrony: members of a coordinated group tend to be active in
    # overlapping windows. Proxy = 1 / (1 + std of per-account activity spans),
    # scaled — tight agreement -> closer to 1.
    spans = members["activity_span_hours"].to_numpy(dtype=float)
    synchrony = float(1.0 / (1.0 + np.std(spans) / 24.0)) if n > 1 else 0.0

    amounts = members["avg_order_value"].to_numpy(dtype=float)
    dispersion = float(np.std(amounts) / (np.mean(amounts) + 1e-6)) if n > 1 else 0.0

    return {
        "cluster_id": cluster.cluster_id,
        "member_ids": cluster.member_ids,
        "cluster_size": n,
        "edge_density": round(len(cluster.edges) / possible, 4) if possible else 0.0,
        "mean_edge_weight": round(float(np.mean(weights)), 4) if weights else 0.0,
        "max_edge_weight": round(float(np.max(weights)), 4) if weights else 0.0,
        "distinct_attr_types": len(attr_types),
        "mean_order_count": round(float(members["order_count"].mean()), 3),
        "mean_order_value": round(float(members["avg_order_value"].mean()), 2),
        "amount_dispersion": round(dispersion, 4),
        "mean_activity_span_h": round(float(members["activity_span_hours"].mean()), 2),
        "activity_synchrony": round(synchrony, 4),
        "mean_distinct_devices": round(float(members["distinct_devices_used"].mean()), 3),
        "mean_distinct_emails": round(float(members["distinct_emails_used"].mean()), 3),
        "device_reuse_ratio": round(1 - members["device_fingerprint"].nunique() / n, 4),
        "addr_reuse_ratio": round(1 - members["shipping_address_hash"].nunique() / n, 4),
    }


def build_real_cluster_table(clusters: list[Cluster], accounts: pd.DataFrame) -> pd.DataFrame:
    import hashlib

    def split_of(account_id: str) -> str:
        h = int(hashlib.sha256(account_id.encode()).hexdigest(), 16) % 100
        return "train" if h < 60 else ("val" if h < 80 else "test")

    rows = []
    for c in clusters:
        feats = real_cluster_features(c, accounts)
        splits = [split_of(a) for a in c.member_ids]
        feats["split"] = pd.Series(splits).mode().iloc[0]
        rows.append(feats)
    return pd.DataFrame(rows)
