# 011 이름 바꾸기 — 육아버디 · 버디 · 마스코트 말콩이

> 상태: 진행 (2026-10-03) — 앱·서버 코드와 문서 반영 완료. 서버 배포(버디 말투)는 Julian 허락 뒤
> 근거: [decisions/014](../../decisions/014-name-yugabuddy.md)

## 바꾼 것

- 앱 이름 `육아버디`(app.json `name`), 식별자 `com.yugabuddy.app`(iOS · Android), scheme `yugabuddy`
- 화면 글: 대화 탭 「버디」, 대화 머리 「육아버디」, 「버디가 정리했어요」 · 「버디가 아는 콩이」 · 「버디에게 물어보기」,
  온보딩 「육아버디를 시작할게요」 · 「매일 아침, 버디가 먼저 챙길게요」, 알림 「버디가 정리해 뒀어요」, 약관·개인정보·FAQ 의 서비스 이름
- 서버: 시스템 프롬프트 「너는 「육아버디」 앱의 육아 도우미 버디다」, 판단 고정 문장 「버디가 판단해 드릴 수는 없어요」
- 문서: 제품 브리프 「이름」 절 · 슬로건, README · AGENTS 제목, 탭 이름. 지난 기록(changelog · 끝난 task)은 그때 이름 그대로 둔다
- 그대로 둔 것: 마스코트 그림(쪽쪽이 문 아기 · 붉은 말)과 그 주석, 코드명 malkong(저장소 · GCP · Cloud Run · EAS slug · `MALKONG_`)

## 완료 조건

- [x] tsc · lint · ruff · pytest(316)
- [ ] 서버 배포 — 버디라는 이름으로 답한다
- [ ] Julian: `yugabuddy.com` · `yugabuddy.kr` 구입, KIPRIS 「육아버디」 검색 · 변리사 상담
