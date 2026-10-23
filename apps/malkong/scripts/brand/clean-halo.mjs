// 버디 그림 테두리의 흰 점을 지운다(decisions/032) — 어두운 바탕에서 보이던 것.
// 바깥(투명)과 이어진 흰 픽셀만 지우므로 눈 하이라이트처럼 안쪽의 흰색은 그대로다.
//   node scripts/brand/clean-halo.mjs assets/images/mascot/face.png [다른 파일 …]
//   node scripts/brand/clean-halo.mjs --rgb icon.png   → 투명을 먹색으로 덮어 RGB(App Store 아이콘)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { PNG } = createRequire(import.meta.url)('pngjs');
const args = process.argv.slice(2);
const toRgb = args[0] === '--rgb';

for (const file of toRgb ? args.slice(1) : args) {
  const p = PNG.sync.read(readFileSync(file));
  const { width: W, height: H, data: d } = p;
  if (toRgb) {
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255;
      for (let c = 0; c < 3; c++) d[i + c] = Math.round(d[i + c] * a + 0x16 * (1 - a));
      d[i + 3] = 255;
    }
    writeFileSync(file, PNG.sync.write(p, { colorType: 2 }));
    console.log(`${file}: RGB`);
    continue;
  }
  const light = (i) => d[i + 3] > 0 && d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200;
  const seen = new Uint8Array(W * H);
  const queue = [];
  for (let k = 0; k < W * H; k++) if (d[k * 4 + 3] === 0) { seen[k] = 1; queue.push(k); }
  let removed = 0;
  while (queue.length) {
    const k = queue.pop();
    const x = k % W, y = (k - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (seen[n] || !light(n * 4)) continue;
      seen[n] = 1;
      d[n * 4 + 3] = 0;
      removed++;
      queue.push(n);
    }
  }
  writeFileSync(file, PNG.sync.write(p));
  console.log(`${file}: 흰 점 ${removed}개 지움`);
}
