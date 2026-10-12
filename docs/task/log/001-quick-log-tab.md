# 001 기록 탭 — 빠른 기록 · 재는 중 · 오늘 기록 · 일주일 그래프 · 수유 알림 · 가족 맞추기

> 상태: 구현 완료 (2026-10-12) — 서버 배포(가족 맞추기의 events)는 Julian 승인 뒤, 폰 실측은 Julian
> 근거: [log](../../menu-spec/log.md) SPEC-LOG-01~07 · [constitution](../../constitution.md) 5 · [decisions/023](../../decisions/023-quick-log-first-tab.md)

## 목표

Julian(2026-10-12): 「베이비타임 핵심을 우리 앱에 넣자 — 헌장 5조 바꾸고, 첫 iOS 판에 넣고, 기록을 첫 탭으로」.
매일 여는 이유(기록)를 만들고, 그 기록을 버디가 읽게 한다.

## 정한 것

- **기록 일곱**: 모유(왼쪽 · 오른쪽 시작 또는 먹인 시간만) · 분유(ml, ±10과 칩) · 기저귀(소변 · 대변 · 둘 다 — 고르면 바로 저장) ·
  잠(지금 잠들었어요 또는 지난 잠) · 체온 · 몸무게 · 키. 때는 「지금」이 기본, 칩(10분 · 30분 · 1시간 · 3시간 전)과 ±5분
- **재는 중**: 끝이 빈 줄이 재는 중이다(모유 · 잠 각각 하나). 맨 위 카드에 시계가 돌고 「끝」 · 「반대쪽」 · 「깼어요」. 잠 단추를 다시 누르면 깬다
- **세는 법**: 쪽을 바꾼 모유(앞 모유가 끝난 뒤 10분 안에 시작)는 수유 한 번. 자정을 넘긴 잠은 날마다 나눠 센다. 「평소」는 오늘을 뺀
  지난 7일 가운데 기록한 날의 평균(이틀이 안 되면 보이지 않는다). 정상 · 이상은 판정하지 않는다
- **수유 알림**: 마지막 수유 시작(쪽을 바꿨으면 첫 쪽) + 정한 시간(기본 3시간, 2~4시간). 모유를 재는 중이면 걸지 않는다. 기록이 바뀔 때마다
  다시 건다. 허락은 처음 수유를 적을 때 한 번 묻는다. 마이 → 알림에서 끄거나 바꾼다. 알림 글에 아기 정보 · 기록 내용 없음
- **체온 위험 안내**: 12시간 안의 마지막 체온이 40℃ 이상이면 k-warn-0002, 3개월 미만이고 38℃ 이상이면 k-warn-0001 을 출처와 함께 고정 문장으로(헌장 2)
- **버디와 잇기**: 질문 주제에 닿는 요약 줄(최근 24시간 수유 · 잠 · 기저귀, 48시간 안의 체온, 마지막 몸무게 · 키, 평소 하루 수유)을 기록 앞에 싣는다
  (`ask-context.ts` `eventLinesForAsk`). 기록 요청(SPEC-BABY-07)은 빠른 기록도 기록으로 센다
- **탭**: 기록(첫 화면, 젖병 아이콘) · 버디(`/chat`) · 우리 아기 · 일정 · 마이. 아침 브리핑 알림을 누르면 버디 탭으로 연다
- **가족 맞추기**: `/v1/family/sync` 의 `events[]`. 서버는 기록 표에 `_event` 표시를 달아 같은 번호로 맞추고 돌려줄 때 가른다.
  옛 서버는 events 를 버리므로 앱은 빠른 기록의 「올린 때」를 따로 두고(`family.eventsPushedAt`), 서버가 받아 줬을 때만 넘긴다
- 광고는 기록 탭 맨 아래(단추와 멀리)

## 손댄 파일

```
src/data/events.ts · event-summary.ts · events-context.tsx (새) · db.ts · db.web.ts · preferences-context.tsx · notifications.ts(.web)
src/data/ask-context.ts · family.ts · family-context.tsx · api.ts · legal.ts
src/app/(tabs)/index.tsx (새 기록 탭) · (tabs)/chat.tsx (옛 index) · (tabs)/_layout.tsx · log-stats.tsx (새) · notifications.tsx · _layout.tsx · (tabs)/my.tsx
src/components/log/kinds.ts · log-sheet.tsx · charts.tsx (새) · record-nudge.tsx · 대화로 가는 길(day-view · records-view · use-briefing-answer)
src/hooks/use-malkong.ts
server/app/domain/family/schema.py · service.py · tests/test_family.py
docs: constitution 5 · decisions/023 · menu-spec/log.md (새) · main-design · app-design · backend 기기 DB · api-contract · docs/README
```

## 확인

- 앱: tsc · lint. 요약 계산을 따로 돌려 열 가지 — 쪽 바꾸기는 수유 한 번 · 자정 넘긴 잠은 0~5시만 · 기저귀 둘 다 · 모유 시간 합 · 마지막 수유 시작 ·
  3시간 알림이 이미 지났으면 없음 · 4시간 알림 · 1분 미만 · 막 시작한 잠
- 웹(390px, 생후 50일, 서버는 가짜 답 — 모델 호출 0)에서 눌러 열여섯 가지: 첫 화면이 기록 탭 · 분유 150ml · 마지막 수유 · 기저귀 대변 두 번에 ·
  잠 시작 → 자는 중 카드 → 깼어요 · 모유 왼쪽 → 반대쪽 → 끝 · 체온 38℃ → 3개월 미만 위험 안내 · 몸무게 5.2kg · 분유 줄 눌러 180ml 로 고치기 ·
  그래프 화면 · 대화 탭에서 수유 질문 → 「최근 24시간 수유 …」 줄이 실리고 몸무게 · 체온 줄은 안 실림
- 서버: ruff · pytest(가족 시험 13 — 빠른 기록이 기록과 갈라져 오고 표시가 새지 않음 · 늦게 고친 잠 · 지운 빠른 기록 · 모르는 종류 422)

## 완료 조건

- [x] SPEC-LOG-01~05 · 07 구현, 06 은 질문 맥락까지(브리핑 요약은 다음)
- [x] tsc · lint · 서버 시험 · 웹 한 바퀴
- [ ] 서버 배포(Julian 승인) — 그 전에도 기록 탭은 돈다. 가족 맞추기의 빠른 기록만 배포 뒤
- [ ] Julian 폰 실측 — 알림이 정한 때 오는지, 앱을 껐다 켜도 재는 중이 이어지는지, 두 폰 맞추기
- [ ] 스토어 스크린샷에 기록 탭 한 장
