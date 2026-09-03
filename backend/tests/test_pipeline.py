from app.core import baseline, dataset, detector
from app.core.graph import build_graph, find_clusters


def _pipeline(n_legit=600, n_rings=12):
    accounts = dataset.generate_accounts(n_legit=n_legit, n_rings=n_rings)
    g = build_graph(accounts)
    clusters = find_clusters(g)
    cluster_df = detector.build_cluster_table(clusters, accounts)
    return accounts, cluster_df


def test_cluster_table_has_required_features():
    _, cluster_df = _pipeline()
    for feat in detector.FEATURES:
        assert feat in cluster_df.columns
    assert set(cluster_df["split"]).issubset({"train", "val", "test"})
    assert set(cluster_df["label"]).issubset({0, 1})


def test_edge_density_is_bounded():
    _, cluster_df = _pipeline()
    assert (cluster_df["edge_density"] >= 0).all()
    assert (cluster_df["edge_density"] <= 1.0001).all()


def test_train_then_evaluate_runs_without_error_and_returns_metrics():
    _, cluster_df = _pipeline(n_legit=1200, n_rings=25)
    clf = detector.train(cluster_df)
    result = detector.evaluate(clf, cluster_df, "test")
    if result.get("n_clusters", 0) > 0:
        assert 0 <= result["cluster_precision"] <= 1
        assert 0 <= result["cluster_recall"] <= 1


def test_scored_clusters_have_probability_in_unit_range():
    _, cluster_df = _pipeline(n_legit=1200, n_rings=25)
    clf = detector.train(cluster_df)
    scored = detector.score_clusters(clf, cluster_df)
    assert (scored["abuse_score"] >= 0).all() and (scored["abuse_score"] <= 1).all()


def test_baseline_flags_every_candidate_cluster():
    _, cluster_df = _pipeline(n_legit=1200, n_rings=25)
    result = baseline.run_baseline(cluster_df, "test")
    test_n = len(cluster_df[cluster_df["split"] == "test"])
    if test_n:
        assert result["n_clusters_flagged"] == test_n
        assert result["cluster_recall"] == 1.0


def test_no_rings_produces_no_ring_ground_truth():
    accounts = dataset.generate_accounts(n_legit=300, n_rings=0)
    assert accounts["is_ring_member"].sum() == 0
