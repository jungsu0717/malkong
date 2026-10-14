# 007 가족 공유 — 초대 코드로, 로그인 없이

> 상태: 끝 (2026-10-12) — Cloud Run revision 00015 에 올라가 있다
> 근거: [my](../../menu-spec/my.md) SPEC-MY-05 가족 공유(이 task 에서 「나중」을 「평시」로 바꾼다) · SPEC-MY-04 로그인(그대로 「나중」) ·
> [backend](../../architecture/backend.md) 「DB — 두 단계」 가족 공유 줄 · [api-contract](../../architecture/api-contract.md) `/v1/family` ·
> [decisions/021](../../decisions/021-family-by-invite-code.md)

## 목표

Julian(2026-10-12): 「가족 공유 그냥 만들어서 넣자」 → 두 길 가운데 **A. 초대 코드**를 골랐다 — 로그인 없이 기기 키로 가족을 만들고,
초대 코드로 아내 폰을 붙인다. 지금 Expo Go 로 두 사람이 바로 써 볼 수 있어야 한다. 로그인(Apple + 카카오)은 애플 개발자 등록 ·
개발 빌드 뒤에 「내 계정에 가족 묶기」로 붙인다(SPEC-MY-04).

## 정한 것

- **정체는 기기 키.** 가족은 `family(id, invite_code)` 와 구성원 `family_member(device_hash)` 로, 한 기기는 한 가족에만 든다. 운영자(가족) 기기도 같다
- **초대 코드 6자리**(헷갈리는 글자 I · O · 0 · 1 · L 뺀 알파벳 · 숫자). 가족마다 하나, 바뀌지 않는다. 구성원은 6명까지.
  코드 맞히기 시도는 기기마다 하루 20번
- **올라가는 것은 아기(이름 · 생일)와 기록(L2)뿐.** 대화는 올라가지 않는다(SPEC-MY-05 · backend). 기록은 파일 한 줄 그대로
  (`record` 표의 칸들) JSON 으로 저장하고, 지운 기록은 「지웠다」 표시(tombstone)로 남겨 다른 폰에서도 지워지게 한다
- **맞추는 규칙은 「마지막으로 고친 쪽이 이긴다」** — 기록 · 아기 모두 `updatedAt`(폰이 적은 ISO 시각) 비교. 폰 시계가 서로 달라도
  같은 기록을 동시에 고치는 일이 드물어 충분하다. 서버는 가족마다 늘어나는 번호(`seq`)를 매겨 폰이 「그 뒤에 바뀐 것만」 받는다
- **한 번에 하나의 API.** `POST /v1/family/sync` 에 내 변경(아기 · 기록 · 지운 것)을 싣고, 답으로 그 뒤 바뀐 것 전부를 받는다.
  폰은 앱을 열 때 · 앞으로 올 때 · 기록이나 아기를 고친 뒤(1.5초 모아서) 부른다. 서버에 닿지 못하면 조용히 다음에
- **들어갈 때 아기는 가족 것이 이긴다.** 코드로 들어간 폰에 이미 아기가 있어도 가족의 아기로 바꾼다(한 아기를 보는 것이 목적).
  기록은 양쪽 것을 합친다. 가족에 아기가 아직 없으면 들어간 폰의 아기를 올린다
- **나가기**는 구성원에서 빠지는 것. 마지막 사람이 나가면 가족과 데이터를 서버에서 지운다. 폰의 데이터는 그대로 남는다
- **동의를 따로 받는다** — 「아기 이름 · 생일 · 건강 기록을 육아버디 서버에 저장하고 가족과 공유」 한 칸. 아기 기록은 건강에 관한
  정보라 개인정보 보호법의 민감정보다. 동의한 때를 구성원 행에 남긴다(`consented_at`). 개인정보 처리방침에 「가족 공유를 켜면」 절을
  더한다. 문구는 출시 전 법률 검토 항목
- 화면: 마이 「가족과 함께 보기」 한 줄 → `/family`. 가족이 없으면 설명 + 동의 + 「가족 만들기」 · 「초대 코드로 들어가기」,
  있으면 초대 코드(복사 · 공유) · 구성원 수 · 마지막으로 맞춘 때 · 「나가기」

## 손댄 파일

```
server/app/infra/db/family_store.py          가족 · 구성원 · 아기 · 기록 저장소(메모리 · Postgres), LWW · seq
server/app/domain/family/{schema,service,router}.py   POST /family · /family/join · GET /family · DELETE /family/me · POST /family/sync
server/app/main.py                           라우터 등록
server/tests/test_family.py                  만들기 · 들어가기 · 가득 · 나가기 · 맞추기(LWW · 지움 · 번호)
src/data/family.ts · family-context.tsx       폰 쪽 상태(설정 칸) · 맞추기 · 적용
src/data/sync-events.ts                      기록 · 아기가 바뀌면 맞추기를 요청하는 작은 신호
src/data/records.ts · baby.ts · db.ts · db.web.ts   updatedAt · 받은 것 덮어쓰기(upsert) · 지운 기록 표시
src/data/records-context.tsx · baby-context.tsx     reload · 바뀌면 신호
src/app/family.tsx · src/app/_layout.tsx · src/app/(tabs)/my.tsx   화면 · 길 · 마이 한 줄
src/data/api.ts · legal.ts                   API · 개인정보 처리방침
docs: api-contract · backend · my · decisions/021 · README
```

## 확인

- 서버: ruff · pytest 390 passed(가족 시험 11 — 만들기 · 코드(소문자도) · 틀린 코드 · 다른 가족 · 가득 · 하루 20번 · 나가기와 마지막
  사람 · 기록 LWW · 번호 · 지움 · 아기 LWW · 가족 없음). Postgres SQL 은 pgserver(3.12)로 `tests/test_pg_store.py` 가족 표 시험까지
  6 passed — ON CONFLICT … WHERE 와 `nextval('family_record_seq_seq')` 가 실제 Postgres 에서 돈다
- 앱: tsc · lint. 로컬 서버(메모리 저장소) + 웹판을 브라우저 창 둘(폰 A 「하율」 · 폰 B 「둘째」)로 열어 — A 가 가족을 만들고(코드 6자리),
  B 가 코드로 들어가 폰 2대, B 의 아기 이름이 가족의 「하율」로 바뀌고, A 가 적은 기록이 B 에 뜨고, B 가 적은 기록이 A 를 다시 열면
  오고, A 가 지운 기록이 B 에서도 사라지고, B 가 나가면 A 는 1대, A 까지 나가면 그 코드로 다시 못 들어온다(「맞는 초대 코드가 없어요」).
  모델 호출 0. 웹에서 나가기가 안 되던 것은 서버 CORS 가 DELETE 를 막아서였다(폰 앱은 CORS 와 무관) — 허용 목록에 더했다

## 완료 조건

- [x] 가족 만들기 · 코드로 들어가기 · 나가기 · 가득 참 · 틀린 코드 · 이미 가족 있음이 계약대로 답한다
- [x] 맞추기: 번호 뒤의 것만 받는다 · 늦게 고친 쪽이 이긴다 · 지운 기록이 다른 폰에서도 지워진다 · 들어갈 때 가족 아기가 이긴다
- [x] 폰: 마이 → 가족 화면 → 동의 → 만들기 / 들어가기 → 코드 공유 → 나가기. 기록 · 아기가 바뀌면 1.5초 안에 올라가고 앱을 열면 받는다
- [x] 개인정보 처리방침에 가족 공유 절(4번), SPEC-MY-05 평시, backend DB 표, api-contract, ADR 021
- [x] tsc · lint · pytest · 두 창 시험
- [x] 서버 배포 — Julian 이 직접 쳐서 revision 00015(2026-10-12). 운영 주소에서 `/health` ok, 시험 키로 `GET /v1/family` → 404 NOT_IN_FAMILY
  (Postgres 가족 표가 답했다 · 로그에 메모리 저장소로 돈다는 경고 없음), 키 없이 → 401, DELETE 프리플라이트 200
- [ ] Julian · 아내 폰으로 써 본다
