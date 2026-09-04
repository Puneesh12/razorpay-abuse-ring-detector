export function formatInr(n: number | null | undefined): string {
  if (n == null) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n == null) return "—";
  return (n * 100).toFixed(digits) + "%";
}

export function formatHours(h: number): string {
  if (h < 24) return `${h.toFixed(0)}h`;
  const days = h / 24;
  if (days < 30) return `${days.toFixed(0)}d`;
  return `${(days / 30).toFixed(1)}mo`;
}

export const ACTION_LABEL: Record<string, string> = {
  priority_review: "Priority review",
  queue_for_review: "Standard review",
  no_action: "Cleared",
};

export const ACTION_DESCRIPTION: Record<string, string> = {
  priority_review: "Strong evidence of coordination. Routed to a senior reviewer before any pending payout settles.",
  queue_for_review: "Some evidence of coordination. Queued for standard review.",
  no_action: "No meaningful evidence of coordinated behaviour. Not flagged.",
};

interface SignalSource {
  cluster_size?: number;
  registration_burstiness_hours: number;
  device_reuse_ratio: number;
  payout_reuse_ratio: number;
  mean_refund_rate: number;
  kyc_verified_ratio: number;
}

/** The single strongest human-readable signal for a cluster — same ranking
 * logic as the inspector's full evidence list, condensed to one line for
 * list views. */
export function topSignal(c: SignalSource): string {
  if (c.registration_burstiness_hours < 96 && (c.cluster_size ?? 3) >= 3) {
    return `Signed up within ${formatHours(c.registration_burstiness_hours)}`;
  }
  if (c.device_reuse_ratio > 0.3) return `${formatPct(c.device_reuse_ratio, 0)} device reuse`;
  if (c.payout_reuse_ratio > 0.3) return `${formatPct(c.payout_reuse_ratio, 0)} payout reuse`;
  if (c.mean_refund_rate > 0.25) return `${formatPct(c.mean_refund_rate, 0)} refund rate`;
  if (c.kyc_verified_ratio < 0.5) return `${formatPct(c.kyc_verified_ratio, 0)} KYC-verified`;
  return "No strong individual signal";
}

export const FEATURE_LABEL: Record<string, string> = {
  cluster_size: "Linked accounts",
  edge_density: "Connection density",
  mean_refund_rate: "Average refund rate",
  mean_account_age_days: "Average account age",
  mean_promo_usage: "Average promo redemptions",
  registration_burstiness_hours: "Signup window",
  device_reuse_ratio: "Device reuse",
  payout_reuse_ratio: "Payout account reuse",
  addr_reuse_ratio: "Address reuse",
  kyc_verified_ratio: "KYC-verified share",
  mean_order_value: "Average order value",
  distinct_attr_types: "Distinct shared-attribute types",
};
