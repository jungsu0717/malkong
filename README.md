# julian-studio

Julian 이 혼자 만드는 앱을 한 저장소에 모아 둔 곳입니다. 일하는 규칙은 [AGENTS.md](AGENTS.md), 문서와 작업 방식은
[docs/governance/conventions.md](docs/governance/conventions.md) 에 있습니다.

## 앱

| 폴더 | 서비스 | 지금 |
|---|---|---|
| [apps/malkong](apps/malkong/README.md) | 육아버디 — 아기 기록과 육아 질문에 출처와 함께 답하는 앱 | 첫 iOS 출시 준비 |
| [apps/planned](apps/planned/README.md) | Planned(플랜드) — 상황마다 할 일을 적고, 끝낸 할 일이 쌓여 다음에 먼저 보여 주는 앱 | 설계 시작 |

각 앱의 진행 상황은 그 앱 `README.md` 의 「지금 상태」「다음 시작점」에 있습니다.

## 폴더

| 폴더 | 담는 것 |
|---|---|
| `apps/<앱>/` | 앱 하나 — 앱 코드, 서버, 홍보 자료, 설계 문서(`docs/`) |
| `docs/governance/` | 모든 앱에 통하는 문서 규칙, 작업 순서, 출시 체크리스트 |
| `docs/_templates/` | 새 앱을 시작할 때 복사하는 문서 틀 |

## 다른 PC 에서 시작하기

Claude Code 의 메모리는 PC 마다 따로라서, 이어받는 기준은 이 저장소의 문서입니다. 아래는 git 에 없어서 PC 마다 새로
준비해야 하는 것 가운데 모든 앱에 공통인 것만 적었습니다. 앱마다 더 필요한 것은 그 앱 README 「다른 PC 에서 시작하기」에 있습니다.
새 PC 의 Claude 에게는 "README 다른 PC 에서 시작하기대로 준비해 줘" 라고 하면 됩니다.

- **코드 받기**: GitHub CLI(`gh`)를 깔고 `gh auth login`(개인 계정 jungsu0717, Julian 이 직접) →
  `gh repo clone jungsu0717/julian-studio`. 이미 받아 둔 PC 면 저장소 안에서 `git pull`
- **git 계정**: 이 저장소는 개인 계정(jungsu0717)으로만 커밋합니다. 회사 계정과 섞이지 않게 **저장소 로컬 설정**만 쓰고
  전역 설정은 건드리지 않습니다. 받은 저장소 안에서:
  ```bash
  git config --local user.name jungsu0717
  git config --local user.email 6903839+jungsu0717@users.noreply.github.com
  git config --local --add credential.https://github.com.helper ''
  git config --local --add credential.https://github.com.helper '!gh auth git-credential'
  ```
  (빈 helper 줄이 키체인에 남은 다른 계정 자격을 먼저 끊습니다)
- **앱**: Node 22.13 이상을 설치하고, 앱 폴더(`apps/<앱>/`)에서 `npm install`
- **Expo 로그인(아이폰 Expo Go 로 볼 때)**: 아이폰 Expo Go 는 PC 의 Expo CLI 와 **같은 계정으로 로그인**되어 있어야
  개발 서버의 앱을 엽니다. 계정은 구글로 가입한 `julian-malkong`(비밀번호 없음)이라 `npx expo login` 대신
  `npx eas-cli@latest login --device` 로 — 터미널에 뜨는 주소를 브라우저에서 열어 구글로 승인합니다. 폰의 Expo Go 도 같은 계정으로 로그인
- **WSL(윈도우) PC 에서 폰으로 볼 때**: WSL 은 윈도우 안의 가상 네트워크라 와이파이 주소로는 폰이 못 들어옵니다. 터널로 켭니다 —
  `npm i -g @expo/ngrok` 한 번, 그 뒤 앱 폴더에서 `npx expo start --go --tunnel`(QR 을 폰 카메라로).
  Claude Code 창의 `!` 명령은 비밀번호 · 승인 입력을 못 받으므로 로그인과 개발 서버는 따로 연 터미널에서
- **서버가 있는 앱**: uv 를 설치하고 그 앱의 `server/` 에서 `uv sync` (Python 은 uv 가 받습니다)
