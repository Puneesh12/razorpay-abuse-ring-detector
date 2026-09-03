"""
Shared-attribute graph construction and clustering.

WHY GRAPH/RULES HERE, NOT ML: whether two accounts share a device fingerprint,
payout account, or shipping address is a deterministic fact, not a prediction.
Building the graph and finding connected clusters is the correct tool for
"who is structurally connected to whom" — an ML model would be solving a
problem that doesn't require learning. ML enters later (detector.py), scoring
*whether a cluster's behaviour looks abusive*, which genuinely is a prediction
problem.
"""
from __future__ import annotations

from dataclasses import dataclass

import networkx as nx
import pandas as pd

# edge weight per shared attribute type — device/payout are hard-to-fake
# strong signals; shared IP subnet alone is common and weak (same building/wifi).
ATTR_WEIGHTS = {
    "device_fingerprint": 3.0,
    "payout_account_hash": 3.0,
    "shipping_address_hash": 2.0,
    "ip_subnet": 1.0,
}
# an edge must reach this combined weight to be kept — filters out lone weak
# (IP-only) coincidences from forming a cluster by themselves.
MIN_EDGE_WEIGHT = 2.0


def build_graph(df: pd.DataFrame) -> nx.Graph:
    g = nx.Graph()
    g.add_nodes_from(df["account_id"])

    for attr, weight in ATTR_WEIGHTS.items():
        groups = df.groupby(attr)["account_id"].apply(list)
        for _, members in groups.items():
            if len(members) < 2 or len(members) > 400:  # skip null/placeholder-scale buckets
                continue
            for i in range(len(members)):
                for j in range(i + 1, len(members)):
                    a, b = members[i], members[j]
                    if g.has_edge(a, b):
                        g[a][b]["weight"] += weight
                        g[a][b]["attrs"].append(attr)
                    else:
                        g.add_edge(a, b, weight=weight, attrs=[attr])

    # drop edges that never reached the minimum combined weight
    weak = [(a, b) for a, b, d in g.edges(data=True) if d["weight"] < MIN_EDGE_WEIGHT]
    g.remove_edges_from(weak)
    return g


@dataclass
class Cluster:
    cluster_id: str
    member_ids: list[str]
    edges: list[tuple[str, str, dict]]


def find_clusters(g: nx.Graph, min_size: int = 2) -> list[Cluster]:
    clusters = []
    for i, comp in enumerate(nx.connected_components(g)):
        if len(comp) < min_size:
            continue
        members = sorted(comp)
        sub = g.subgraph(members)
        edges = [(a, b, dict(d)) for a, b, d in sub.edges(data=True)]
        clusters.append(Cluster(cluster_id=f"cluster_{i}", member_ids=members, edges=edges))
    return clusters
