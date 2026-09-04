# Business Case — Order-of-Magnitude Estimate

Every number below is either a cited public figure or an explicitly labeled assumption. Nothing here is a Razorpay-disclosed figure or a claim about this system's real-world performance — it's a back-of-envelope sizing exercise, presented as one.

## Inputs (cited)
- Razorpay processes **$180B annualized TPV** across 12M+ merchants; **retail & e-commerce accounts for $110B** of that. — [digitalinasia.com](https://digitalinasia.com/razorpay-explained/), [coinlaw.io](https://coinlaw.io/razorpay-statistics/)
- Industry-wide benchmark: **e-commerce businesses lose an average of 2.9% of total revenue to fraud annually** (US-centric aggregate figure; applied here illustratively, not as an India-specific measurement). — [cropink.com eCommerce Fraud Statistics 2025](https://cropink.com/ecommerce-fraud-statistics)

## Assumption (labeled, not cited — no public split exists)
Not all e-commerce fraud is coordinated, multi-account abuse — stolen cards, single-account friendly-fraud chargebacks, and other categories make up part of that 2.9%. No public source splits this cleanly. We use an illustrative **3%–10% range** for the share of total fraud loss that is specifically linked/multi-account in nature, and show the sensitivity across that range rather than picking one number to look precise.

## The math
```
$110B retail/e-commerce TPV
  × 2.9%  (industry fraud-loss benchmark)
  = $3.19B/year total fraud exposure in that segment (illustrative)

  × 3%–10%  (assumed share that is coordinated/linked-account abuse)
  = $96M–$319M/year
  ≈ ₹800 crore – ₹2,650 crore/year addressable coordinated-abuse exposure
    (at ~₹83/$; illustrative range, not a measured figure)
```

## Cost to run
This system's marginal cost per account scored is near-zero: the graph construction and classifier are a standard scikit-learn model (no GPU, no per-call API cost), and the case-file reasoning layer runs on a deterministic template by default — no LLM API key required, no per-request cost, no rate limit. The only cost that scales is periodic retraining and infrastructure to run the graph query at Razorpay's actual account volume (see `SCALE.md` for what that requires).

## The honest caveat, again
This is a market-sizing exercise built on public benchmarks applied to Razorpay's own disclosed volume — it is not a claim about how much of that ₹800cr–2,650cr this specific system would actually recover, which depends on real-world precision/recall at scale that this project has not measured (see `EVALUATION.md`'s small-test-n caveat). It's presented to show the addressable problem is large enough to matter, not to claim a specific recovery number.
