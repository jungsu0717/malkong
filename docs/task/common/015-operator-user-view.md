# 015 가족 기기의 「일반 사용자로 보기」 숨은 스위치

> 상태: 완료 (2026-10-06) — 서버 배포는 Julian 폰을 가족 기기로 등록할 때 함께(common/005, Julian 승인)
> 근거: [backend](../../architecture/backend.md) 「운영자(가족) 기기」(이 task 에서 정의를 고친다) ·
> [api-contract](../../architecture/api-contract.md) 「GET /v1/entitlements」 · [my.md](../../menu-spec/my.md) 버전 줄
> 횡단(common): 서버 자격 · 앱 자격 · 마이 숨은 메뉴가 함께 바뀐다

## 목표

Julian 이 자기 폰 하나로 「가족(한도 없음)」과 「일반 사용자(한도 · 광고 · 하루 천장)」를 오가며 시험한다(Julian 요청, 2026-10-06).
스위치는 버전 글자를 길게 눌러야 보이는 숨은 메뉴에 두고, 가족 기기에만 보인다.

## 정한 것

- **서버가 판단한다.** 앱은 요청 머리 `X-As-User: 1` 을 싣기만 하고, 서버는 그 키가 가족 명단에 있을 때만 이 머리를 보고
  그 요청을 일반 기기처럼 다룬다. 권한을 낮추기만 하므로 일반 기기가 실어도 아무 일도 없다
- 키를 둘 쓰는 방법(가족 키와 일반 키를 번갈아 쓰기)은 버렸다 — 숨은 메뉴를 찾은 일반 사용자가 키를 바꿔 한도를 두 배로
  쓸 수 있고, 가족 기기인지 앱이 따로 기억해야 해서다
- 일반 사용자로 보는 동안의 횟수는 그 가족 키로 센다. 광고 충전 · 일반 기준 답 · 하루 천장도 일반 기기와 똑같다
- 자격 응답에 `operator`(이 키가 가족 명단에 있는지)를 더한다. 일반 사용자로 보는 중에도 true 라서 앱이 스위치를 계속 보인다
- 스위치 값은 기기 settings 에 둔다(`as_user`). 바꾸면 자격을 바로 다시 받는다

## 손댈 파일

```
server/app/domain/entitlements/service.py · schema.py · router.py   머리를 받아 Device 를 정하고, 자격에 operator
server/app/domain/ask/router.py · service.py                         /v1/ask 도 머리를 받는다
server/tests/test_usage.py                                           일반 사용자로 보기 시험
src/data/api.ts · entitlements.ts · entitlements-context.tsx         머리 싣기, operator, 스위치 바꾸면 자격 다시 받기
src/app/(tabs)/my.tsx                                                버전 길게 누르기 → 기기 키 + 스위치(가족 기기만)
docs/architecture/backend.md · api-contract.md · menu-spec/my.md
```

## 단계

1. ~~서버~~ — **완료.** 머리, Device(`operator` 는 면제를 적용할지, `operator_key` 는 명단에 있는지), 자격 응답, 시험 3건.
   웹 미리보기가 새 머리를 보낼 수 있게 CORS 허용 머리에도 더했다(기기 앱은 CORS 와 상관없다)
2. ~~앱~~ — **완료.** 머리 싣기, 스위치를 바꾸면 자격을 다시 받기, 숨은 메뉴(다시 길게 누르면 닫힌다)
3. ~~문서~~ — **완료.** backend 운영자 절 정의, api-contract, my.md
4. ~~확인~~ — **완료.** 로컬 서버(가족 키를 넣고 정밀 한도 0)와 웹판에서 모델을 부르지 않고 봤다 — 가족: 광고 자리 · 남은 횟수 없음,
   켜면: 광고 자리와 「오늘 정밀 답변 끝」이 바로 보임, 끄면 바로 사라짐. 일반 기기에서는 숨은 메뉴에 키만 보이고 스위치는 없다

## 완료 조건

- [x] (backend 운영자 기기) 가족 키에 `X-As-User: 1` 이 오면 한도 · 광고 · 하루 천장이 일반 기기와 같다
- [x] 일반 키에 그 머리가 와도 아무것도 바뀌지 않는다
- [x] 자격 응답의 `operator` 가 가족 키에서만 true 이고, 일반 사용자로 보는 중에도 true 다
- [x] 앱: 버전을 길게 누르면 기기 키가 보이고, 가족 기기면 「일반 사용자로 보기」 스위치도 보인다. 바꾸면 남은 횟수 표시가 바로 바뀐다
- [x] 서버: ruff · pytest 통과 / 앱: tsc · lint 통과
