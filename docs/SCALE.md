# Scale Plan

This system currently runs against a synthetic dataset of ~4,000 accounts on a single machine, in-memory, using `networkx`. That's a demo scale, not a production one. This document states plainly what changes to run it at Razorpay's real account volume — it describes a credible plan, not something already built.

## What's true today (small scale)
- Edge construction: `pandas.groupby` over each attribute column, O(n) per attribute, all in memory (`backend/app/core/graph.py`).
- Cluster finding: `networkx.connected_components`, O(V + E), single machine.
- Cluster scoring: a scikit-learn `GradientBoostingClassifier` over per-cluster features, trivially fast at hundreds of clusters.

None of this holds at millions of accounts on one machine. Here's what does.

## 1. Edge construction is already embarrassingly parallel
Grouping accounts by a shared attribute value (device fingerprint, payout account, address) is exactly a `GROUP BY` — this maps directly onto a distributed engine (Spark, or a straight SQL self-join in a warehouse) with no algorithmic change, only an engine swap. This is the easy part; it was designed this way from the start specifically because it doesn't require inventing new infrastructure.

## 2. Connected components at scale is a solved problem
Single-machine `networkx` doesn't hold past low millions of edges, but distributed connected-components algorithms do — Spark GraphX and GraphFrames ship a built-in `connectedComponents()` that runs the same underlying algorithm (BFS-style label propagation) across a cluster. The graph logic in this project doesn't change; the execution engine does.

## 3. Don't rebuild the whole graph on every transaction
A real system shouldn't recompute the full account graph on every new signup. The right model is incremental: maintain a disjoint-set (union-find) structure keyed by attribute value, so a new account triggers O(α(n)) (effectively constant) union operations against existing clusters instead of a full batch rebuild. This is standard practice for streaming graph systems and doesn't require anything exotic — just not recomputing from scratch, which is what today's demo does for simplicity.

## 4. Attribute lookups need a real index
`pandas.groupby` on a CSV doesn't hold past a few million rows. In production this is an indexed lookup — a hash/inverted index on `device_fingerprint`, `payout_account_hash`, `shipping_address_hash`, so "who else has this device fingerprint" is an O(1)-ish index hit, not a full scan. A key-value store or a purpose-built graph database (Neptune, Neo4j) both fit here.

## 5. Cluster scoring stays cheap regardless of account volume
This is the one part of the pipeline that doesn't get harder at scale: the classifier scores *clusters*, not accounts, and even at Razorpay's full volume, the number of clusters that actually contain a shared-attribute edge is a small fraction of total accounts (most accounts share nothing with anyone). Scoring is independent per cluster, so it parallelizes trivially with no architecture change needed.

## 6. Latency requirement is relaxed by design
Because this system never auto-blocks — every output is a review-queue decision — it does not need real-time, sub-second scoring the way a checkout-blocking fraud system would. Hourly or daily batch re-scoring of newly-touched clusters is sufficient for a human-review queue. That relaxation is a direct consequence of the defense-only design choice, not an afterthought.

## Honest summary
Every piece of this plan maps to a known, existing distributed-systems pattern (Spark GraphX, incremental union-find, indexed attribute lookup, batch scoring) — none of it is a research problem. What's not yet true is that any of it is built; the current implementation is a correct, honest single-machine demo, and this document is the credible path from that demo to Razorpay's actual account volume, not a claim that the path has already been walked.
