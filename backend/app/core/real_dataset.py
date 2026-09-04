"""
Real-data adapter: IEEE-CIS Fraud Detection (590,540 real e-commerce
transactions, real audited `isFraud` labels).

Source: https://huggingface.co/datasets/aliceczr/ieee-fraud-detection
(a public mirror of the 2019 IEEE-CIS / Vesta Kaggle competition data)

WHY THIS EXISTS ALONGSIDE dataset.py:
`dataset.py` generates synthetic accounts with *planted, known* collusion
rings, so ring membership is perfect ground truth. No public dataset has
that — ring-membership labels are exactly what payment companies keep
internal. This module trades that clean label for real-world data.

THE LABEL IS A PROXY, AND THAT MATTERS — stated plainly, not buried:
  - IEEE-CIS labels individual TRANSACTIONS as fraud/not-fraud. It does
    NOT label "these accounts are one ring."
  - So here, a cluster is labelled abusive if its member accounts'
    real fraud rate is materially elevated vs. the population base rate
    (see ABUSIVE_CLUSTER_FRAUD_RATE below).
  - That is an honest, defensible proxy built from real audited fraud
    outcomes — but it is NOT the same claim as "we detected a ring."
    Any result from this module must be described as "clusters with
    elevated real fraud rates", never as "rings".

ENTITY MODEL:
An "account" here = a unique `card1` value (Vesta's card fingerprint), the
closest available stand-in for a recurring payer identity. Its attributes
are aggregated across all of that card's transactions.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
TRANSACTION_CSV = DATA_DIR / "train_transaction.csv"
IDENTITY_CSV = DATA_DIR / "train_identity.csv"

# A cluster counts as abusive if its members' transaction-weighted real fraud
# rate is at least this high.
#
# Chosen as ~3x the measured population base rate (4.88% among identity-matched
# rows), not picked to flatter the result. Measured cluster fraud-rate
# distribution after rarity-weighted linking: p50=0.00, p90=0.11, p95=0.21,
# p99=0.48, max=0.67 — so this threshold selects the genuinely concentrated
# tail (~8% of clusters) while leaving enough positives to train on.
# A stricter 0.35 leaves only 8 positive clusters across all three splits,
# which is too few to fit or evaluate honestly.
ABUSIVE_CLUSTER_FRAUD_RATE = 0.15

TX_COLS = [
    "TransactionID", "isFraud", "TransactionDT", "TransactionAmt",
    "card1", "card2", "addr1", "P_emaildomain",
]
ID_COLS = ["TransactionID", "DeviceInfo", "DeviceType", "id_30", "id_31", "id_33"]


def _hash(value: object, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{value}".encode()).hexdigest()[:12]


def _composite_device_fingerprint(row: pd.Series) -> str:
    """DeviceInfo alone is far too coarse ('Windows' covers tens of thousands
    of rows). Combining device + OS version + browser version + screen
    resolution yields a fingerprint specific enough to be a real linking
    signal rather than a demographic bucket."""
    parts = [row.get("DeviceInfo"), row.get("id_30"), row.get("id_31"), row.get("id_33")]
    known = [str(p) for p in parts if pd.notna(p)]
    if len(known) < 2:  # too little information to link on — give it a unique id
        return _hash(row.get("TransactionID"), "unlinkable-device")
    return _hash("|".join(known), "device")


def load_accounts(nrows: int | None = 200_000) -> pd.DataFrame:
    """Build an account-level table from real transactions, shaped to match
    dataset.py's output so the existing graph/detector pipeline runs unchanged."""
    if not (TRANSACTION_CSV.exists() and IDENTITY_CSV.exists()):
        raise FileNotFoundError(
            f"Real IEEE-CIS data not found in {DATA_DIR}. "
            "Download train_transaction.csv and train_identity.csv from "
            "https://huggingface.co/datasets/aliceczr/ieee-fraud-detection"
        )

    tx = pd.read_csv(TRANSACTION_CSV, usecols=TX_COLS, nrows=nrows)
    idn = pd.read_csv(IDENTITY_CSV, usecols=ID_COLS)
    df = tx.merge(idn, on="TransactionID", how="inner")
    df["device_fp"] = df.apply(_composite_device_fingerprint, axis=1)

    rows = []
    for card1, g in df.groupby("card1"):
        n_tx = len(g)
        # dominant device / address / email for this card entity
        device = g["device_fp"].mode().iloc[0] if not g["device_fp"].mode().empty else _hash(card1, "dev")
        addr = g["addr1"].mode().iloc[0] if g["addr1"].notna().any() else None
        email = g["P_emaildomain"].mode().iloc[0] if g["P_emaildomain"].notna().any() else None
        issuer = g["card2"].mode().iloc[0] if g["card2"].notna().any() else None

        # temporal spread of this entity's activity, in hours
        dt_span_hours = float((g["TransactionDT"].max() - g["TransactionDT"].min()) / 3600.0)

        rows.append({
            "account_id": _hash(card1, "acct"),
            # ---- linkable attributes (map onto graph.py's ATTR_WEIGHTS) ----
            "device_fingerprint": device,
            "shipping_address_hash": _hash(addr, "addr") if addr is not None else _hash(card1, "addr-unique"),
            "payout_account_hash": _hash(issuer, "issuer") if issuer is not None else _hash(card1, "issuer-unique"),
            "ip_subnet": _hash(email, "email") if email is not None else _hash(card1, "email-unique"),
            # ---- behavioural features (NO fraud-derived field here: the
            #      cluster label is fraud-derived, so using per-account fraud
            #      rate as a feature would leak the label) ----
            "order_count": int(n_tx),
            "avg_order_value": round(float(g["TransactionAmt"].mean()), 2),
            "account_age_days": round(dt_span_hours / 24.0, 2),
            "activity_span_hours": round(dt_span_hours, 2),
            "distinct_devices_used": int(g["device_fp"].nunique()),
            "distinct_emails_used": int(g["P_emaildomain"].nunique()),
            "amount_std": round(float(g["TransactionAmt"].std(ddof=0)), 2),
            # ---- ground truth (real audited labels; used for evaluation only) ----
            "n_fraud_tx": int(g["isFraud"].sum()),
            "account_fraud_rate": round(float(g["isFraud"].mean()), 4),
        })

    accounts = pd.DataFrame(rows)
    # fields the shared pipeline expects but real data doesn't carry
    accounts["refund_rate"] = 0.0
    accounts["refund_count"] = 0
    accounts["promo_usage_count"] = 0
    accounts["kyc_verified"] = True
    accounts["signup_date"] = "2017-12-01T00:00:00"
    accounts["ring_id"] = None
    accounts["is_ring_member"] = False
    return accounts


def label_clusters(cluster_df: pd.DataFrame, accounts: pd.DataFrame) -> pd.DataFrame:
    """Replace the synthetic ring label with the real-fraud-rate proxy label.
    See this module's docstring: this is 'elevated real fraud rate', not
    'confirmed ring'."""
    fraud_by_account = accounts.set_index("account_id")["account_fraud_rate"]
    tx_by_account = accounts.set_index("account_id")["order_count"]

    labels, rates = [], []
    for members in cluster_df["member_ids"]:
        present = [m for m in members if m in fraud_by_account.index]
        if not present:
            labels.append(0); rates.append(0.0); continue
        # transaction-weighted fraud rate across the cluster
        w = tx_by_account.loc[present]
        r = float((fraud_by_account.loc[present] * w).sum() / max(w.sum(), 1))
        rates.append(round(r, 4))
        labels.append(int(r >= ABUSIVE_CLUSTER_FRAUD_RATE))

    out = cluster_df.copy()
    out["label"] = labels
    out["cluster_fraud_rate"] = rates
    return out


if __name__ == "__main__":
    a = load_accounts()
    print(f"accounts (unique card1 entities): {len(a)}")
    print(f"transactions represented: {a['order_count'].sum()}")
    print(f"accounts with >=1 real fraud tx: {(a['n_fraud_tx'] > 0).sum()}")
    print(f"population fraud rate: {a['n_fraud_tx'].sum() / a['order_count'].sum():.4f}")
