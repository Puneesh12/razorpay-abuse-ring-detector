# Real-Data Attempt — A Documented Negative Result

**Summary: we tried to train this on real transaction data. It doesn't work, and we can say precisely why. The synthetic dataset stays as the primary evaluation — not for convenience, but because no public dataset can support this task.**

## What we tried

Dataset: [IEEE-CIS Fraud Detection](https://huggingface.co/datasets/aliceczr/ieee-fraud-detection) — the 2019 Vesta/Kaggle competition data. Real e-commerce transactions with real, audited `isFraud` labels. Downloaded in full (no login needed via the HF mirror).

- **144,233 real transactions** (identity-matched subset of 590,540)
- **8,499 real card entities** (`card1` = Vesta's card fingerprint, used as the account entity)
- **4.88% real population fraud rate**

Code: `backend/app/core/real_dataset.py`, `graph_real.py`, `real_features.py`, `real_evaluation.py`. All runnable: `python -m app.core.real_evaluation`.

## Problem 1: real attribute distributions are heavy-tailed (the hairball)

The synthetic generator gives each ring a *unique* shared device/payout/address. Real data does not. Measured over 6,412 entities:

| Linking attribute | Largest single shared value covers |
|---|---|
| email domain | **2,747 accounts** (gmail.com) |
| card issuer (`card2`) | **2,099 accounts** (one bank) |
| billing region (`addr1`) | **554 accounts** |
| device+OS+browser+screen | **254 accounts** (Windows / Chrome 62 / 1080p) |

Linking naively on these collapsed **5,977 of 6,412 accounts into a single connected component**. A graph asserting everyone is connected to everyone says nothing at all.

**Fix applied** (`graph_real.py`): rarity-weighted linking — the standard link-analysis technique. An attribute value's evidentiary weight is `log(population / group_size)` (the IDF intuition), and any value shared by more than 12 accounts creates *no edge at all*, because it's a demographic bucket, not an identifier. This worked as intended: the hairball resolved into **395 sensible clusters, largest 37 accounts**.

## Problem 2: the label can only be a proxy

IEEE-CIS labels **transactions**, not collusion rings. Ring-membership labels are exactly what payment processors keep internal — no public dataset has them.

So the label here is: *cluster's transaction-weighted real fraud rate ≥ 0.15* (≈3× the 4.88% population base rate). This is a defensible proxy built from real audited outcomes — but it is **"a cluster with an elevated real fraud rate," not "a confirmed ring."** Different, weaker claim.

Encouragingly, the signal *did* exist at the cluster level: top clusters reached **48–67% fraud rate against a 4.88% base rate** — genuine 10x+ concentration in real data.

## Problem 3: the model still learns nothing — AUC ≈ 0.50

Three independent configurations, each honestly reported:

| Run | Setup | Held-out AUC | Precision | Recall |
|---|---|---|---|---|
| 1 | naive graph, synthetic-shaped features | 0.578 | 0.25 | 0.11 |
| 2 | rarity-weighted graph, real features | 0.505 | 0.00 | 0.00 |
| 3 | **full dataset** (8,499 entities, 571 clusters, 62 positives) | **0.5026** | 0.50 | 0.06 |

**AUC 0.50 is chance.** More data and better features did not help — run 3 had ~2× the entities and ~2× the positives of run 1 and performed no better.

(Run 1's apparently "better" 0.578 is not a real result: it came from the hairball graph, where a handful of giant components made cluster size trivially predictive of *something*. Once the graph was fixed, that artefact disappeared. Reporting it here because omitting the best-looking number would be dishonest in the opposite direction.)

## Why: the dataset has no true identifiers

IEEE-CIS's "identity" table is **not** identity in the fingerprinting sense. `DeviceInfo`, `id_30`–`id_33` are OS, browser version, and screen resolution — *demographic buckets*, not device UUIDs. There is:

- no true device identifier
- no shared payout/bank account destination
- no street address (only a coarse region code)
- no IP address

Coordinated abuse is detectable precisely *because* a ring reuses a hard-to-fake identifier. This dataset contains none, so once we correctly refuse to link on common values (Problem 1), the clusters that remain are largely **coincidental co-occurrence** — people who happen to share a browser build and a billing region. Those clusters have no reason to share a fraud outcome, and empirically they don't.

## Conclusion, and what it means for the submission

This is a genuine negative result, and it's more useful than a fabricated positive one:

1. **The synthetic dataset stays primary.** Not for convenience — because ring-membership ground truth doesn't exist publicly, and without it precision/recall on "did we find the ring" is unmeasurable.
2. **The mechanism is validated, the data isn't available.** The rarity-weighted linking fix (Problem 1) is a real improvement that came directly from touching real data, and it would apply unchanged inside Razorpay — where true device fingerprints, payout accounts, and addresses *do* exist.
3. **This is the honest version of "we tested on real data."** We did. It failed. Here's the measured reason. A submission claiming strong real-data numbers on IEEE-CIS for ring detection should be treated with suspicion, because the labels required to make that claim aren't in the dataset.

The single sentence: **the bottleneck is not the model, it's that public data has no unforgeable shared identifiers and no ring labels — which is exactly the data a payment processor has and an outsider doesn't.**
