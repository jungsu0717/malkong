"""승인된 L1 항목은 모두 어딘가에 닿아야 한다 (task common/016).

승인(status=approved)만 돼 있고 어떤 답에도 나갈 길이 없는 항목은, 있다고 믿지만 실제로는
쓰이지 않는 지식이다("적용됨 46건, 실제 전달 0건" — 온톨로지 세미나 5교시, 2026-10-07).
닿는 길은 셋이다.

1. 평가 질문 세트(eval/questions.json)의 어느 질문에서든 L1 검색이 그 항목을 고른다
2. 위험 신호 규칙(app/domain/ask/redflag.py)처럼 서버 코드가 id 를 직접 쓴다
3. 앱의 돌봄 신호(src/data/care-signals.ts)처럼 앱 코드가 id 를 직접 쓴다

새 항목을 승인했는데 이 시험이 떨어지면, 그 항목을 묻는 질문을 평가 세트에 더하거나(검색이
고르는지 함께 확인된다) 쓰는 코드를 두어야 한다. 검색 규칙을 억지로 넓혀서 통과시키지는 않는다 —
억지 근거 금지.
"""

import json
import re
from pathlib import Path

from app.domain.ask.retrieval import retrieve
from app.domain.knowledge.repository import L1Repository

SERVER_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = SERVER_DIR.parent
L1 = L1Repository(SERVER_DIR / "app" / "data" / "l1").approved()
QUESTIONS = json.loads((SERVER_DIR / "eval" / "questions.json").read_text(encoding="utf-8"))
ID = re.compile(r"k-[a-z]+-\d{4}")


def _ids_in_code() -> set[str]:
    found: set[str] = set()
    for path in (SERVER_DIR / "app").rglob("*.py"):
        found |= set(ID.findall(path.read_text(encoding="utf-8")))
    for path in (REPO_DIR / "src").rglob("*.ts*"):
        if "/data/l1/" in path.as_posix():
            continue  # 항목 자체의 정의는 「쓰임」이 아니다
        found |= set(ID.findall(path.read_text(encoding="utf-8")))
    return found


def _ids_retrieved() -> set[str]:
    found: set[str] = set()
    for q in QUESTIONS:
        found |= {i.id for i in retrieve(q["question"], q["months"], L1)}
    return found


def test_every_approved_item_is_reachable() -> None:
    reached = _ids_retrieved() | _ids_in_code()
    orphans = sorted(i.id for i in L1 if i.id not in reached)
    assert not orphans, (
        f"어떤 질문에도, 어떤 코드에도 닿지 않는 승인 항목 {len(orphans)}개 — "
        "평가 질문을 더하거나 쓰는 코드를 두어야 한다: " + ", ".join(orphans)
    )


def test_eval_gold_ids_exist() -> None:
    # 평가 질문이 가리키는 정답 id 가 승인 항목에 있어야 한다 —
    # 항목을 지우거나 이름을 바꾸면 여기서 걸린다
    known = {i.id for i in L1}
    missing = sorted(
        {g for q in QUESTIONS for g in (q["expect"].get("gold") or []) + q["l1"]} - known
    )
    assert not missing, f"평가 질문이 없는 항목을 가리킨다: {', '.join(missing)}"
