"""
Synthetic merchant-account dataset with embedded collusion rings.

Generates a population of accounts, most independent and legitimate, with a
minority organized into "rings" that share identifying attributes (device
fingerprint, payout account, shipping address) to run coordinated abuse
(refund fraud, promo farming, fake-return abuse).

Realism / non-triviality knobs, deliberately included so a naive
"any shared attribute = fraud" rule is NOT sufficient (see baseline.py):
  - A slice of legitimate accounts coincidentally share attributes (same
    office wifi -> same IP subnet; family members -> same shipping address)
    without being fraudulent. These are the real false-positive risk.
  - Not every ring shares every attribute type — some only share a payout
    account, some only a device, forcing the graph to combine weak signals.
  - Ring accounts have elevated but NOT extreme refund/promo rates (a
    ring that refunds 100% of orders would be caught by a trivial rule);
    values overlap with the legitimate population's tail.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

RNG_SEED = 7


def _hash_id(prefix: str, i: int, seed: int) -> str:
    return hashlib.sha256(f"{prefix}-{i}-{seed}".encode()).hexdigest()[:12]


@dataclass
class Account:
    account_id: str
    device_fingerprint: str
    ip_subnet: str
    payout_account_hash: str
    shipping_address_hash: str
    signup_date: str
    account_age_days: float
    order_count: int
    refund_count: int
    refund_rate: float
    avg_order_value: float
    promo_usage_count: int
    distinct_devices_used: int
    kyc_verified: bool
    # ground truth — withheld from graph construction and from features
    ring_id: str | None
    is_ring_member: bool


def generate_accounts(n_legit: int = 24_000, n_rings: int = 260, seed: int = RNG_SEED) -> pd.DataFrame:
    """Population scale note: the earlier default (3,600 legit / 28 rings)
    produced a held-out test split containing only ~6 ring clusters. Reporting
    precision/recall on n=6 cannot distinguish a good model from a lucky
    sample. These defaults give roughly an order of magnitude more rings so
    the test split carries enough positives for the metrics to mean something.
    """
    rng = np.random.default_rng(seed)
    base_time = datetime(2026, 3, 1)
    rows: list[Account] = []

    # ---- legitimate population ----
    for i in range(n_legit):
        age = float(np.clip(rng.exponential(220), 3, 1800))
        signup = base_time - timedelta(days=age)
        orders = int(max(0, rng.poisson(6)))
        refunds = int(min(orders, rng.binomial(orders, 0.06))) if orders else 0
        rows.append(Account(
            account_id=_hash_id("acct", i, seed),
            device_fingerprint=_hash_id("dev", i, seed),
            ip_subnet=_hash_id("ip", i if rng.random() > 0.03 else int(rng.integers(0, n_legit)), seed)[:8],
            payout_account_hash=_hash_id("payout", i, seed),
            shipping_address_hash=_hash_id("addr", i if rng.random() > 0.02 else rng.integers(0, n_legit), seed),
            signup_date=signup.isoformat(),
            account_age_days=round(age, 1),
            order_count=orders,
            refund_count=refunds,
            refund_rate=round(refunds / orders, 3) if orders else 0.0,
            avg_order_value=round(float(np.clip(rng.lognormal(6.8, 0.7), 99, 40000)), 2),
            promo_usage_count=int(rng.poisson(1.2)),
            distinct_devices_used=int(max(1, rng.poisson(1.4))),
            kyc_verified=bool(rng.random() < 0.86),
            ring_id=None,
            is_ring_member=False,
        ))

    # ---- legitimate SHARED-CONTEXT groups (families, offices, apartment buildings) ----
    # Deliberately sized 3-6, overlapping with ring sizes (3-12): without this, every
    # legit coincidence is a lone pairwise fluke (~size 2) and every ring is size 3+,
    # which lets a classifier "cheat" by learning cluster_size alone instead of actual
    # behaviour. These groups force the model to learn the real signal.
    n_legit_groups = max(18, n_rings)
    idx = n_legit
    for lg in range(n_legit_groups):
        size = int(rng.integers(3, 7))
        share_addr = rng.random() < 0.6
        # a family/roommates on the same home wifi plausibly shares BOTH address and
        # IP -- don't make these mutually exclusive, or "how many attribute types are
        # shared" becomes its own giveaway feature the same way cluster_size was.
        share_ip = rng.random() < 0.45
        # A household genuinely shares a device — the family tablet, one home
        # desktop. Without this, device_reuse_ratio is identically 0.0 for every
        # legitimate group, so "shares a device at all" becomes a perfect
        # ring/legit discriminator and the model learns that instead of
        # behaviour. This is the realistic hard case: a shared device is
        # suspicious, but it is NOT proof.
        share_device = rng.random() < 0.35
        # Spouses on a joint account, a parent funding a child's account: a
        # shared payout destination is genuinely legitimate sometimes. Without
        # this, payout_reuse_ratio is identically 0.0 for legit groups and
        # becomes the next perfect discriminator after device sharing was fixed.
        share_payout = rng.random() < 0.22
        shared_addr = _hash_id("legitaddr", lg, seed)
        shared_ip = _hash_id("legitip", lg, seed)[:8]
        shared_legit_device = _hash_id("legitdev", lg, seed)
        shared_legit_payout = _hash_id("legitpay", lg, seed)
        # Registration spread for legitimate shared-context groups. Deliberately
        # NOT always "spread over months": a family opening accounts the same
        # evening, or an office onboarding a team in one batch, produces a tight
        # burst that looks exactly like a ring on this feature alone. Without
        # these, burstiness perfectly separates the classes and the model
        # degenerates into a single threshold on it.
        base_signup = base_time - timedelta(days=int(rng.integers(30, 900)))
        if rng.random() < 0.30:
            legit_spread_hours = float(rng.uniform(2, 200))     # same-day/week signup
        else:
            legit_spread_hours = float(rng.uniform(200, 5760))  # spread over months
        for k in range(size):
            signup = base_signup + timedelta(
                hours=float(rng.uniform(-legit_spread_hours / 2, legit_spread_hours / 2))
            )
            age = max(3.0, (base_time - signup).total_seconds() / 86400)
            orders = int(max(0, rng.poisson(6)))
            # Legit refund propensity varies per group: most are low, but a
            # genuine minority (returns-heavy shoppers, a fashion household)
            # run high. A flat 6% made refund rate near-separable from rings.
            legit_refund_p = float(min(0.55, abs(rng.normal(0.08, 0.11))))
            refunds = int(min(orders, rng.binomial(orders, legit_refund_p))) if orders else 0
            rows.append(Account(
                account_id=_hash_id("lgacct", idx, seed),
                device_fingerprint=shared_legit_device if share_device else _hash_id("dev", idx, seed),
                ip_subnet=shared_ip if share_ip else _hash_id("ip", idx, seed)[:8],
                payout_account_hash=shared_legit_payout if share_payout else _hash_id("payout", idx, seed),
                shipping_address_hash=shared_addr if share_addr else _hash_id("addr", idx, seed),
                signup_date=signup.isoformat(),
                account_age_days=round(age, 1),
                order_count=orders,
                refund_count=refunds,
                refund_rate=round(refunds / orders, 3) if orders else 0.0,
                avg_order_value=round(float(np.clip(rng.lognormal(6.8, 0.7), 99, 40000)), 2),
                promo_usage_count=int(rng.poisson(1.2)),
                distinct_devices_used=int(max(1, rng.poisson(1.4))),
                kyc_verified=bool(rng.random() < 0.86),
                ring_id=None,
                is_ring_member=False,
            ))
            idx += 1

    # ---- collusion rings ----
    for r in range(n_rings):
        ring_id = f"ring_{r}"
        size = int(rng.integers(3, 13))
        burst_center = base_time - timedelta(days=int(rng.integers(5, 260)))
        # Registration spread. NOT a uniform tight burst: an earlier version used
        # uniform(1, 96)h for every ring while legit groups spread over ±120 days,
        # making the two ranges completely disjoint. The classifier then put 97%
        # of its weight on this one feature and scored a meaningless perfect 1.00
        # — a single `if burstiness < 200` rule matched it. Real rings vary: most
        # are quick, but a substantial minority are deliberately slow-burn to
        # evade exactly this signal. Heavy-tailed so the distributions OVERLAP
        # with the legit groups below.
        if rng.random() < 0.55:
            burst_spread_hours = float(rng.uniform(1, 96))          # fast ring
        elif rng.random() < 0.7:
            burst_spread_hours = float(rng.uniform(96, 1200))       # days-to-weeks
        else:
            burst_spread_hours = float(rng.uniform(1200, 6000))     # slow-burn ring

        # which attributes this ring actually shares (not all rings share everything)
        share_device = rng.random() < 0.55
        share_payout = rng.random() < 0.70
        share_addr = rng.random() < 0.45
        shared_device = _hash_id("ringdev", r, seed)
        shared_payout = _hash_id("ringpay", r, seed)
        shared_addr = _hash_id("ringaddr", r, seed)
        shared_ip = _hash_id("ringip", r, seed)[:8]

        for k in range(size):
            signup = burst_center + timedelta(hours=float(rng.uniform(-burst_spread_hours / 2, burst_spread_hours / 2)))
            age = max(1.0, (base_time - signup).total_seconds() / 86400)
            orders = int(max(1, rng.poisson(4)))
            # elevated but overlapping-with-legit refund/promo rates — not a giveaway
            refund_p = float(np.clip(rng.beta(2.2, 4.5), 0.05, 0.9))
            refunds = int(min(orders, rng.binomial(orders, refund_p)))
            rows.append(Account(
                account_id=_hash_id("racct", idx, seed),
                device_fingerprint=shared_device if share_device else _hash_id("dev", idx, seed),
                ip_subnet=shared_ip if rng.random() < 0.6 else _hash_id("ip", idx, seed)[:8],
                payout_account_hash=shared_payout if share_payout else _hash_id("payout", idx, seed),
                shipping_address_hash=shared_addr if share_addr else _hash_id("addr", idx, seed),
                signup_date=signup.isoformat(),
                account_age_days=round(age, 1),
                order_count=orders,
                refund_count=refunds,
                refund_rate=round(refunds / orders, 3) if orders else 0.0,
                avg_order_value=round(float(np.clip(rng.lognormal(6.5, 0.6), 99, 15000)), 2),
                promo_usage_count=int(rng.poisson(2.6)),
                distinct_devices_used=int(max(1, rng.poisson(1.1))) if share_device else int(max(1, rng.poisson(1.4))),
                kyc_verified=bool(rng.random() < 0.35),
                ring_id=ring_id,
                is_ring_member=True,
            ))
            idx += 1

    df = pd.DataFrame([asdict(a) for a in rows])
    return df.sample(frac=1.0, random_state=seed).reset_index(drop=True)


def split_accounts(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Hash-based, deterministic, disjoint split by account_id.

    NOTE (documented, not hidden): because this is a graph problem, cluster-level
    features for a test-split account can be influenced by train-split accounts
    in the same cluster (shared device/payout/address). This is standard for
    relational/graph settings (full transductive isolation is rarely possible)
    and is disclosed here and in docs/EVALUATION.md rather than presented as a
    clean iid holdout.
    """
    def bucket(account_id: str) -> str:
        h = int(hashlib.sha256(account_id.encode()).hexdigest(), 16) % 100
        if h < 60:
            return "train"
        if h < 80:
            return "val"
        return "test"

    df = df.copy()
    df["split"] = df["account_id"].apply(bucket)
    return {name: df[df["split"] == name].drop(columns=["split"]).reset_index(drop=True)
            for name in ["train", "val", "test"]}


if __name__ == "__main__":
    from pathlib import Path
    df = generate_accounts()
    out = Path(__file__).resolve().parents[3] / "data"
    out.mkdir(parents=True, exist_ok=True)
    df.to_csv(out / "accounts.csv", index=False)
    print(f"Generated {len(df)} accounts, {df['is_ring_member'].sum()} in {df['ring_id'].nunique()-1 if df['ring_id'].isna().any() else df['ring_id'].nunique()} rings")
