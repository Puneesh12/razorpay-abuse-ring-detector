"""
API tests. No FastAPI endpoint had any test coverage before this file --
that's exactly how the /api/cluster/{id} 500 (NaN ring_id not JSON-serializable
for non-ring accounts) shipped undetected until manual verification caught it.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.evaluation import run_full_evaluation
from app.main import app


@pytest.fixture(scope="module", autouse=True)
def ensure_data():
    run_full_evaluation()


@pytest.fixture()
def client():
    return TestClient(app)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_metrics_returns_real_numbers(client):
    r = client.get("/api/metrics")
    assert r.status_code == 200
    body = r.json()
    assert body["dataset"]["n_accounts"] > 0
    assert "held_out_test" in body["detector_metrics"]


def test_graph_endpoint_serializes(client):
    r = client.get("/api/graph?split=test&limit_clusters=25")
    assert r.status_code == 200
    body = r.json()
    assert "nodes" in body and "clusters" in body


def test_cluster_detail_for_a_non_ring_cluster_does_not_500(client):
    """Regression test: non-ring accounts have ring_id=NaN in the CSV. The
    /api/cluster/{id} endpoint must convert that to JSON null, not crash."""
    # /api/graph returns clusters sorted by abuse_score DESC, so a small limit
    # returns only high-scoring (ring) clusters once the dataset has more rings
    # than the limit. Request enough to guarantee the low-scoring tail is
    # included — otherwise this fixture silently breaks whenever the dataset
    # grows, which is exactly what happened at 260 rings vs. limit=200.
    graph = client.get("/api/graph?split=all&limit_clusters=5000").json()
    non_ring_clusters = [c["cluster_id"] for c in graph["clusters"] if not c["ground_truth_is_ring"]]
    assert non_ring_clusters, "test fixture should contain at least one non-ring cluster"

    r = client.get(f"/api/cluster/{non_ring_clusters[0]}")
    assert r.status_code == 200
    body = r.json()
    assert body["members"], "cluster should have members"
    for member in body["members"]:
        assert "ring_id" in member  # present, and JSON-valid (None, not NaN)


def test_cluster_detail_unknown_id_is_404(client):
    r = client.get("/api/cluster/cluster_does_not_exist")
    assert r.status_code == 404


def test_cluster_detail_case_file_is_present(client):
    graph = client.get("/api/graph?split=test&limit_clusters=5").json()
    if not graph["clusters"]:
        pytest.skip("no clusters in this batch")
    cid = graph["clusters"][0]["cluster_id"]
    r = client.get(f"/api/cluster/{cid}")
    assert r.status_code == 200
    body = r.json()
    assert body["case_file"]
    assert body["case_file_mode"] in {"template", "claude"}
