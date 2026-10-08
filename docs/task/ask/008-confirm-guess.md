# 008 버디의 짐작 — 해석은 「맞아요」를 눌러야 기록이 된다

> 상태: 완료 (2026-10-08)
> 근거: SPEC-ASK-12(이 task 에서 신설) · [knowledge-layers](../../architecture/knowledge-layers.md) 「층 구조」 L2-요약 ·
> [decisions/020](../../decisions/020-rule-based-judgment-loop.md)

## 목표

Julian(2026-10-08, 온톨로지 세미나 뒤): 「버디가 『등센서가 심한 편』 같은 짐작을 사용자 확인 없이 저장하고 있다. 앞으로는
『맞아요 / 아니에요』 한 번 묻고 저장한다. 『분유 먹어요』 같은 사실은 지금처럼 자동 저장」. 세미나 1 · 5교시의 「해석은 사람이
결정한다」와 「애매하면 선택지로 묻는다」.

## 정한 것

- **사실(「기록」)은 그대로 자동 저장** — 사용자가 한 말이다. 「기록했어요」 줄도 그대로
- **해석(「요약」)은 저장하지 않고 답 말풍선의 곁 정보에 「짐작」으로 둔다**(`meta.guesses`). 답 아래 「버디의 짐작 · …」 한 줄과
  칩 둘(「맞아요」 「아니에요」)
- **「맞아요」** → 그 자리에서 요약(L2)으로 저장(`sourceMessageId` 는 그 질문, 시점은 지금 질문의 D+), 짐작 줄은 「기록했어요」 줄로 바뀐다.
  **「아니에요」** → 저장 없이 줄만 사라진다. 원문 대화는 그대로 남아 나중에 다시 증류할 수 있다
- 누르지 않은 짐작은 그 답에 그대로 남는다 — 재촉하지 않는다. 다음 답이 같은 짐작을 또 내놓으면 또 보인다(새 근거일 수 있다). 확인한 뒤에는
  같은 문구가 기록에 있어 다시 안 나온다
- 짐작은 기기 DB 의 말풍선 곁 정보에만 있다 — 기록(record)이 아니므로 모델에 보내는 기록 30줄에도, 지식 지도에도 들어가지 않는다

## 손댄 파일

```
src/data/chat.ts                 answer meta 에 guesses(Guess[])
src/hooks/use-malkong.ts         요약 제안은 짐작으로 · confirmGuess · dismissGuess
src/components/chat-bubbles.tsx  GuessRow(아이콘 · 문구 · 칩 둘), AnswerBubble 에 onConfirmGuess · onDismissGuess
src/app/(tabs)/index.tsx         연결
docs/menu-spec/ask.md            SPEC-ASK-12, HOW 「L2 추출 규칙」 · 「현재 구현」
docs/architecture/knowledge-layers.md 「채워지는 경로」 답변의 기록 제안
```

## 확인

tsc · lint 통과. 웹판 390px, 서버는 가짜 응답(모델 호출 0): 「요약」 제안이 든 답에 「버디의 짐작 · 등센서가 심한 편」과 칩 둘이 보인다
(`.playwright-mcp/g-1-guess.png`) → 「맞아요」를 누르면 「기록했어요 · 등센서가 심한 편」으로 바뀌고 새로고침해도 남는다(`g-2-confirmed.png`) →
다른 짐작에 「아니에요」를 누르면 줄이 사라지고 기록은 생기지 않는다.

## 완료 조건

- [x] 요약 제안은 자동 저장되지 않고 짐작으로 보인다
- [x] 「맞아요」 → 요약 기록 + 「기록했어요」, 「아니에요」 → 저장 없이 사라짐
- [x] 사실 제안은 지금처럼 자동 저장
- [x] tsc · lint 통과, 웹 화면 확인
