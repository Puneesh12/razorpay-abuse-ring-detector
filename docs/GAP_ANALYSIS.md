# Gap Analysis — Why This Is Not a Clone

## Corrected after checking, not assumed
An earlier draft of this document claimed "nothing at Razorpay does cross-account correlation." That was wrong, and it was wrong because it wasn't checked before being asserted. Here is the checked version.

## What already exists
1. **Third-party industry tools** — SEON, Sift, and Forter already do device/IP/address/payment-method linking and graph-based multi-accounting detection. This is a known, named category ("link analysis" / "network fraud detection"), not a novel insight.
2. **Razorpay's own Thirdwatch** — an existing AI fraud-detection product that does device fingerprinting, identifies "device clusters" tied to multiple orders under different identities, and explicitly claims a **network effect**: it pools anonymized data across Razorpay's merchant base to learn fraud patterns, not just within one merchant. Publicly described behavior: it **automatically flags or blocks** high-risk transactions.

Sources: [seon.io network-risk-scoring](https://seon.io/resources/network-risk-scoring-link-analysis-fraud-detection/), [Razorpay Thirdwatch ML blog](https://razorpay.com/blog/detect-fraud-using-ml-ai-thirdwatch/), [Razorpay fraud-risk guide](https://razorpay.com/blog/payment-gateways-reduce-fraud-risk).

## So what's the actual, honest gap?
Narrower than "nobody does this," but real:

1. **Auto-block vs. human review.** Thirdwatch, as publicly described, automatically flags or blocks. This system never does — every output is `no_action`, `queue_for_review`, or `priority_review`. That's not a stylistic choice; it's the disqualifying rule for the track this was built for ("anything offense-capable is disqualified"). An auto-blocking system, however accurate, cannot compete in this track by its own rules.
2. **Black-box score vs. named, inspectable case file.** Nothing public shows Thirdwatch producing a case file that names the specific linked accounts, the specific shared attribute, and a plain-English argument a human can independently verify. This system does exactly that for every flagged cluster.
3. **No published evaluation methodology.** Razorpay's marketing describes Thirdwatch's effectiveness in general terms — no disclosed precision/recall, no false-positive cost, no stated held-out methodology. This system publishes all three, including the honest small-test-n caveat, in `EVALUATION.md`.

## The one-sentence pitch, corrected
Not "we found a gap nobody's covering." It's: **this is the accountable, human-reviewed layer that sits where an auto-blocking black box currently sits — same signal (linked-account graphs), different guarantee (a human sees the evidence before anyone is punished).**

## Why this framing is actually the stronger one
An auto-blocking system with no published precision/recall and no human-readable justification is a real production risk, not a hypothetical one — a wrongly-blocked legitimate cluster (see `EVALUATION.md`'s worked example: three accounts sharing one address, registered over a year apart, zero refunds, fully KYC-verified) has a real cost to a real customer, with no visible way to catch it before it happens. Making that failure mode visible and reviewable is a genuine, defensible product, not a smaller version of the same idea.
