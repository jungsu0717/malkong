"""L1 지식 저장소 — 서버 폴더 안의 사본(app/data/l1/)을 읽는다.

앱 로더(src/data/l1/index.ts)와 같은 의료 게이트를 지킨다:
사람이 승인한(status=approved) 항목만 내보낸다.
항목 모양의 정본은 docs/architecture/l1-knowledge-base.md 「항목 스키마」.

판 번호는 같은 폴더의 version.json 에 있다(앱 번들의 src/data/l1/version.json 과 같은 파일).
앱은 이 판 번호를 자기 판과 비교해, 더 새 판이면 승인된 항목 전부를 내려받는다
(api-contract /v1/knowledge, task common/019). 그래서 묶음은 항목 스키마 그대로(red_flag 도 그대로)
내보낸다.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

VERSION_FILE = "version.json"


@dataclass(frozen=True)
class L1Item:
    id: str
    months: tuple[int, ...]
    kind: str
    title: str
    body: str
    source_name: str
    source_url: str
    red_flag: bool

    @property
    def start(self) -> int:
        return self.months[0]


class L1Repository:
    def __init__(self, directory: Path) -> None:
        version_path = directory / VERSION_FILE
        # 판 파일이 없으면 "0" — 어떤 앱 번들보다 낡은 판이라 아무 앱도 내려받지 않는다
        self.version: str = (
            str(json.loads(version_path.read_text(encoding="utf-8"))["version"])
            if version_path.exists()
            else "0"
        )
        items: list[L1Item] = []
        raw_items: list[dict[str, Any]] = []
        for path in sorted(directory.glob("*.json")):
            if path.name == VERSION_FILE:
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, list):
                continue
            for raw in data:
                if raw.get("status") != "approved":
                    continue
                raw_items.append(raw)
                items.append(
                    L1Item(
                        id=raw["id"],
                        months=tuple(raw["months"]),
                        kind=raw["kind"],
                        title=raw["title"],
                        body=raw["body"],
                        source_name=raw["source"]["name"],
                        source_url=raw["source"]["url"],
                        red_flag=bool(raw.get("red_flag")),
                    )
                )
        if not items:
            # 경로가 틀렸거나 사본이 비었다 — 조용히 0건으로 뜨면 모든 답이 근거 없이 나간다
            raise RuntimeError(f"승인된 L1 항목을 찾지 못했다: {directory}")
        self._items = items
        self._raw = raw_items
        self._by_id = {item.id: item for item in items}

    def approved(self) -> list[L1Item]:
        return list(self._items)

    def get(self, item_id: str) -> L1Item | None:
        return self._by_id.get(item_id)

    def bundle(self) -> list[dict[str, Any]]:
        """앱에 내려줄 승인 항목 전부 — 파일에 적힌 모양 그대로."""
        return [dict(raw) for raw in self._raw]
