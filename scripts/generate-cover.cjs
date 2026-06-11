// 生成 Discord/社交平台 1200x630 封面 PNG
// 使用纯 Node.js（无外部依赖）生成
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const W = 1200;
const H = 630;

// 颜色（RGBA，无透明通道时为 RGB，下面用的是 RGB 模式）
const C = {
  bgTop: [0x1e, 0x3a, 0x8a],       // 深蓝
  bgMid: [0x6b, 0x21, 0xd5],       // 紫
  bgBot: [0x0f, 0x17, 0x2a],       // 近黑
  bgGrad: [0xff, 0x00, 0x80],      // 洋红点缀
  ballRed: [0xee, 0x15, 0x15],
  ballWhite: [0xf5, 0xf5, 0xf5],
  ballBlack: [0x1e, 0x1e, 0x1e],
  ballBlue: [0x2c, 0x6b, 0xf5],
  accent1: [0xff, 0xd7, 0x00],     // 金黄
  accent2: [0x00, 0xc8, 0xff],     // 青
};

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// 获取背景颜色（纵向垂直渐变 + 轻微斜向叠加）
function bgPixel(x, y) {
  const t = y / H;
  let r, g, b;
  if (t < 0.5) {
    const c = lerpColor(C.bgTop, C.bgMid, t * 2);
    r = c[0]; g = c[1]; b = c[2];
  } else {
    const c = lerpColor(C.bgMid, C.bgBot, (t - 0.5) * 2);
    r = c[0]; g = c[1]; b = c[2];
  }
  // 斜向光晕（左上到右下的斜光线）
  const diag = (x / W + (1 - y / H));
  if (diag > 1.05) {
    const glow = Math.min(1, (diag - 1.05) * 2.5);
    r = lerp(r, 0xff, glow * 0.15);
    g = lerp(g, 0x88, glow * 0.1);
    b = lerp(b, 0xdd, glow * 0.15);
  }
  return [r, g, b];
}

function drawCircle(data, cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = Math.max(0, cy - radius); y < Math.min(H, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x < Math.min(W, cx + radius); x++) {
      const dx = x - cx, dy = y - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 <= r2) {
        const idx = (y * W + x) * 3;
        // 边缘抗锯齿（半径接近 r2 时做渐隐）
        const edgeRatio = (r2 - d2) / r2;
        if (edgeRatio > 0.95) {
          data[idx] = color[0];
          data[idx+1] = color[1];
          data[idx+2] = color[2];
        } else {
          const t = edgeRatio / 0.95;
          data[idx] = lerp(data[idx], color[0], t);
          data[idx+1] = lerp(data[idx+1], color[1], t);
          data[idx+2] = lerp(data[idx+2], color[2], t);
        }
      }
    }
  }
}

function drawRing(data, cx, cy, outerR, innerR, color) {
  const or2 = outerR * outerR;
  const ir2 = innerR * innerR;
  for (let y = Math.max(0, cy - outerR); y < Math.min(H, cy + outerR); y++) {
    for (let x = Math.max(0, cx - outerR); x < Math.min(W, cx + outerR); x++) {
      const dx = x - cx, dy = y - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 <= or2 && d2 >= ir2) {
        const idx = (y * W + x) * 3;
        data[idx] = color[0];
        data[idx+1] = color[1];
        data[idx+2] = color[2];
      }
    }
  }
}

// 简化的精灵球
function drawPokeball(data, cx, cy, r) {
  // 红色上半圆
  for (let y = cy - r; y < cy; y++) {
    const halfW = Math.floor(Math.sqrt(r*r - (y-cy)*(y-cy)));
    for (let x = cx - halfW; x < cx + halfW; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const idx = (y * W + x) * 3;
      data[idx] = C.ballRed[0]; data[idx+1] = C.ballRed[1]; data[idx+2] = C.ballRed[2];
    }
  }
  // 白色下半圆
  for (let y = cy; y < cy + r; y++) {
    const halfW = Math.floor(Math.sqrt(r*r - (y-cy)*(y-cy)));
    for (let x = cx - halfW; x < cx + halfW; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const idx = (y * W + x) * 3;
      data[idx] = C.ballWhite[0]; data[idx+1] = C.ballWhite[1]; data[idx+2] = C.ballWhite[2];
    }
  }
  // 黑色中缝
  for (let y = cy - 6; y < cy + 6; y++) {
    const halfW = Math.floor(Math.sqrt(r*r - (y-cy)*(y-cy)));
    for (let x = cx - halfW; x < cx + halfW; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const idx = (y * W + x) * 3;
      data[idx] = C.ballBlack[0]; data[idx+1] = C.ballBlack[1]; data[idx+2] = C.ballBlack[2];
    }
  }
  // 中心圆按钮
  drawRing(data, cx, cy, 35, 28, C.ballBlack);
  drawCircle(data, cx, cy, 28, C.ballWhite);
  drawRing(data, cx, cy, 20, 17, C.ballBlack);
}

// 星形装饰
function drawStar(data, cx, cy, outerR, innerR, color, points = 5, rotation = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = rotation + (i * Math.PI / points);
    pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  // 用扫描线简化：将星形分解为若干三角区域 + 内/外判定
  const minX = Math.max(0, Math.floor(cx - outerR));
  const maxX = Math.min(W - 1, Math.ceil(cx + outerR));
  const minY = Math.max(0, Math.floor(cy - outerR));
  const maxY = Math.min(H - 1, Math.ceil(cy + outerR));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // 点到中心的距离 & 角度
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      let ang = Math.atan2(dy, dx);
      // 归一化到 [0, 2π)
      while (ang < 0) ang += 2 * Math.PI;
      while (ang >= 2 * Math.PI) ang -= 2 * Math.PI;
      // 当前所在的 "段"
      const seg = (ang - rotation) / (Math.PI / points);
      // 段内线性插值得到该方向上"星"的半径
      const s = (seg % 1);
      const segIdx = Math.floor(seg) % (points * 2);
      // 线性插值 outerR <-> innerR
      let r;
      if (segIdx % 2 === 0) r = lerp(outerR, innerR, s);
      else r = lerp(innerR, outerR, s);
      if (dist <= r) {
        const idx = (y * W + x) * 3;
        data[idx] = color[0]; data[idx+1] = color[1]; data[idx+2] = color[2];
      }
    }
  }
}

// -------- 主渲染 --------
console.log(`Generating ${W}x${H} cover PNG...`);

// RGB 像素数据
const pixels = new Uint8Array(W * H * 3);

// 1. 背景
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const [r, g, b] = bgPixel(x, y);
    const idx = (y * W + x) * 3;
    pixels[idx] = r;
    pixels[idx+1] = g;
    pixels[idx+2] = b;
  }
}

// 2. 背景装饰：几颗淡淡的星
const starPos = [
  [150, 120, 40, 18], [1050, 180, 35, 15], [200, 480, 30, 12],
  [950, 520, 45, 20], [600, 90, 25, 10], [1100, 420, 28, 12],
  [90, 330, 22, 10],
];
for (const [x, y, or, ir] of starPos) {
  drawStar(pixels, x, y, or, ir, [0xff, 0xd7, 0x00], 5);
}

// 3. 背景装饰：小圆点（精灵球）
drawCircle(pixels, 950, 450, 60, C.ballBlue);
drawRing(pixels, 950, 450, 60, 58, [0x1a, 0x3a, 0x8a]);

drawCircle(pixels, 230, 510, 45, [0xff, 0x6b, 0x9d]);

// 4. 大精灵球（右下）
drawPokeball(pixels, 950, 320, 180);

// 5. 小一点的精灵球（左下）
drawPokeball(pixels, 260, 250, 110);

// 6. 装饰线条（斜向）
for (let i = 0; i < 5; i++) {
  const lineY = 100 + i * 110;
  drawCircle(pixels, 530, lineY, 3, C.accent1);
  drawCircle(pixels, 670, lineY, 3, C.accent1);
}

// ---------- 写入 PNG ----------
// PNG 结构：签名 + IHDR + IDAT + IEND
// 每一行前面多一个 filter byte (0 = no filter)
function crc32(data) {
  let crc = 0xffffffff;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcData = Buffer.concat([typeBytes, data]);
  const crcVal = crc32(crcData);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crcVal);
  return Buffer.concat([len, typeBytes, data, crc]);
}

// 生成带 filter byte 的 raw image data
const rowSize = W * 3 + 1;
const raw = Buffer.alloc(rowSize * H);
// 手动拷贝 Uint8Array → Buffer
for (let y = 0; y < H; y++) {
  raw[y * rowSize] = 0; // filter: None
  const dstOffset = y * rowSize + 1;
  const srcStart = y * W * 3;
  for (let i = 0; i < W * 3; i++) {
    raw[dstOffset + i] = pixels[srcStart + i];
  }
}

const compressed = zlib.deflateSync(raw, { level: 9 });

// PNG signature
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;        // bit depth
ihdr[9] = 2;        // color type: 2 = RGB
ihdr[10] = 0;       // compression: deflate
ihdr[11] = 0;       // filter: adaptive
ihdr[12] = 0;       // interlace: none

// IEND
const iend = Buffer.alloc(0);

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', compressed),
  chunk('IEND', iend),
]);

const outPath = path.join(__dirname, '..', 'public', 'og-cover.png');
fs.writeFileSync(outPath, png);
console.log(`✓ Saved: ${outPath} (${(png.length / 1024).toFixed(1)} KB)`);
