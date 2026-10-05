#!/bin/zsh
# 스토어 스크린샷 — answer-flow.html 을 크롬 헤드리스로 찍는다.
# out/answer-flow-ios.png(1290×2796, 앱스토어 6.9") · out/answer-flow-play.png(1080×1920, 구글 플레이 9:16)
# 앱 화면(shots/answer.png)은 웹 개발 서버를 띄우고 `node capture.mjs` 로 먼저 찍는다
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p out
if [[ -f shots/answer.png ]]; then
  sips -c 150 1170 --cropOffset 1 0 shots/answer.png --out shots/answer-head.png >/dev/null
  sips -c 930 1170 --cropOffset 950 0 shots/answer.png --out shots/answer-qa.png >/dev/null
fi
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1290,2796 \
  --virtual-time-budget=6000 --allow-file-access-from-files \
  --screenshot="$PWD/out/answer-flow-ios.png" "file://$PWD/answer-flow.html?v=ios" >/dev/null 2>&1
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=0.8372093 --window-size=1290,2293 \
  --virtual-time-budget=6000 --allow-file-access-from-files \
  --screenshot="$PWD/out/answer-flow-play.png" "file://$PWD/answer-flow.html?v=play" >/dev/null 2>&1
sips -g pixelWidth -g pixelHeight out/*.png | grep -v "^/" | paste - -
