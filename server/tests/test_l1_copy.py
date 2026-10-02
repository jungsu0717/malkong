"""서버의 L1 사본이 원본(src/data/l1)과 같은가 — 어긋나면 `uv run python -m scripts.sync_l1`."""

from scripts.sync_l1 import COPY_DIR, source_files


def test_copy_matches_source() -> None:
    sources = source_files()
    assert sources, "원본 L1 파일을 찾지 못했다"
    assert {p.name for p in COPY_DIR.glob("*.json")} == {p.name for p in sources}
    for src in sources:
        assert (COPY_DIR / src.name).read_bytes() == src.read_bytes(), (
            f"{src.name} 사본이 낡았다 — uv run python -m scripts.sync_l1"
        )


def test_empty_l1_fails_fast(tmp_path) -> None:
    import pytest

    from app.domain.knowledge.repository import L1Repository

    with pytest.raises(RuntimeError):
        L1Repository(tmp_path)
