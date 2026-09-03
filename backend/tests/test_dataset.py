from app.core.dataset import generate_accounts, split_accounts


def test_splits_disjoint_and_cover_all():
    df = generate_accounts(n_legit=400, n_rings=6)
    splits = split_accounts(df)
    ids = [set(p["account_id"]) for p in splits.values()]
    assert ids[0].isdisjoint(ids[1]) and ids[0].isdisjoint(ids[2]) and ids[1].isdisjoint(ids[2])
    assert sum(len(p) for p in splits.values()) == len(df)


def test_ring_accounts_exist_and_are_labeled():
    df = generate_accounts(n_legit=400, n_rings=6)
    ring_rows = df[df["is_ring_member"]]
    assert len(ring_rows) > 0
    assert ring_rows["ring_id"].notna().all()
    assert df[~df["is_ring_member"]]["ring_id"].isna().all()


def test_ring_size_within_bounds():
    df = generate_accounts(n_legit=400, n_rings=10)
    sizes = df[df["is_ring_member"]].groupby("ring_id").size()
    assert (sizes >= 3).all() and (sizes <= 12).all()


def test_legit_population_mostly_unique_attributes():
    df = generate_accounts(n_legit=1000, n_rings=0)
    # a small coincidental-overlap rate is intentional (see dataset.py docstring)
    assert df["device_fingerprint"].nunique() / len(df) > 0.95
