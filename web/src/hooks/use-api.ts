"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { ClusterDetail, EvaluationResults, GraphSnapshot } from "@/types/api";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify([...deps, tick]);

  // React-endorsed "adjust state when a dependency changes" pattern (see
  // react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes):
  // reset to loading synchronously during render, not via a setState call in
  // the effect body, which the newer react-hooks lint rules correctly flag
  // as a cascading-render risk.
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setState((s) => ({ ...s, loading: true, error: null }));
  }

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, refetch };
}

export function useMetrics() {
  return useAsync<EvaluationResults>(() => api.metrics(), []);
}

export function useGraph(split: "train" | "val" | "test" | "all" = "test", limitClusters = 40) {
  return useAsync<GraphSnapshot>(() => api.graph(split, limitClusters), [split, limitClusters]);
}

export function useCluster(clusterId: string | null) {
  return useAsync<ClusterDetail>(
    () => (clusterId ? api.cluster(clusterId) : Promise.reject(new Error("no cluster id"))),
    [clusterId]
  );
}
