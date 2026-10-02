"""말콩이 프롬프트 — 시스템 프롬프트, 질문마다 붙는 컨텍스트, 모델이 돌려줄 JSON 모양.

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

# 모델이 돌려줄 JSON — 두 회사 모두 받아들이도록 $ref 없이 평평하게 적는다.
# level 을 맨 앞에 두어 수위부터 정하고 답하게 한다.
MODEL_OUTPUT_SCHEMA: dict = {
    "type": "object",
    "properties": {
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
    },
    "required": ["level", "type", "answer", "citedIds", "followup", "records"],
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

    level: Literal["사실", "일반", "판단"]
    type: Literal["answer", "followup"]
    answer: str
    cited_ids: list[str]
    followup: ModelFollowup
    records: list[ModelRecord]


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


def build_user_message(
    question: str, months: int, records: list[BabyRecordLine], snippets: list[L1Snippet]
) -> str:
    record_lines = [f"- [{r.kind}] {r.label}" for r in records] or ["- 없음"]
    snippet_lines = [
        f"- id: {s.id} | {s.title} | {s.body} | 출처: {s.source_name}" for s in snippets
    ] or ["- 이 질문에 맞는 표준 지식 없음"]
    return "\n".join(
        [
            f"아기: 생후 {months}개월",
            "우리 아기 기록:",
            *record_lines,
            "표준 지식:",
            *snippet_lines,
            "",
            f"질문: {question}",
        ]
    )
