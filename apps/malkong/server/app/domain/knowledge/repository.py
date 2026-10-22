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
from pathlib import Path
from typing import Any

VERSION_FILE = "version.json"


class L1Repository:
    def __init__(self, directory: Path) -> None:
        version_path = directory / VERSION_FILE
        # 판 파일이 없으면 "0" — 어떤 앱 번들보다 낡은 판이라 아무 앱도 내려받지 않는다
        self.version: str = (
            str(json.loads(version_path.read_text(encoding="utf-8"))["version"])
            if version_path.exists()
            else "0"
        )
        raw_items: list[dict[str, Any]] = []
        for path in sorted(directory.glob("*.json")):
            if path.name == VERSION_FILE:
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, list):
                continue
            raw_items.extend(raw for raw in data if raw.get("status") == "approved")
        if not raw_items:
            # 경로가 틀렸거나 사본이 비었다 — 조용히 0건으로 뜨면 앱이 빈 묶음으로 바꿔 끼울 수 있다
            raise RuntimeError(f"승인된 L1 항목을 찾지 못했다: {directory}")
        self._raw = raw_items

    def bundle(self) -> list[dict[str, Any]]:
        """앱에 내려줄 승인 항목 전부 — 파일에 적힌 모양 그대로."""
        return [dict(raw) for raw in self._raw]
