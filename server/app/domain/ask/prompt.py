"""버디(육아버디의 AI) 프롬프트 — 시스템 프롬프트, 질문마다 붙는 컨텍스트, 모델이 돌려줄 JSON 모양.

골격의 정본은 docs/menu-spec/ask.md 「프롬프트 골격」이다: 정체성 + constitution 제약 + 답변 수위 셋
(SPEC-ASK-08) + 되묻기 판단표(SPEC-ASK-03) + 출력 형식. 답변은 전달된 L1 id 만 인용할 수 있다.

시스템 프롬프트는 모든 질문에 똑같아야 한다 — 그래야 프롬프트 캐싱이 걸린다. 질문마다 바뀌는 것
(월령, 기록, L1 조각, 질문)은 전부 user 메시지로 보낸다.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from app.common.core.schema import ApiModel

# 문장이 길고 자주 고치는 글이라 코드 밖 파일로 둔다
SYSTEM_PROMPT = (Path(__file__).parent / "system_prompt.txt").read_text(encoding="utf-8")

# 위험 신호 범주 — L1 red_flag 항목 id(decisions/010). 규칙을 통과한 질문을 모델이 한 번 더 본다
RED_FLAG_IDS = [f"k-warn-000{n}" for n in range(1, 9)]

# 모델이 돌려줄 JSON — 두 회사 모두 받아들이도록 $ref 없이 평평하게 적는다.
# redFlag 와 level 을 맨 앞에 두어 위험 신호와 수위부터 정하고 답하게 한다.
MODEL_OUTPUT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "redFlag": {"type": "string", "enum": ["없음", *RED_FLAG_IDS]},
        "level": {"type": "string", "enum": ["사실", "일반", "판단"]},
        "type": {"type": "string", "enum": ["answer", "followup"]},
        "answer": {"type": "string"},
        "citedIds": {"type": "array", "items": {"type": "string"}},
        "followup": {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "chips": {"type": "array", "items": {"type": "string"}},
                "recordLabel": {"type": "string"},
            },
            "required": ["question", "chips", "recordLabel"],
            "additionalProperties": False,
        },
        "records": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": ["기록", "요약"]},
                    "label": {"type": "string"},
                },
                "required": ["kind", "label"],
                "additionalProperties": False,
            },
        },
        # 이번 질문과 답까지 넣은 대화 요약 — 폰이 들고 있다가 다음 질문에 붙인다(decisions/022)
        "summary": {"type": "string"},
    },
    "required": [
        "redFlag",
        "level",
        "type",
        "answer",
        "citedIds",
        "followup",
        "records",
        "summary",
    ],
    "additionalProperties": False,
}


class ModelFollowup(ApiModel):
    question: str
    chips: list[str]
    record_label: str


class ModelRecord(ApiModel):
    kind: Literal["기록", "요약"]
    label: str


class ModelOutput(ApiModel):
    """모델이 돌려준 JSON 을 검증한 모양.

    계약 응답(AnswerResponse 등)으로 바꾸는 것은 service 몫이다.
    """

    # "없음" 이 아니면 서버가 모델 답을 버리고 고정 응급 안내를 낸다(decisions/010)
    red_flag: str = "없음"
    level: Literal["사실", "일반", "판단"]
    type: Literal["answer", "followup"]
    answer: str
    cited_ids: list[str]
    followup: ModelFollowup
    records: list[ModelRecord]
    # 대화 요약 — 옛 모델 출력에는 없을 수 있다
    summary: str = ""


@dataclass(frozen=True)
class L1Snippet:
    id: str
    title: str
    body: str
    source_name: str


@dataclass(frozen=True)
class BabyRecordLine:
    kind: str
    label: str


@dataclass(frozen=True)
class HistoryTurn:
    # "user"(부모) · "buddy"(버디)
    role: str
    text: str


# 바로 앞 대화 — 이보다 많으면 최근 것만, 한 턴은 이 길이에서 자른다
MAX_HISTORY_TURNS = 6
MAX_TURN_CHARS = 600


def trim_history(turns: list[HistoryTurn]) -> list[HistoryTurn]:
    """최근 MAX_HISTORY_TURNS 턴만, 한 턴은 MAX_TURN_CHARS 에서 자른다."""
    return [HistoryTurn(t.role, t.text[:MAX_TURN_CHARS]) for t in turns[-MAX_HISTORY_TURNS:]]


def build_user_message(
    question: str,
    months: int,
    records: list[BabyRecordLine],
    snippets: list[L1Snippet],
    history: list[HistoryTurn] | None = None,
    summary: str | None = None,
    objection_to: str | None = None,
) -> str:
    """질문마다 바뀌는 것을 한 덩어리로.

    summary 는 이전 대화 요약(폰이 들고 있던 것),
    objection_to 는 부모가 앞 답을 문제 삼을 때의 원래 질문이다.
    """
    record_lines = [f"- [{r.kind}] {r.label}" for r in records] or ["- 없음"]
    snippet_lines = [
        f"- id: {s.id} | {s.title} | {s.body} | 출처: {s.source_name}" for s in snippets
    ] or ["- 이 질문에 맞는 표준 지식 없음"]
    # 앞 대화는 오래된 것부터 — 줄 바꿈은 한 줄로 눌러 한 턴이 한 줄이 되게
    history_lines = [
        f"- {'부모' if t.role == 'user' else '버디'}: {' '.join(t.text.split())}"
        for t in (history or [])
    ] or ["- 없음"]
    return "\n".join(
        [
            f"아기: 생후 {months}개월",
            "우리 아기 기록:",
            *record_lines,
            "표준 지식:",
            *snippet_lines,
            "이전 대화 요약:",
            f"- {' '.join(summary.split())}" if summary else "- 없음",
            "바로 앞 대화:",
            *history_lines,
            *(
                ["", f"(이번 말은 바로 앞 버디의 답을 두고 하는 말이다. 원래 질문: {objection_to})"]
                if objection_to
                else []
            ),
            "",
            f"질문: {question}",
        ]
    )
