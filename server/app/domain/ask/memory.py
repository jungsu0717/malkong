"""대화 기억 — 지금 이어지는 대화를 대화로 다루기 (decisions/022, task ask/013).

세 겹이다.
- 바로 앞 대화: 원문 몇 마디(prompt.trim_history)
- 대화 요약: 모델이 답과 함께 돌려주고, 폰이 들고 있다가 다음 질문에 붙인다
- 우리 아기 기록: 폰이 질문 주제에 닿는 것만 골라 보낸다
서버는 어느 것도 저장하지 않는다.

여기서는 질문 한 줄을 보고 두 가지를 가린다.
- 앞 답을 문제 삼는 말(「분유 먹이는 거랑 무슨 상관이에요?」) — 새 질문으로 다루면
  그 말 속 낱말(분유)에 끌려 엉뚱한 주제로 답한다. 그래서 지식은 원래 질문으로 찾고,
  모델에게 원래 질문을 알려 준다
- 앞 말을 가리키는 질문(「몇 개월까지 그렇게 해요?」) — 이 질문만으로 지식이 안 잡히면
  앞 질문으로 한 번 더 찾는다. 가리키는 말이 없는 새 질문은 앞 질문에 끌려가지 않는다
  (「에어컨 틀어도 돼요?」 앞의 수유 질문)

앱(src/data/ask-context.ts)도 같은 두 규칙으로 보낼 기록을 고른다 — 낱말 목록을 고치면 둘 다 고친다.
"""

import re

from app.domain.ask.prompt import HistoryTurn

# 앞 답을 문제 삼는 말. "상관없어요?"처럼 보통 질문에도 나오는 말은 넣지 않는다
OBJECTION = re.compile(
    r"(무슨|뭔|뭐랑|무엇과)\s*(상관|관계|관련)"
    r"|(그게|그런\s*게|그\s*말이|그런\s*말이|그건)\s*아니(라|고|에요|야|죠)"
    r"|내\s*말은|엉뚱|동문서답|딴\s*(소리|얘기|이야기)"
    r"|(잘못|못)\s*(알아들|이해)|질문을?\s*(잘못|다시)"
    r"|(왜|갑자기)\s*\S{0,12}\s*(얘기|이야기)(를|가)?\s*(해|하|나와|꺼내)"
)

# 앞 말을 가리키는 말 — 이게 있어야 앞 질문의 주제를 빌려 온다
REFERS_BACK = re.compile(
    r"그렇게|그거|그건|그걸|그것|그럼|그러면|그때|그런|이것|이거|아까|방금|저번|앞에서|말씀하신|말한"
)

# 대화 요약 한 벌의 길이 — 모델에게도 이 안으로 쓰라고 한다(system_prompt 「대화 이어 가기」)
MAX_SUMMARY_CHARS = 600


def previous_question(history: list[HistoryTurn]) -> str | None:
    """바로 앞 대화에서 부모가 마지막으로 한 말."""
    return next((t.text for t in reversed(history) if t.role == "user"), None)


def is_objection(question: str, history: list[HistoryTurn]) -> bool:
    """앞 답을 문제 삼는 말인가 — 버디가 앞에서 답한 적이 있을 때만."""
    has_answer = any(t.role == "buddy" for t in history)
    has_question = previous_question(history) is not None
    return has_answer and has_question and bool(OBJECTION.search(question))


def refers_back(question: str) -> bool:
    return bool(REFERS_BACK.search(question))


def clean_summary(text: str | None) -> str | None:
    """대화 요약을 한 줄로 눌러 길이를 자른다. 비면 None."""
    if not text:
        return None
    flat = " ".join(text.split())
    return flat[:MAX_SUMMARY_CHARS] or None
