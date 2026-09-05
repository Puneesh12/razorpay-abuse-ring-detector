// Typed shapes for the existing FastAPI backend responses.
// Every field here is real and returned by backend/app/main.py — nothing is invented.

export type PolicyAction = "no_action" | "queue_for_review" | "priority_review";

export interface DetectorSplitMetrics {
  n_clusters: number;
  n_accounts_in_clusters: number;
  cluster_precision: number;
  cluster_recall: number;
  cluster_f1: number;
  cluster_roc_auc: number | null;
  account_precision: number;
  account_recall: number;
  false_positive_clusters: number;
  false_negative_clusters: number;
  true_positive_clusters: number;
}

export interface PolicyRunSplit {
  n_clusters_evaluated: number;
  n_flagged: number;
  n_priority_review: number;
  n_standard_review: number;
  n_accounts_wrongly_flagged: number;
  n_accounts_correctly_flagged: number;
  false_positive_cost_inr: number;
  estimated_loss_caught_inr: number;
  estimated_loss_missed_inr: number;
}

export interface BaselineSplit {
  n_clusters_flagged: number;
  true_positive_clusters: number;
  false_positive_clusters: number;
  cluster_precision: number;
  cluster_recall: number;
  n_accounts_wrongly_flagged: number;
  n_accounts_correctly_flagged: number;
  false_positive_cost_inr: number;
  estimated_loss_caught_inr: number;
}

export interface EvaluationResults {
  generated_at: string;
  dataset: {
    n_accounts: number;
    n_ring_accounts_ground_truth: number;
    n_rings_ground_truth: number;
    n_clusters_found: number;
  };
  detector_metrics: {
    validation: DetectorSplitMetrics;
    held_out_test: DetectorSplitMetrics;
  };
  policy_run_test_split: PolicyRunSplit;
  baseline_graph_only_test_split: BaselineSplit;
  comparison: {
    fp_cost_reduction_inr: number;
    fp_accounts_reduction: number;
  };
}

export type SharedAttribute =
  | "device_fingerprint"
  | "ip_subnet"
  | "payout_account_hash"
  | "shipping_address_hash";

export interface GraphAccountNode {
  id: string;
  cluster_id: string;
  abuse_score: number;
  action: PolicyAction;
  is_ring: boolean;
  kyc_verified: boolean;
  refund_rate: number;
  device_fingerprint: string;
  ip_subnet: string;
  payout_account_hash: string;
  shipping_address_hash: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  attrs: SharedAttribute[];
}

export interface GraphCluster {
  cluster_id: string;
  size: number;
  abuse_score: number;
  action: PolicyAction;
  reason: string;
  ground_truth_is_ring: boolean;
  mean_refund_rate: number;
  registration_burstiness_hours: number;
  device_reuse_ratio: number;
  payout_reuse_ratio: number;
  kyc_verified_ratio: number;
}

export interface GraphSnapshot {
  nodes: GraphAccountNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
}

export interface ClusterMember {
  account_id: string;
  device_fingerprint: string;
  ip_subnet: string;
  payout_account_hash: string;
  shipping_address_hash: string;
  signup_date: string;
  account_age_days: number;
  order_count: number;
  refund_count: number;
  refund_rate: number;
  avg_order_value: number;
  promo_usage_count: number;
  distinct_devices_used: number;
  kyc_verified: boolean;
  ring_id: string | null;
  is_ring_member: boolean;
}

export interface ClusterFeatures {
  cluster_size: number;
  edge_density: number;
  mean_refund_rate: number;
  mean_account_age_days: number;
  mean_promo_usage: number;
  registration_burstiness_hours: number;
  device_reuse_ratio: number;
  payout_reuse_ratio: number;
  addr_reuse_ratio: number;
  kyc_verified_ratio: number;
  mean_order_value: number;
  distinct_attr_types: number;
}

export interface ClusterDetail {
  cluster_id: string;
  abuse_score: number;
  action: PolicyAction;
  reason: string;
  case_file: string;
  case_file_mode: "template" | "claude";
  features: ClusterFeatures;
  members: ClusterMember[];
  shared_attributes: SharedAttribute[];
}

// The investigation assistant (backend/app/core/investigate.py) is read-only
// by construction -- there is no tool in its schema that can flag, queue, or
// ban anything. It can only help a reviewer understand a decision already
// made by policy.py.
export interface ToolTraceEntry {
  tool: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
}

export type AskResponse =
  | { available: false; reason: string; tools_available: string[] }
  | { available: true; answer: string; tool_trace: ToolTraceEntry[] };
