#!/bin/zsh
# 홍보 만화를 PNG 로 — 크롬 헤드리스로 컷마다 1080×1350 스크린샷. 사용: ./render.sh [컷 번호 …] (없으면 1~9)
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p out
N=5  # 컷 수 — panels.js · reel.html · make-reel.swift 와 맞춘다

# ./render.sh reel — 컷 PNG(out/)로 릴스 9:16 장면(reel/)을 만들고 mp4 로 잇는다
if [[ $1 == reel ]]; then
  mkdir -p reel
  for p in {1..$N}; do
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
      --window-size=1080,1920 --virtual-time-budget=4000 --allow-file-access-from-files \
      --screenshot="$PWD/reel/$(printf "%02d" $p).png" "file://$PWD/reel.html?p=$p" >/dev/null 2>&1
  done
  swiftc -O make-reel.swift -o "${TMPDIR:-/tmp}/make-reel" 2>&1 | grep -v warning
  "${TMPDIR:-/tmp}/make-reel"
  exit
fi

# ./render.sh app — out/ 의 컷을 앱 처음 실행 만화로 옮긴다(assets/images/intro/, SPEC-MY-07)
if [[ $1 == app ]]; then
  mkdir -p ../../assets/images/intro
  for p in {1..$N}; do cp "out/$(printf "%02d" $p).png" ../../assets/images/intro/; done
  ls ../../assets/images/intro
  exit
fi

# ./render.sh grid — out/ 의 컷을 세 칸씩 모은 한눈에 보기(out/한눈에.png)
if [[ $1 == grid ]]; then
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1232,$(( (N + 2) / 3 * 508 + 8 )) --virtual-time-budget=3000 --allow-file-access-from-files \
    --screenshot="$PWD/out/한눈에.png" "file://$PWD/grid.html?n=$N" >/dev/null 2>&1
  echo "out/한눈에.png"
  exit
fi

panels=("$@")
[[ ${#panels} -eq 0 ]] && panels=({1..$N})
for p in $panels; do
  [[ $p == <-> ]] && name=$(printf "%02d" $p) || name=$p
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1080,1350 --virtual-time-budget=6000 --allow-file-access-from-files \
    --screenshot="$PWD/out/$name.png" "file://$PWD/toon.html?p=$p" >/dev/null 2>&1
  echo "out/$name.png"
done
