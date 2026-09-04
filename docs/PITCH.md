# 5-Minute Pitch — Corrected Opening

## The opening line, changed on purpose
Not: *"We found a gap nobody's covering."*
Now: **"Razorpay already has a fraud AI that auto-blocks people. We built the version that has to explain itself first."**

That's not a weaker claim — checked against the panel that reviewed this idea, it's the one that consistently scored highest, because it's honest about the incumbent (Thirdwatch) instead of pretending it doesn't exist, and it leads with the actual differentiator (accountability) instead of a novelty claim that a five-minute Google search disproves.

## 0:00–0:30 — The problem, stated against the real incumbent
"Razorpay's Thirdwatch already does device-cluster fraud detection with network effects across their merchant base. As publicly described, it automatically flags or blocks. That's the problem: an auto-blocking black box with no published precision, no published false-positive cost, and no visible reasoning a human could check before someone gets punished."

## 0:30–1:00 — Why that's a real risk, not a hypothetical
Walk through `cluster_1147` live: three accounts, one shared address, registered 43/87/536 days apart, zero refunds, fully KYC-verified. "A system that flags on shared-attribute alone treats this exactly like a real ring. Ours doesn't — and here's why, in plain English, not a score."

## 1:00–1:45 — Our product
Graph → cluster → classifier → case file → policy. Emphasize: the classifier's decision is driven 93.5% by registration burstiness (a real behavioural signal) after we caught and fixed it cheating on cluster size — tell that story, it's a better trust signal than pretending the first model was perfect.

## 1:45–3:15 — Live demo
Run the batch. Click a flagged cluster — show the real case file. Click `cluster_1147` or an equivalent innocent cluster — show it correctly cleared.

## 3:15–4:00 — Why this matters at Razorpay's scale
"$110B/year in retail & e-commerce TPV. Even a conservative slice of industry-average fraud loss attributable to coordinated abuse is ₹800–2,650 crore/year of addressable exposure — full math and sources in the repo, every assumption labeled." Then: "None of this requires new infrastructure to prove out — the graph construction is already a `GROUP BY`, connected components at scale is a solved distributed-systems problem. That's in `docs/SCALE.md`."

## 4:00–4:30 — Measured results, stated honestly
"On the held-out test split: 100% precision, 100% recall, zero false positives, versus 69 wrongly-flagged accounts for the naive baseline. Small test set — six true ring examples — so this is a strong direction, not a statistically bulletproof claim. We say that on the landing page, not just in the docs."

## 4:30–5:00 — Why this matters to Razorpay
"Not a fourth fraud agent. The accountability layer that would let you trust the auto-blocker you already have — or replace its riskiest behaviour, the silent auto-block, with something a human can actually stand behind."
