"""L1 지식 저장소 — 서버 폴더 안의 사본(app/data/l1/*.json)을 읽는다.

앱 로더(src/data/l1/index.ts)와 같은 의료 게이트를 지킨다:
사람이 승인한(status=approved) 항목만 내보낸다.
항목 모양의 정본은 docs/architecture/l1-knowledge-base.md 「항목 스키마」.
"""

import json
from dataclasses import dataclass
from pathlib import Path


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
        items: list[L1Item] = []
        for path in sorted(directory.glob("*.json")):
            for raw in json.loads(path.read_text(encoding="utf-8")):
                if raw.get("status") != "approved":
                    continue
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
        self._by_id = {item.id: item for item in items}

    def approved(self) -> list[L1Item]:
        return list(self._items)

    def get(self, item_id: str) -> L1Item | None:
        return self._by_id.get(item_id)
