"""모델에 질문 세트를 보내 원본 결과를 남긴다 (task common/003).

    uv run python -m eval.run --model gemini:<모델 id> [--model anthropic:<모델 id> ...]

모델 이름은 실행 인자로만 받는다(backend 「모델은 갈아끼우는 부품이다」).
하나만 줘도 되고, 둘을 주면 score 가 이름을 가린 비교 파일까지 만든다.
Gemini 키는 server/.env 에서 읽고, Claude 는 기본으로 Vertex AI 로 부른다(gcloud 로그인 권한).
질문은 모두 지어낸 예시다 — 무료 티어로 보내도 되는 데이터만 들어 있다.
"""

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from datetime import date
from pathlib import Path

from app.common.core.setting import Settings
from app.domain.ask.prompt import (
    MODEL_OUTPUT_SCHEMA,
    SYSTEM_PROMPT,
    BabyRecordLine,
    L1Snippet,
    build_user_message,
)
from app.infra.llm.anthropic import AnthropicClient
from app.infra.llm.base import LlmClient, LlmRequest
from app.infra.llm.gemini import GeminiClient

EVAL_DIR = Path(__file__).parent
L1_DIR = EVAL_DIR.parent.parent / "src" / "data" / "l1"


def load_l1() -> dict[str, L1Snippet]:
    snippets = {}
    for path in sorted(L1_DIR.glob("*.json")):
        for item in json.loads(path.read_text(encoding="utf-8")):
            # 의료 게이트 — 앱과 똑같이 승인된 항목만 쓴다
            if item["status"] != "approved":
                continue
            snippets[item["id"]] = L1Snippet(
                item["id"], item["title"], item["body"], item["source"]["name"]
            )
    return snippets


def build_request(question: dict, l1: dict[str, L1Snippet]) -> LlmRequest:
    user = build_user_message(
        question["question"],
        question["months"],
        [BabyRecordLine(r["kind"], r["label"]) for r in question["records"]],
        [l1[i] for i in question["l1"]],
    )
    return LlmRequest(system=SYSTEM_PROMPT, user=user, schema=MODEL_OUTPUT_SCHEMA)


def run_one(client: LlmClient, question: dict, l1: dict[str, L1Snippet]) -> dict:
    row = {"qid": question["id"], "provider": client.provider, "requested_model": client.model}
    try:
        # 조립도 여기서 한다 — 승인이 풀린 L1 id 를 가리키는 문항이 있어도 그 문항만 실패로 남는다
        result = client.generate(build_request(question, l1))
        row |= {"ok": True, **asdict(result)}
    except Exception as exc:  # 한 문항이 실패해도 나머지는 계속 돌린다 — 실패도 결과다
        row |= {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
    status = "ok" if row["ok"] else f"실패 ({row['error'][:80]})"
    print(f"  {client.model} {question['id']} {status}", flush=True)
    return row


def run_provider(client: LlmClient, questions: list[dict], l1: dict[str, L1Snippet]) -> list[dict]:
    # 모델마다 한 줄로 차례대로 보낸다 — 무료 티어의 분당 호출 한도를 넘지 않게
    return [run_one(client, q, l1) for q in questions]


def make_client(spec: str, args: argparse.Namespace, settings: Settings) -> LlmClient:
    provider, _, model = spec.partition(":")
    if provider == "gemini":
        if not settings.gemini_api_key:
            sys.exit("server/.env 에 MALKONG_GEMINI_API_KEY 를 넣어 주세요")
        return GeminiClient(settings.gemini_api_key.get_secret_value(), model)
    if provider == "anthropic":
        if args.claude_via == "api":
            if not settings.anthropic_api_key:
                sys.exit("server/.env 에 MALKONG_ANTHROPIC_API_KEY 를 넣어 주세요")
            return AnthropicClient(model, api_key=settings.anthropic_api_key.get_secret_value())
        project = args.vertex_project or settings.vertex_project
        if not project:
            sys.exit("--vertex-project 나 MALKONG_VERTEX_PROJECT 가 필요합니다")
        return AnthropicClient(model, vertex_project=project, vertex_region=settings.vertex_region)
    sys.exit(f"모르는 모델 지정: {spec} (gemini:<id> 또는 anthropic:<id>)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model", action="append", required=True, help="gemini:<id> 등, 여러 번 가능"
    )
    parser.add_argument("--out", default=str(EVAL_DIR / "results" / date.today().isoformat()))
    parser.add_argument("--only", nargs="*", help="이 질문 id 만 돌린다 (예: q01 q26)")
    parser.add_argument(
        "--claude-via", choices=["vertex", "api"], default="vertex", help="Claude 를 부르는 길"
    )
    parser.add_argument("--vertex-project", help="기본값은 설정값 MALKONG_VERTEX_PROJECT")
    args = parser.parse_args()

    settings = Settings()
    clients = [make_client(spec, args, settings) for spec in args.model]

    questions = json.loads((EVAL_DIR / "questions.json").read_text(encoding="utf-8"))
    if args.only:
        questions = [q for q in questions if q["id"] in set(args.only)]
    l1 = load_l1()

    print(f"질문 {len(questions)}개 × 모델 {len(clients)}개", flush=True)
    with ThreadPoolExecutor(max_workers=len(clients)) as pool:
        rows = [
            row
            for part in pool.map(lambda c: run_provider(c, questions, l1), clients)
            for row in part
        ]

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with (out / "raw.jsonl").open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    failed = sum(1 for r in rows if not r["ok"])
    print(f"저장: {out / 'raw.jsonl'} (실패 {failed}건)")


if __name__ == "__main__":
    main()
