# 003 기록 되살리기 — 홈 맨 위 기록 칸, 누가 남겼는지, 가족과 다시 맞추기

> 상태: 구현 완료 (2026-10-30) · 서버의 `by` 와 개인정보 처리방침 페이지는 운영 배포 뒤(Julian 승인) · 폰 확인은 다음 TestFlight
> 근거: [log](../../menu-spec/log.md) SPEC-LOG-01~05 · 07 · [main](../../menu-spec/main.md) SPEC-MAIN-08 · [my](../../menu-spec/my.md) SPEC-MY-05 ·
> [decisions/036](../../decisions/036-records-for-family.md)

## 목표 (Julian, 2026-10-30)

광고 수익만으로 급여 수준을 벌려면 하루에 여러 번 여는 앱이어야 한다. 기록을 되살리되, 기록만으로는 고를 이유가 없으니
가족(할머니 · 할아버지까지)이 아기 하루를 함께 보는 쪽으로 간다. 「시안 말고 그냥 해봐」.

## 정한 것

- **2026-10-19 에 뺀 코드를 되살렸다**(c17254e 바로 앞 판) — `events.ts` · `events-context.tsx` · `event-summary.ts` · `care-reminders.ts` · 기록 화면 `log.tsx` ·
  그래프 `log-stats.tsx` · 입력 시트 · 기록 종류 · 차트. 폰 저장소 `care_event` 표와 웹 저장소, 가족 맞추기의 `events`
- **홈 맨 위 「기록」 칸**(`log-mini.tsx`) — 재는 중(시계 · 끝내기), 「마지막 수유 2시간 10분 전」과 그 수유 · 시각 · 누가, 단추 넷(모유 · 분유 · 기저귀 · 잠),
  오늘 합계 한 줄. 체온 · 키 · 몸무게 · 날짜별 기록 · 그래프는 「전체 ›」의 기록 화면. 시계는 칸 안에서만 1초마다 다시 그린다(홈 전체가 아니라)
- **단추를 누를 때의 흐름을 한 곳에**(`use-log-actions.tsx`) — 홈과 기록 화면이 같은 시트 · 시작 · 끝내기를 쓴다
- **누가 남겼는지**: `care_event.by`(가족 공유를 켠 폰의 「가족에게 보일 이름」). 기록 줄 · 마지막 수유 줄에 「오후 1:05 · 할머니」.
  서버 `EventIn.by`(20자) — 운영 배포 전에는 옛 서버가 버리므로 다른 폰에 이름이 안 간다. 받은 줄에 `by` 가 없으면 가진 이름을 지우지 않는다
- **기록 동의**: 가족 동의 문장에 수유 · 기저귀 · 잠 · 체온 · 키 · 몸무게 기록을 넣었다. 이 날 전에 가족에 들어간 폰(Julian 집)은 동의 문장에 기록이 없었으므로
  기록 화면에 「가족과 기록도 함께 볼까요?」 카드 — 동의하면 그 폰의 기록을 처음부터 올린다. 가족이 남긴 기록은 동의 전에도 받는다.
  settings `family.eventsConsentedAt`, 가족을 만들거나 참여할 때 함께 적힌다
- **가족 초대 카드**(`family-invite.tsx`) — 가족이 없는 폰의 홈, 기록 칸 아래. 「할머니, 할아버지도 함께 봐요」, × 로 닫으면 그 폰에서 다시 안 보인다
- **기록 알림**: 마이 → 알림에 「기록 알림」 스위치(수유 · 기저귀 · 잠, 기본 꺼짐), 켜면 기준 줄. 날마다 같은 때 오던 체온 알림은 다시 걸지 않고, 예전 것은 지운다
- 기록 화면의 「오늘 할 일 N개」 줄은 뺐다 — 홈에 이미 있다. AI 질문용 요약(`contextLines` · `eventFacts`)도 지웠다
- `events.ts` 는 저장소를 부르지 않게 나눴다(읽고 쓰기는 `db.ts`) — node 시험이 바로 읽는다
- 개인정보 처리방침 · 이용약관에 기록을 넣고 시행일을 2026년 10월 30일로, 서버 페이지를 다시 만들었다(`scripts/export-legal.mjs`)

## 손댄 파일

```
src/app/(tabs)/index.tsx            홈 — 기록 칸 · 가족 초대 카드
src/components/home/log-mini.tsx    홈 기록 칸 (새로)
src/components/home/family-invite.tsx 가족 초대 카드 (새로)
src/components/log/*                되살림 · use-log-actions (새로)
src/app/log.tsx · log-stats.tsx     되살림 — 누가, 기록 동의 카드, 공유 훅
src/data/events*.ts(x) · event-summary(.test).ts · care-reminders.ts  되살림 · by · 시험
src/data/db(.web).ts · family.ts · family-context.tsx · api.ts · sync-events.ts  저장 · 가족 맞추기 · 동의
src/data/notifications(.web).ts · preferences-context.tsx · src/app/notifications.tsx  기록 알림
src/app/family.tsx · src/data/legal.ts · server/app/data/legal/*  동의 문장 · 처리방침
server/app/domain/family/schema.py · server/tests/test_family.py  EventIn.by
docs/menu-spec/log.md · main.md · my.md · docs/architecture/* · decisions/036
```

## 확인

- node 시험(기록 요약 6개 더함) · 서버 시험 · tsc · lint · copy-check
- 브라우저(웹 내보내기): 홈 기록 칸에서 분유 · 기저귀 · 잠 시작과 끝내기, 기록 화면의 날짜별 줄, 가족 초대 카드 닫기

## 완료 조건

- [x] (SPEC-LOG-01~03 · SPEC-MAIN-08) 홈 기록 칸과 기록 화면
- [x] (SPEC-LOG-05) 기록 알림 스위치
- [x] (SPEC-LOG-07 · SPEC-MY-05) 가족 맞추기 · 누가 · 기록 동의
- [ ] 서버 운영 배포 — `by` 와 처리방침 페이지 (Julian 승인)
- [ ] 폰: 두 폰에서 기록이 맞춰지고 이름이 보이는지 (다음 TestFlight)
