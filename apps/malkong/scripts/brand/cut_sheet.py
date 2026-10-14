"""캐릭터 시트 한 장을 잘라 앱 그림을 만든다 — 배경(흰색) 걷기, 칸별 잘라내기."""
from collections import deque
from PIL import Image
import numpy as np, os, sys

SRC = Image.open('sheet.jpg').convert('RGB')
W, H = SRC.size
CW, CH = W / 3, H / 2
OUT = 'cut'; os.makedirs(OUT, exist_ok=True)

def cell(col, row, inset=14):
    x0, y0 = int(col * CW) + inset, int(row * CH) + inset
    x1, y1 = int((col + 1) * CW) - inset, int((row + 1) * CH) - inset
    return np.array(SRC.crop((x0, y0, x1, y1))).astype(np.int16)

def largest_only(rgba):
    """가장 큰 덩어리만 남긴다 — 그림자 찌꺼기 같은 떨어진 점을 지운다"""
    al = rgba[:, :, 3] > 30
    h, w = al.shape
    label = np.zeros((h, w), np.int32); sizes = [0]; cur = 0
    for sy in range(h):
        for sx in range(w):
            if al[sy, sx] and not label[sy, sx]:
                cur += 1; n = 0; q = deque([(sy, sx)]); label[sy, sx] = cur
                while q:
                    y, x = q.popleft(); n += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and al[ny, nx] and not label[ny, nx]:
                            label[ny, nx] = cur; q.append((ny, nx))
                sizes.append(n)
    keep = int(np.argmax(sizes))
    out = rgba.copy(); out[:, :, 3] = np.where(label == keep, out[:, :, 3], 0)
    return out

def remove_all_white(a):
    """@ 다리는 안쪽에도 흰색이 들어갈 일이 없다 — 밝은 무채색은 어디 있든 바탕"""
    mn = a.min(axis=2); mx = a.max(axis=2)
    bgish = (mn > 196) & ((mx - mn) < 34)
    alpha = np.where(bgish, 0, 255).astype(np.int16)
    light = a.mean(axis=2)
    soft = (~bgish) & (light > 150) & ((mx - mn) < 40)
    alpha[soft] = np.clip((255 - light[soft]) * 255 / 110, 0, 255).astype(np.int16)
    return np.dstack([a, alpha]).clip(0, 255).astype(np.uint8)

def remove_bg(a):
    """가장자리에서 이어진 밝고 무채색인 칸(흰 바탕 · 회색 그림자)을 투명하게. 안쪽 흰색(눈 반짝임)은 남는다"""
    h, w, _ = a.shape
    mn = a.min(axis=2); mx = a.max(axis=2)
    bgish = (mn > 196) & ((mx - mn) < 34)
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bgish[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bgish[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and bgish[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    alpha = np.where(seen, 0, 255).astype(np.int16)
    # 가장자리 한 겹 — 밝을수록 투명하게(바탕과 섞인 테두리 반쯤 흰 점)
    edge = (~seen) & (np.roll(seen, 1, 0) | np.roll(seen, -1, 0) | np.roll(seen, 1, 1) | np.roll(seen, -1, 1))
    light = a.mean(axis=2)
    alpha[edge] = np.clip((255 - light[edge]) * 255 / 110, 0, 255).astype(np.int16)
    return np.dstack([a, alpha]).clip(0, 255).astype(np.uint8)

def remove_bg_waves(a, color=(242, 128, 112)):
    """물결은 흰 바탕으로 흐려지는 그라디언트라 색을 빼서 알파로 — 초록 채널 기준"""
    g = a[:, :, 1].astype(float)
    alpha = np.clip((255 - g) / (255 - color[1]), 0, 1) * 255
    alpha[alpha < 24] = 0  # JPEG 잡티
    rgb = np.zeros_like(a); rgb[:] = color
    return np.dstack([rgb, alpha]).clip(0, 255).astype(np.uint8)

def trim(rgba, pad=8):
    al = rgba[:, :, 3]
    ys, xs = np.where(al > 30)
    y0, y1, x0, x1 = max(ys.min() - pad, 0), min(ys.max() + pad, al.shape[0]), max(xs.min() - pad, 0), min(xs.max() + pad, al.shape[1])
    return Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')

parts = {
    'mascot-standing': (0, 0, lambda a: largest_only(remove_bg(a))),
    'mascot-face': (2, 0, lambda a: largest_only(remove_bg(a))),
    'run-body': (0, 1, lambda a: largest_only(remove_bg(a))),
    'run-swirl': (1, 1, lambda a: largest_only(remove_all_white(a))),
    'run-waves': (2, 1, remove_bg_waves),
}
for name, (c, r, fn) in parts.items():
    img = trim(fn(cell(c, r)))
    img.save(f'{OUT}/{name}.png')
    print(name, img.size)

# 색 뽑기 — 우주복 노랑, 쪽쪽이 코랄, 테두리 갈색
a = cell(0, 0)
def sample(mask):
    px = a[mask]; return '#%02X%02X%02X' % tuple(np.median(px, axis=0).astype(int))
r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
print('onesie', sample((r > 230) & (g > 200) & (b < 175) & (b > 100)))
print('coral', sample((r > 220) & (g < 150) & (g > 80) & (b < 140)))
print('outline', sample((r < 120) & (g < 80) & (b < 70)))
print('skin', sample((r > 235) & (g > 185) & (g < 215) & (b > 150) & (b < 190)))
