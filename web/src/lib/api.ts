import type { ClusterDetail, EvaluationResults, GraphSnapshot } from "@/types/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8421";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${path}${body ? `: ${body}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => getJSON<{ status: string }>("/api/health"),
  metrics: () => getJSON<EvaluationResults>("/api/metrics"),
  graph: (split: "train" | "val" | "test" | "all" = "test", limitClusters = 40) =>
    getJSON<GraphSnapshot>(`/api/graph?split=${split}&limit_clusters=${limitClusters}`),
  cluster: (clusterId: string) => getJSON<ClusterDetail>(`/api/cluster/${encodeURIComponent(clusterId)}`),
  assetUrl: (path: string) => `${BASE}${path}`,
};
