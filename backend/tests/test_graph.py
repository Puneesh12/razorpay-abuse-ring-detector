import pandas as pd

from app.core.graph import build_graph, find_clusters, MIN_EDGE_WEIGHT


def _acct(aid, device=None, ip=None, payout=None, addr=None):
    return dict(account_id=aid, device_fingerprint=device or f"dev_{aid}", ip_subnet=ip or f"ip_{aid}",
                payout_account_hash=payout or f"pay_{aid}", shipping_address_hash=addr or f"addr_{aid}",
                signup_date="2026-01-01T00:00:00", account_age_days=10,
                order_count=1, refund_count=0, refund_rate=0.0, avg_order_value=100.0,
                promo_usage_count=0, distinct_devices_used=1, kyc_verified=True,
                ring_id=None, is_ring_member=False)


def test_shared_device_and_payout_forms_edge_above_threshold():
    df = pd.DataFrame([
        _acct("a1", device="shared", payout="shared"),
        _acct("a2", device="shared", payout="shared"),
        _acct("a3", device="unique1", payout="unique1"),
    ])
    g = build_graph(df)
    assert g.has_edge("a1", "a2")
    assert g["a1"]["a2"]["weight"] >= MIN_EDGE_WEIGHT
    assert not g.has_edge("a1", "a3")


def test_ip_only_overlap_alone_is_filtered_as_weak():
    df = pd.DataFrame([
        _acct("a1", ip="shared_ip"),
        _acct("a2", ip="shared_ip"),
    ])
    g = build_graph(df)
    # IP-only weight (1.0) is below MIN_EDGE_WEIGHT (2.0) -> edge dropped
    assert not g.has_edge("a1", "a2")


def test_clusters_require_min_size():
    df = pd.DataFrame([
        _acct("a1", device="shared", payout="shared"),
        _acct("a2", device="shared", payout="shared"),
        _acct("a3"),
    ])
    g = build_graph(df)
    clusters = find_clusters(g)
    assert len(clusters) == 1
    assert set(clusters[0].member_ids) == {"a1", "a2"}


def test_combining_two_weak_signals_can_form_a_cluster():
    # device alone (3.0) already exceeds threshold on its own; use ip (1.0) x2 types instead
    df = pd.DataFrame([
        _acct("a1", ip="shared_ip", addr="shared_addr"),
        _acct("a2", ip="shared_ip", addr="shared_addr"),
    ])
    g = build_graph(df)
    assert g.has_edge("a1", "a2")
    assert g["a1"]["a2"]["weight"] == 3.0  # ip(1.0) + addr(2.0)
