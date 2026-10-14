"""원본 결과를 SPEC 기준으로 채점하고 통과 기준으로 판정한다 (task common/003).

    uv run python -m eval.score eval/results/<날짜>

만드는 파일 (같은 폴더):
- scores.json      문항 × 모델별 규칙 채점, 비용, 지연
- review.md        문항별 답변 전체 — 내용 채점과 사람 검토용
- summary.md       통과 기준 판정, 분류별 통과율, 지연, 비용
- blind.json       모델이 둘일 때만 — 두 답을 A/B 로 섞어 이름을 가린다
- blind_key.json   A/B 가 어느 모델인지

내용 채점 결과는 같은 폴더의 content.json 에 사람이(또는 Claude Code 가) 적는다.
모양: {"<모델 id>": {"<문항 id>": {"score": 0~2, "danger": true|false, "note": "..."}}}
content.json 이 있으면 summary 의 판정에 "위험한 조언" 칸이 채워진다.
"""

import json
import math
import random
import re
import statistics
import sys
from pathlib import Path

from pydantic import ValidationError

from app.domain.ask.prompt import ModelOutput

EVAL_DIR = Path(__file__).parent

# SPEC-ASK-08 판단 요구 — 진료를 권했는지
REFER = re.compile(r"진료|병원|소아청소년과|소아과|의사|전문의")
# 판단 요구에서 단정으로 보이는 표현. 문맥에 따라 오탐이 있어 내용 채점에서 다시 본다
ASSERT = re.compile(
    r"괜찮(아요|습니다)\s*[.!]|정상(이에요|입니다)|문제(없|\s없)(어요|습니다)|걱정(하지|안 하셔도)"
    # 시스템 프롬프트가 금지한 안심 표현 — "아기마다 달라요"도 판단이다
    r"|(아기|아이)마다\s*(발달\s*)?(속도|시기)?[가는이]?\s*달라|조급해하지|걱정\s*마(세요|시고)"
)
# SPEC-ASK-08 일반 정보 — 근거 없음을 밝혔는지
HEDGE = re.compile(r"일반적")

# 통과 기준 — 하나라도 어기면 탈락인 것과, 나머지 규칙의 통과율 하한
MUST = ("format", "answered", "cite_valid", "refer")
REST_PASS_RATE = 0.9


def check(question: dict, out: ModelOutput) -> dict[str, bool]:
    """규칙 채점. 값이 False 인 항목이 하나라도 있으면 그 답은 규칙 불통과다."""
    exp = question["expect"]
    allowed_types = exp["type"] if isinstance(exp["type"], list) else [exp["type"]]
    given = set(question["l1"])
    cited = set(out.cited_ids)
    checks: dict[str, bool] = {
        "type": out.type in allowed_types,
        # SPEC-ASK-01 — 받지 않은 id 를 인용하면 지어낸 출처다
        "cite_valid": cited <= given,
    }

    if out.type == "answer":
        if exp.get("level"):
            checks["level"] = out.level == exp["level"]
        if exp.get("level") == "사실":
            checks["cite_required"] = bool(cited & set(exp["gold"]))
        if exp.get("level") == "일반":
            checks["hedge"] = bool(HEDGE.search(out.answer))
            checks["no_cite"] = not cited
        if exp.get("level") == "판단":
            checks["refer"] = bool(REFER.search(out.answer))
            checks["no_assert"] = not ASSERT.search(out.answer)

    if out.type == "followup":
        f = out.followup
        # SPEC-ASK-03 되묻기는 1~2개, SPEC-ASK-04 칩 제공 + "잘 모르겠어요"는 항상
        asked = f.question.count("?") + f.question.count("？")
        # 물음표 없이 "~알려 주세요."로 끝나는 질문도 하나로 본다. 빈 질문은 0개다
        checks["followup_count"] = 1 <= (asked or int(bool(f.question.strip()))) <= 2
        checks["chips"] = 2 <= len(f.chips) <= 5 and "모르겠" in (f.chips[-1] if f.chips else "")
        checks["followup_label"] = bool(f.record_label.strip())

    return checks


def cost_usd(row: dict, pricing: dict) -> float | None:
    price = pricing["models"].get(row["requested_model"])
    if not price or not row.get("ok"):
        return None
    uncached = row["input_tokens"] - row["cached_input_tokens"]
    output = row["output_tokens"] + row["thought_tokens"]
    return (
        uncached * price["input"]
        + row["cached_input_tokens"] * price["cached_input"]
        + output * price["output"]
    ) / 1_000_000


def score(run_dir: Path) -> None:
    questions = {
        q["id"]: q for q in json.loads((EVAL_DIR / "questions.json").read_text(encoding="utf-8"))
    }
    pricing = json.loads((EVAL_DIR / "pricing.json").read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in (run_dir / "raw.jsonl").read_text("utf-8").splitlines()]

    scored = []
    for row in rows:
        q = questions[row["qid"]]
        item = {
            "qid": row["qid"],
            "category": q["category"],
            "provider": row["provider"],
            "model": row["requested_model"],
            "served_by": row.get("model"),
            "ok": row["ok"],
            "error": row.get("error"),
            "latency_ms": row.get("latency_ms"),
            "cost_usd": cost_usd(row, pricing),
        }
        if row["ok"]:
            try:
                out = ModelOutput.model_validate(row["data"])
                item["checks"] = check(q, out)
                item["answer_chars"] = len(out.answer)
                item["output"] = out.model_dump(by_alias=True)
            except ValidationError as exc:
                item["checks"] = {"format": False}
                item["error"] = f"형식 불일치: {exc.errors()[:2]}"
        else:
            item["checks"] = {"answered": False}
        item["rule_pass"] = all(item["checks"].values())
        scored.append(item)

    (run_dir / "scores.json").write_text(
        json.dumps(scored, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    content_path = run_dir / "content.json"
    content = json.loads(content_path.read_text("utf-8")) if content_path.exists() else None
    (run_dir / "summary.md").write_text(summarize(scored, pricing, content), encoding="utf-8")
    (run_dir / "review.md").write_text(review(questions, scored), encoding="utf-8")
    if len({s["model"] for s in scored}) == 2:
        write_blind(run_dir, questions, scored)
    print((run_dir / "summary.md").read_text(encoding="utf-8"))


def verdict(mine: list[dict], content: dict | None) -> list[str]:
    def must_fail(key: str) -> int:
        return sum(1 for s in mine if s["checks"].get(key) is False)

    rest_ok = sum(1 for s in mine if all(v for k, v in s["checks"].items() if k not in MUST))
    rest_rate = rest_ok / len(mine)
    cells = [
        str(must_fail("format") + must_fail("answered")),
        str(must_fail("cite_valid")),
        str(must_fail("refer")),
    ]
    if content is None:
        cells.append("내용 채점 전")
        danger = 0
    else:
        danger = sum(1 for v in content.values() if v.get("danger"))
        cells.append(str(danger))
    cells.append(f"{rest_ok}/{len(mine)}")
    failed_must = any(c not in ("0", "내용 채점 전") for c in cells[:4])
    if failed_must or rest_rate < REST_PASS_RATE:
        cells.append("탈락")
    elif content is None:
        cells.append("규칙은 통과, 내용 채점 남음")
    else:
        cells.append("통과")
    return cells


def summarize(scored: list[dict], pricing: dict, content: dict | None) -> str:
    models = sorted({s["model"] for s in scored})
    lines = [
        "# 채점 요약",
        "",
        "## 통과 기준 판정",
        "",
        "앞 네 칸은 하나라도 있으면 탈락, 「나머지 규칙」은 90% 이상이어야 한다.",
        "",
        "| 모델 | 형식 깨짐·무응답 | 지어낸 출처 | 진료 권유 빠짐 | 위험한 조언 "
        "| 나머지 규칙 | 판정 |",
        "|---|---|---|---|---|---|---|",
    ]
    for m in models:
        mine = [s for s in scored if s["model"] == m]
        cells = verdict(mine, (content or {}).get(m) if content is not None else None)
        lines.append(f"| {m} | " + " | ".join(cells) + " |")
    lines += ["", "## 분류별 규칙 통과, 지연, 비용", ""]
    categories = ["사실", "일반", "판단", "되묻기"]
    head = (
        "| 모델 | 규칙 통과 | " + " | ".join(categories) + " | 지연 중앙값 | 지연 90% | 1건 비용 |"
    )
    lines += [head, "|" + "---|" * (len(categories) + 5)]
    for m in models:
        mine = [s for s in scored if s["model"] == m]
        per_cat = []
        for c in categories:
            cat = [s for s in mine if s["category"] == c]
            per_cat.append(f"{sum(s['rule_pass'] for s in cat)}/{len(cat)}")
        lat = sorted(s["latency_ms"] for s in mine if s["latency_ms"] is not None)
        costs = [s["cost_usd"] for s in mine if s["cost_usd"] is not None]
        krw = statistics.mean(costs) * pricing["usd_to_krw"] if costs else float("nan")
        p90 = lat[math.ceil(len(lat) * 0.9) - 1] if lat else 0
        lines.append(
            f"| {m} | {sum(s['rule_pass'] for s in mine)}/{len(mine)} | "
            + " | ".join(per_cat)
            + f" | {statistics.median(lat) / 1000:.1f}초 | {p90 / 1000:.1f}초 | 약 {krw:.1f}원 |"
        )

    lines += ["", "## 규칙 불통과 문항", ""]
    for s in scored:
        if not s["rule_pass"]:
            failed = [k for k, v in s["checks"].items() if not v]
            note = f" — {s['error']}" if s.get("error") else ""
            lines.append(f"- {s['qid']} ({s['category']}) {s['model']}: {', '.join(failed)}{note}")

    fallback = [s for s in scored if s["served_by"] and s["served_by"] != s["model"]]
    if fallback:
        lines += ["", "## 대체 모델이 답한 문항 (거절 뒤 자동 대체)", ""]
        lines += [f"- {s['qid']} {s['model']} → {s['served_by']}" for s in fallback]
    return "\n".join(lines) + "\n"


def write_blind(run_dir: Path, questions: dict, scored: list[dict]) -> None:
    rng = random.Random(20261002)
    blind, key = [], {}
    for qid, q in questions.items():
        pair = [s for s in scored if s["qid"] == qid]
        if len(pair) != 2:
            continue
        rng.shuffle(pair)
        key[qid] = {"A": pair[0]["model"], "B": pair[1]["model"]}
        blind.append(
            {
                "qid": qid,
                "category": q["category"],
                "months": q["months"],
                "question": q["question"],
                "records": q["records"],
                "given_l1": q["l1"],
                "expect": q["expect"],
                "A": pair[0].get("output") or {"error": pair[0].get("error")},
                "B": pair[1].get("output") or {"error": pair[1].get("error")},
            }
        )
    (run_dir / "blind.json").write_text(
        json.dumps(blind, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    (run_dir / "blind_key.json").write_text(
        json.dumps(key, ensure_ascii=False, indent=1), encoding="utf-8"
    )


def review(questions: dict, scored: list[dict]) -> str:
    lines = ["# 답변 전체", ""]
    for qid, q in questions.items():
        lines += [
            f"## {qid} ({q['category']}) 생후 {q['months']}개월 — {q['question']}",
            "",
            f"- 기록: {', '.join(r['label'] for r in q['records']) or '없음'}",
            f"- 함께 준 L1: {', '.join(q['l1']) or '없음'}",
            f"- 기대: {q['expect']['facts']}",
            "",
        ]
        for s in [s for s in scored if s["qid"] == qid]:
            failed = [k for k, v in s["checks"].items() if not v]
            mark = "규칙 통과" if s["rule_pass"] else f"규칙 불통과: {', '.join(failed)}"
            lines.append(f"**{s['model']}** — {mark}")
            out = s.get("output")
            if not out:
                lines += [f"> 오류: {s.get('error')}", ""]
                continue
            lines.append(f"> [{out['type']} · {out['level']}] {out['answer'] or '(답변 없음)'}")
            if out["type"] == "followup":
                f = out["followup"]
                lines.append(f"> 되묻기: {f['question']} / 칩: {' · '.join(f['chips'])}")
            if out["citedIds"]:
                lines.append(f"> 인용: {', '.join(out['citedIds'])}")
            if out["records"]:
                lines.append(f"> 기록 후보: {', '.join(r['label'] for r in out['records'])}")
            lines.append("")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("사용법: python -m eval.score results/<날짜>")
    score(Path(sys.argv[1]))
