"""
Rarity-weighted graph construction, for real-world attribute distributions.

WHY THIS EXISTS SEPARATELY FROM graph.py:
graph.py assumes an attribute value shared by two accounts is evidence of a
link. That holds in synthetic data, where every planted ring shares a unique
device/payout/address. It is badly wrong on real data.

Measured on IEEE-CIS (6,412 real card entities):
    email domain      — largest shared value covers 2,747 accounts (gmail.com)
    card issuer       — largest covers 2,099 accounts (one bank)
    billing region    — largest covers   554 accounts
    device+OS+browser — largest covers   254 accounts (Windows/Chrome/1080p)

Linking naively on those collapses 5,977 of 6,412 accounts into a single
connected "hairball" component — a graph that says everyone is connected to
everyone, which is the same as saying nothing.

The fix is the standard link-analysis technique: an attribute value's
evidentiary weight is inversely proportional to how many accounts share it
(the same intuition as IDF in TF-IDF). "We both use Gmail" is not evidence.
"We both used this exact device fingerprint that only 3 accounts in the
population have ever used" is strong evidence.
"""
from __future__ import annotations

import math

import networkx as nx
import pandas as pd

from .graph import Cluster

# an attribute value shared by more than this many accounts is a demographic
# bucket, not an identifier — it creates no edges at all.
MAX_GROUP_SIZE_TO_LINK = 12

# base importance per attribute type, before rarity weighting
ATTR_BASE_WEIGHT = {
    "device_fingerprint": 3.0,
    "payout_account_hash": 2.5,
    "shipping_address_hash": 2.0,
    "ip_subnet": 1.0,
}

MIN_EDGE_WEIGHT = 2.0


def rarity_weight(group_size: int, population: int) -> float:
    """IDF-style: log(population / group_size). A value shared by 2 accounts
    in a population of 6,000 scores ~8; one shared by 2,000 scores ~1.1."""
    return math.log(population / max(group_size, 1))


def build_graph_rarity_weighted(df: pd.DataFrame) -> nx.Graph:
    g = nx.Graph()
    g.add_nodes_from(df["account_id"])
    population = len(df)

    for attr, base in ATTR_BASE_WEIGHT.items():
        if attr not in df.columns:
            continue
        for _, members in df.groupby(attr)["account_id"].apply(list).items():
            size = len(members)
            if size < 2 or size > MAX_GROUP_SIZE_TO_LINK:
                continue  # unique, or a demographic bucket — no evidence either way
            w = base * rarity_weight(size, population)
            for i in range(size):
                for j in range(i + 1, size):
                    a, b = members[i], members[j]
                    if g.has_edge(a, b):
                        g[a][b]["weight"] += w
                        g[a][b]["attrs"].append(attr)
                    else:
                        g.add_edge(a, b, weight=w, attrs=[attr])

    weak = [(a, b) for a, b, d in g.edges(data=True) if d["weight"] < MIN_EDGE_WEIGHT]
    g.remove_edges_from(weak)
    return g


def find_clusters_real(g: nx.Graph, min_size: int = 2, max_size: int = 60) -> list[Cluster]:
    """Same as graph.find_clusters, but drops any component large enough to be
    a hairball artefact rather than a coordinated group."""
    clusters = []
    for i, comp in enumerate(nx.connected_components(g)):
        if len(comp) < min_size or len(comp) > max_size:
            continue
        members = sorted(comp)
        sub = g.subgraph(members)
        clusters.append(Cluster(
            cluster_id=f"cluster_{i}",
            member_ids=members,
            edges=[(a, b, dict(d)) for a, b, d in sub.edges(data=True)],
        ))
    return clusters
