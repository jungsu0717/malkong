"""L1 판 확인 · 묶음 내려받기(task common/019) — 기기 키 없이, 승인된 항목만, 항목 스키마 그대로."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.domain.knowledge.repository import L1Repository
from app.domain.knowledge.router import get_l1_repository
from app.main import app

client = TestClient(app)
L1_DIR = Path(__file__).resolve().parent.parent / "app" / "data" / "l1"

ITEM_KEYS = {"id", "months", "kind", "title", "body", "source", "confidence", "red_flag", "status"}


def test_version_comes_from_version_file() -> None:
    expected = json.loads((L1_DIR / "version.json").read_text(encoding="utf-8"))["version"]
    res = client.get("/v1/knowledge/version")
    assert res.status_code == 200
    assert res.json() == {"version": expected}


def test_bundle_is_every_approved_item_as_written() -> None:
    res = client.get("/v1/knowledge/bundle")
    assert res.status_code == 200
    body = res.json()
    repo = get_l1_repository()
    assert body["version"] == repo.version
    assert len(body["items"]) == len(repo.approved()) > 0
    for item in body["items"]:
        assert item["status"] == "approved"
        assert ITEM_KEYS <= item.keys()
        # 앱 번들 파일과 같은 모양이어야 그대로 바꿔 끼운다 — camelCase 로 바꾸지 않는다
        assert "redFlag" not in item


def test_repository_skips_drafts_and_version_file(tmp_path) -> None:
    (tmp_path / "version.json").write_text('{"version": "2027.1.1"}', encoding="utf-8")
    approved = {
        "id": "k-vacc-0101",
        "months": [1],
        "kind": "접종",
        "title": "B형간염 2차",
        "body": "생후 1개월에 맞아요.",
        "source": {
            "name": "질병관리청 예방접종도우미",
            "url": "https://nip.kdca.go.kr",
            "checked": "2026-10-01",
        },
        "confidence": "표준",
        "red_flag": False,
        "status": "approved",
    }
    draft = {**approved, "id": "k-vacc-0102", "status": "draft"}
    (tmp_path / "vaccination.json").write_text(json.dumps([approved, draft]), encoding="utf-8")
    repo = L1Repository(tmp_path)
    assert repo.version == "2027.1.1"
    assert [item["id"] for item in repo.bundle()] == ["k-vacc-0101"]
    # 돌려준 묶음을 고쳐도 저장소는 그대로다
    repo.bundle()[0]["title"] = "바뀜"
    assert repo.bundle()[0]["title"] == "B형간염 2차"


def test_missing_version_file_means_oldest_version(tmp_path) -> None:
    item = {
        "id": "k-vacc-0101",
        "months": [1],
        "kind": "접종",
        "title": "t",
        "body": "b",
        "source": {"name": "n", "url": "u", "checked": "2026-10-01"},
        "confidence": "표준",
        "red_flag": False,
        "status": "approved",
    }
    (tmp_path / "vaccination.json").write_text(json.dumps([item]), encoding="utf-8")
    assert L1Repository(tmp_path).version == "0"
