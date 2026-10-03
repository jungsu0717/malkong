"""잘라 낸 캐릭터로 앱 그림을 만든다 — 아이콘 · 안드로이드 셋 · 알림 · 시작 화면 · 웹 · 로딩 부품."""
from PIL import Image, ImageFilter
import numpy as np, os
OUT = 'assets'; os.makedirs(OUT, exist_ok=True)
face = Image.open('cut/mascot-face.png')
stand = Image.open('cut/mascot-standing.png')
swirl = Image.open('cut/run-swirl.png')

# 브랜드 노랑 — @ 다리(우주복 색)에서 뽑는다
a = np.array(swirl).astype(int); m = (a[:, :, 3] > 200) & (a[:, :, 0] > 220) & (a[:, :, 2] < 190)
yellow = tuple(int(v) for v in np.median(a[m][:, :3], axis=0))
print('yellow', '#%02X%02X%02X' % yellow)

def fit(img, w):
    r = w / img.width
    return img.resize((round(img.width * r), round(img.height * r)), Image.LANCZOS)

def on_canvas(img, size, width, bg=None, dy=0):
    c = Image.new('RGBA', (size, size), bg + (255,) if bg else (0, 0, 0, 0))
    f = fit(img, width)
    c.alpha_composite(f, ((size - f.width) // 2, (size - f.height) // 2 + dy))
    return c

# iOS · 기본 아이콘 — 불투명, 노랑 바탕에 얼굴
icon = on_canvas(face, 1024, 800, yellow, dy=30).convert('RGB')
icon.save(f'{OUT}/icon.png')
icon.resize((48, 48), Image.LANCZOS).save(f'{OUT}/favicon.png')
# 안드로이드 adaptive — 전경은 가운데 안전 영역(지름 66%) 안에
on_canvas(face, 1024, 600, None, dy=16).save(f'{OUT}/android-icon-foreground.png')
Image.new('RGB', (1024, 1024), yellow).save(f'{OUT}/android-icon-background.png')

# 단색(테마 아이콘) · 알림 아이콘 — 머리 실루엣에 눈과 쪽쪽이를 구멍으로
def components(mask):
    from collections import deque
    h, w = mask.shape; seen = np.zeros_like(mask); out = []
    for sy, sx in zip(*np.where(mask)):
        if seen[sy, sx]: continue
        q = deque([(sy, sx)]); seen[sy, sx] = True; pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((ny, nx))
        ys, xs = zip(*pts); out.append((len(pts), min(xs), min(ys), max(xs), max(ys)))
    return sorted(out, reverse=True)

def silhouette(img, size, width):
    """머리 실루엣 + 눈 두 개와 쪽쪽이를 깔끔한 타원 구멍으로 — 작게 줄여도 아기 얼굴로 읽히게"""
    from PIL import ImageDraw
    f = fit(img, width)
    arr = np.array(f).astype(int)
    alpha = arr[:, :, 3] > 128
    inner = np.array(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(max(3, width // 30 * 2 + 1)))) > 128
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    dark = inner & ((r + g + b) / 3 < 110)
    coral = inner & (r > 200) & (g < 140) & (b < 120)
    m = Image.fromarray(np.where(alpha, 255, 0).astype(np.uint8))
    d = ImageDraw.Draw(m)
    # 눈 — 머리 위쪽 절반에 있는 어두운 덩어리 가운데 큰 둘(가는 눈썹 · 머리카락 선은 작아서 빠진다)
    eyes = [c for c in components(dark) if c[2] > f.height * 0.3][:2]
    for _, x0, y0, x1, y1 in eyes:
        d.ellipse((x0, y0, x1, y1), fill=0)
    # 쪽쪽이 — 코랄 덩어리를 모두 감싸는 타원
    cs = components(coral)
    if cs:
        x0 = min(c[1] for c in cs[:3]); y0 = min(c[2] for c in cs[:3]); x1 = max(c[3] for c in cs[:3]); y1 = max(c[4] for c in cs[:3])
        d.ellipse((x0, y0, x1, y1), fill=0)
    out = np.zeros((f.height, f.width, 4), np.uint8); out[:, :, :3] = 255; out[:, :, 3] = np.array(m)
    s = Image.fromarray(out, 'RGBA')
    c = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    c.alpha_composite(s, ((size - s.width) // 2, (size - s.height) // 2))
    return c
silhouette(face, 1024, 600).save(f'{OUT}/android-icon-monochrome.png')
big = silhouette(face, 1024, 860)
small = big.resize((96, 96), Image.LANCZOS)
sa = np.array(small); sa[:, :, 3] = np.where(sa[:, :, 3] > 110, 255, 0); sa[:, :, :3] = 255
Image.fromarray(sa, 'RGBA').save(f'{OUT}/notification-icon.png')

# 시작 화면 — 서 있는 아기, 여백 없이(크기는 app.json imageWidth 가 정한다)
fit(stand, 600).save(f'{OUT}/splash-icon.png')

# 앱 안 그림
mascot = 'assets/mascot'; os.makedirs(mascot, exist_ok=True)
fit(face, 384).save(f'{mascot}/face.png')
fit(stand, 360).save(f'{mascot}/standing.png')
fit(Image.open('cut/run-body.png'), 300).save(f'{mascot}/run-body.png')
fit(swirl, 200).save(f'{mascot}/run-swirl.png')
fit(Image.open('cut/run-waves.png'), 240).save(f'{mascot}/run-waves.png')
for root, _, files in os.walk(OUT):
    for fn in sorted(files):
        p = os.path.join(root, fn); print(p, Image.open(p).size, os.path.getsize(p) // 1024, 'KB')
