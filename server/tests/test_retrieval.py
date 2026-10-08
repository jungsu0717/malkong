"""L1 검색 — 모델 비교 질문 세트의 정답 id 를 다시 찾아내는가, 엉뚱한 것을 붙이지 않는가."""

import json
from pathlib import Path

import pytest

from app.domain.ask.retrieval import MAX_SNIPPETS, retrieve
from app.domain.knowledge.repository import L1Repository

L1 = L1Repository(Path(__file__).parent.parent / "app" / "data" / "l1").approved()
QUESTIONS = json.loads(
    (Path(__file__).parent.parent / "eval" / "questions.json").read_text(encoding="utf-8")
)
FACT = [q for q in QUESTIONS if q["expect"].get("gold")]


def ids(question: str, months: int) -> list[str]:
    return [i.id for i in retrieve(question, months, L1)]


@pytest.mark.parametrize("q", FACT, ids=[q["id"] for q in FACT])
def test_fact_questions_get_their_gold_items(q: dict) -> None:
    got = ids(q["question"], q["months"])
    assert set(q["expect"]["gold"]) <= set(got)
    assert len(got) <= MAX_SNIPPETS


@pytest.mark.parametrize(
    ("question", "months", "expected"),
    [
        ("꿀 먹여도 돼요?", 8, "k-feed-0004"),
        ("아기 재울 때 이불 덮어줘도 돼요?", 7, "k-sleep-0002"),
        ("카시트는 앞을 보게 해도 되나요?", 3, "k-safe-0002"),
        ("이유식은 언제부터 시작해요?", 4, "k-feed-0401"),
        ("계란 알레르기 있으면 땅콩은요?", 5, "k-feed-0602"),
        ("5개월인데 아직 뒤집기를 못 해요", 5, "k-dev-0202"),
        ("침대에서 떨어졌는데 괜찮아요", 10, "k-warn-0007"),
        ("낙상 사고가 있었는데 괜찮을까요", 9, "k-warn-0007"),
        ("아기가 침대에서 추락했어요", 9, "k-warn-0007"),
        ("아기가 안 달래져서 화가 나요", 2, "k-parent-0001"),
        ("산후우울증인지 걱정돼요", 1, "k-parent-0003"),
        ("이유식 양이 맞는지 모르겠어요", 6, "k-feed-0401"),
        ("재우는 방법이 맞는 건지", 2, "k-sleep-0003"),
        ("질식 예방하려면 어떻게 해요", 8, "k-safe-0003"),
        ("아빠가 담배 피우는데", 4, "k-safe-0006"),
        ("6개월 접종이랑 이유식 같이 해도 돼요?", 6, "k-feed-0401"),
        ("잘 때 너무 덥게 입히면 안 되나요?", 1, "k-sleep-0004"),
        ("신생아 잘 때 머리를 덮어 주면 안 되나요?", 1, "k-sleep-0004"),
    ],
)
def test_topic_questions_find_their_item(question: str, months: int, expected: str) -> None:
    assert expected in ids(question, months)


@pytest.mark.parametrize(
    ("question", "months"),
    [
        ("아기 손톱은 어떻게 잘라 주는 게 좋아요?", 1),
        ("또래보다 몸무게가 적은 것 같은데 괜찮을까요?", 6),
        ("머리 한쪽이 납작한데 괜찮을까요?", 9),
        ("엄마가 감기 걸렸는데 모유 먹여도 돼요?", 3),
    ],
)
def test_unrelated_items_are_not_attached(question: str, months: int) -> None:
    # 억지로 붙인 근거는 근거가 아니다 — L1 에 없는 주제면 비어야 한다
    assert ids(question, months) == []


def test_next_uses_the_month_in_the_question() -> None:
    # 6개월 아기가 "2개월 접종 다음"을 물으면 4개월 일정이다 — 아기 월령이 이기지 않는다
    assert ids("2개월 접종 다음은요", 6)[0] == "k-vacc-0401"
    assert ids("4개월 다음 접종 뭐예요", 10)[0] == "k-vacc-0601"


def test_common_verbs_do_not_pull_in_vaccines() -> None:
    assert not any(i.startswith("k-vacc") for i in ids("이유식 양이 맞는지 모르겠어요", 6))
    assert not any(i.startswith("k-vacc") for i in ids("질식 예방하려면 어떻게 해요", 8))
