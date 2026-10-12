# 019 지식 내려받기 — 스토어 심사 없이 지식(L1)만 새로 받는다

> 상태: 구현 완료 (2026-10-12) — 서버 배포는 Julian 승인 뒤
> 근거: [l1-knowledge-base](../../architecture/l1-knowledge-base.md) 「저장 위치와 로더」 평시 「항목에는 판 번호가 붙고, 앱은 자기 판과
> 서버 최신 판을 비교해 갱신받는다」 · [api-contract](../../architecture/api-contract.md) GET /v1/knowledge/version · bundle
> 횡단(common): 서버 + 앱 시작 흐름 + 지식 로더

## 목표

Julian(2026-10-12): 「지식이 낡으면 어쩌나. 리소스를 내려받을 수 있는 형태면 앱 심사 없이 되는 거잖아? 당연히 그래야지」.
지금까지 지식 77건은 앱 안에 실려 나가서, 질병관리청 일정이 바뀌어 항목을 고쳐도 사용자 폰에는 스토어 업데이트를 거쳐야 갔다.
서버는 언제든 다시 배포하면 되지만 앱 쪽(일정 탭 · 브리핑 · 지식 지도)은 그러지 못했다.

## 정한 것

- **판 번호의 정본은 `src/data/l1/version.json`**(`2026.10.3`, 연도.월.순번). `index.ts` 가 읽고, `scripts.sync_l1` 이 서버 사본에도
  같은 파일을 둔다. 서버 L1 저장소는 이 파일을 항목 파일로 읽지 않고 판 번호로 읽는다
- **증분 대신 통째로.** 계약 초안의 `bundle?since=<판>` + `removedIds` 를 버리고 승인 항목 전부를 준다 — 77건에 약 45KB 라
  작고, 지운 항목을 따로 관리할 필요가 없다. 받은 판이 새 것이면 앱의 지식 전체를 그 판으로 바꿔 끼운다
- **기기 키 없이 받는다** — 공공 지식이라 숨길 것이 없고 한도와도 상관없다
- **앱은** 열릴 때 ① 기기에 받아 둔 판을 먼저 얹고(첫 화면 전, 저장소 한 줄) ② 하루에 한 번 서버 판 번호를 물어 더 새 판이면
  묶음을 받아 저장하고 얹는다. 서버에 닿지 못하면 조용히 번들로 간다. 받은 판은 다음에 그리는 화면부터 쓰인다 —
  보고 있던 화면을 억지로 다시 그리지 않는다
- **의료 게이트는 앱에서도.** 받은 묶음은 번들과 같은 규칙(`findProblems`: 출처 · 분류 · 월령 · id 중복)으로 검사하고,
  승인된 항목만 남기며, 승인 항목이 0건이거나 규칙에 어긋나면 버린다. 자기 판보다 낡은 판도 버린다(앱을 업데이트한 뒤
  기기에 남은 옛 판이 새 번들을 덮지 않게)
- 지식을 고친 뒤 사용자에게 가는 길: 항목 고치기 → Julian 승인 → `version.json` 올리기 → `sync_l1` → 서버 배포 → 앱은 하루 안에 받는다.
  다음 앱 판에도 같은 파일이 실린다

## 손댄 파일

```
src/data/l1/version.json              판 번호 정본(새 파일)
src/data/l1/index.ts                  판 비교 · 묶음 검사 · 바꿔 끼우기(applyBundle), l1Version()
src/data/knowledge-update.ts          기기 저장 판 얹기 · 하루 한 번 서버 확인 · 받기(새 파일)
src/data/api.ts                       getKnowledgeVersion · getKnowledgeBundle(기기 키 없이)
src/app/_layout.tsx                   첫 화면 전에 받아 둔 판 얹기, 뒤에서 새 판 확인
src/app/(tabs)/my.tsx · src/data/legal.ts   판 번호 표시를 지금 쓰는 판(l1Version)으로
server/app/domain/knowledge/{router,schema,repository}.py   GET /v1/knowledge/version · bundle, 판 읽기, 묶음 원본
server/app/domain/ask/router.py       L1 저장소 팩토리를 knowledge 도메인으로 옮김
server/app/main.py                    knowledge 라우터 등록
server/eval/run.py                    version.json 건너뛰기
server/app/data/l1/version.json       사본(sync_l1)
server/tests/test_knowledge.py        판 · 묶음 · 초안 제외 · 판 파일 없을 때
docs/architecture/api-contract.md · l1-knowledge-base.md   계약과 갱신 절차 갱신
```

## 확인

- 서버: ruff · format · pytest 379 passed(새 시험 4). 로컬에서 띄워 받아 봄 — `/v1/knowledge/version` → `2026.10.3`,
  `/v1/knowledge/bundle` → 200, 44,477 bytes, 77건, 항목 열쇠가 번들 파일과 같다(`red_flag` 그대로). 모델 호출 0
- 앱: tsc · lint 통과. 웹판(`expo export`)을 390×844 로 열고 서버 응답을 가짜로 끼워(`/v1/**` 가로채기, 판 `2026.11.1` 과
  첫 항목 제목을 바꾼 77건 묶음) 봤다 — 열자마자 판을 묻고 묶음을 받아 기기 저장소에 `l1.bundle`(77건, 바꾼 제목 그대로,
  약 30K자)과 확인 시각을 적었다. 다시 켜니 서버에 묻지 않고(하루 안) 받아 둔 판이 첫 화면 전에 얹혀, 마이 → 「의학 정보
  출처와 한계 고지」의 「지금 판」이 `2026.11.1` 로 보였다. 모델 호출 0

## 완료 조건

- [x] 서버가 판 번호와 승인 항목 전부를 기기 키 없이 준다
- [x] 앱이 받아 둔 판을 첫 화면 전에 얹고, 하루 한 번 서버와 비교해 새 판을 받아 저장한다
- [x] 받은 묶음을 번들과 같은 규칙으로 검사하고 승인 항목만 쓴다. 낡은 판 · 빈 판 · 어긋난 판은 버린다
- [x] 계약 · 지식베이스 문서가 구현과 같다
- [ ] 서버 배포(Julian 승인) → 폰에서 마이 탭 개발 줄의 「판」이 바뀌는 것은 다음에 판을 올릴 때 본다
