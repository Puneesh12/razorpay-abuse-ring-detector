import type { AskResponse, ClusterDetail, EvaluationResults, GraphSnapshot } from "@/types/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8421";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${path}${body ? `: ${body}` : ""}`);
  }
  return res.json() as Promise<T>;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${path}${text ? `: ${text}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => getJSON<{ status: string }>("/api/health"),
  metrics: () => getJSON<EvaluationResults>("/api/metrics"),
  graph: (split: "train" | "val" | "test" | "all" = "test", limitClusters = 40) =>
    getJSON<GraphSnapshot>(`/api/graph?split=${split}&limit_clusters=${limitClusters}`),
  cluster: (clusterId: string) => getJSON<ClusterDetail>(`/api/cluster/${encodeURIComponent(clusterId)}`),
  // Read-only investigation agent (backend/app/core/investigate.py) -- see
  // AskResponse's doc comment. Never mutates anything server-side.
  askCluster: (clusterId: string, question: string) =>
    postJSON<AskResponse>(`/api/cluster/${encodeURIComponent(clusterId)}/ask`, { question }),
  assetUrl: (path: string) => `${BASE}${path}`,
};
