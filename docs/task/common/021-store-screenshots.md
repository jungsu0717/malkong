# 021 스토어 스크린샷 — 남은 다섯 장과 구글 플레이 그래픽

> 상태: 끝 (2026-10-12)
> 근거: [store-toon](../../product/store-toon.md) 「스토어 스크린샷 5장」 · [product-brief](../../product/product-brief.md) 「스토어 등록 소스」 ·
> README 「다음 시작점」 6

## 목표

스토어 등록에 쓸 스크린샷을 끝낸다. 첫 장(흐름도 + 진짜 답 화면)은 됐고(2026-10-06), 남은 것은 store-toon 표의 1-2 · 2 · 3 · 4 · 5 —
**진짜 앱 화면 + 만화 아빠 한 컷 + 문구 한 줄**. 앱스토어 6.9"(1290×2796)와 구글 플레이 9:16(1080×1920) 두 크기.
구글 플레이 그래픽 이미지(1024×500)도 만든다.

## 정한 것

- **앱 화면은 진짜다** — 웹 빌드(`npx expo export --platform web`)를 띄우고 크롬을 원격 조종해 찍는다. 서버로 가는 요청은 미리 정한 답으로
  바꿔 넣는다(모델 호출 0). 답 본문은 L1 승인 항목의 문장 그대로, 위험 신호 답은 서버 `REDFLAG_HEAD · TAIL` 문장 그대로
- **이 PC(WSL)에서도 찍는다** — `chrome.mjs` 가 크롬을 맥 · 리눅스(Playwright 크로미움) 순서로 찾고, `capture.mjs` 는 정적 파일 서버를
  스스로 띄운다(python · sips · zsh 없이). `render.mjs` 가 `render.sh` 를 대신한다. 첫 장의 잘라 붙이기도 sips 대신 CSS 로
- 문구는 store-toon 표 그대로. 아빠 표정은 touched · suspicious · focused · proud · sleep(아기 안고, 말풍선 없이 「쿨쿨」)
- 모양은 첫 장과 같은 디자인 언어 — 밝은 바탕 · 먹색 · 코랄 하나 · IBM Plex Sans KR. 아빠는 손그림 선(`marketing/toon/draw.js` 를 그대로 쓴다).
  말풍선이 본문을 가리지 않게 3 · 4장은 앱 머리 줄 + 질문부터 이어 붙였고(브리핑 카드 건너뜀), 5장은 달력부터 보인다
- 장면 씨앗: 2장 어제 저녁 「체온 38.2℃」 기록 → 아침 8시 안부(시계를 8시로 맞춤, 대화를 맨 위로) · 3장 4개월 접종 질문 · 4장 생후 2개월 열 38.5도 ·
  5장 오늘이 딱 4개월 되는 날(달력 오늘에 점) · 6장 기록 9개 · 질문 12번. 아기 이름은 「말콩이」
- 첫 장도 다시 찍었다 — 답 꼬리표가 「공공 기준」에서 「출처 있음」으로 바뀌어서(task common/020)

## 손댄 파일

```
marketing/store/capture.mjs     앱 화면 여섯 장 — answer · vaccine4 · redflag · schedule · baby · briefing (shots/)
marketing/store/chrome.mjs      크롬 찾기(맥 · 리눅스)
marketing/store/store.html      2~6장 틀(?p=briefing|sources|redflag|schedule|baby&v=ios|play)
marketing/store/answer-flow.html  첫 장 — 자르기를 sips 대신 CSS 로
marketing/store/feature.html    구글 플레이 그래픽 1024×500
marketing/store/render.mjs      전부 찍기(render.sh 삭제)
marketing/store/out/            01-flow · 02-briefing · 03-sources · 04-redflag · 05-schedule · 06-baby (-ios · -play) · feature.png
docs/product/store-toon.md      상태 · 2~6장 설명 · 만드는 법
```

## 확인

- 앱 화면 여섯 장을 WSL 의 Playwright 크로미움으로 찍었다(모델 호출 0). 열세 장을 전부 눈으로 봤다 — 처음 판은 말풍선이 답 본문 · 출처 · 일정 줄을
  가려서 3 · 4장은 질문부터 이어 붙이고 5장은 달력부터 보이게 했고, 아빠는 오른쪽 가장자리에 잘리지 않게 안으로 들였다. 크기는 PNG 머리에서 읽어
  1290×2796 · 1080×1920 · 1024×500 확인

## 완료 조건

- [x] 앱 화면 여섯 장이 최신 문구로 찍힌다(모델 호출 0)
- [x] 2~6장 iOS · Play 두 크기, 첫 장 다시
- [x] 구글 플레이 그래픽 1024×500
- [x] 겹침 · 잘림을 직접 보고 확인, store-toon 「만드는 법」 갱신, 결과물은 `out/` 에 커밋
- [ ] Julian 이 보고 고칠 것을 말한다(문구 · 아빠 표정 · 장면)
