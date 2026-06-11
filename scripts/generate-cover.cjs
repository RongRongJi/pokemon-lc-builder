// 生成 Discord/Twitter 社交卡片 (1200x630)
// - 纯色深蓝背景
// - 居中放置 src/assets/logo.png
// - 英文文字
// 纯 Node.js，无外部依赖（手动 PNG 解码/编码）

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOGO_PATH = path.join(PROJECT_ROOT, 'src', 'assets', 'logo.png');
const OUT_PATH = path.join(PROJECT_ROOT, 'public', 'og-cover.png');
const FAVICON_OUT_PATH = path.join(PROJECT_ROOT, 'public', 'logo.png');
const PUBLIC_OG_COVER = OUT_PATH;

// ========== PNG 解码 ==========
function decodePNG(filePath) {
  const buf = fs.readFileSync(filePath);

  // 验证 PNG 签名
  const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < signature.length; i++) {
    if (buf[i] !== signature[i]) throw new Error('Not a valid PNG file');
  }

  // 解析 chunk
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  let idatChunks = [];
  const palette = []; // for colorType=3 (indexed)
  let trns = null;

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString('ascii');
    const data = buf.slice(offset + 8, offset + 8 + length);
    // const crc = buf.slice(offset + 8 + length, offset + 12 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'PLTE') {
      for (let i = 0; i < data.length; i += 3) {
        palette.push([data[i], data[i + 1], data[i + 2]]);
      }
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IEND') {
      break;
    }
  }

  const compressed = Buffer.concat(idatChunks);
  const raw = zlib.inflateSync(compressed);

  // 解析像素数据：每一行以 filter byte 开头
  // 根据 colorType 确定每像素字节数
  // colorType: 0=grayscale, 2=RGB, 3=indexed, 4=grayscale+alpha, 6=RGBA
  let bpp; // bytes per pixel
  if (colorType === 2) bpp = 3; // RGB
  else if (colorType === 6) bpp = 4; // RGBA
  else if (colorType === 0) bpp = 1; // grayscale
  else if (colorType === 4) bpp = 2; // grayscale + alpha
  else if (colorType === 3) bpp = 1; // indexed
  else throw new Error('Unsupported color type: ' + colorType);

  if (bitDepth !== 8) throw new Error('Unsupported bit depth: ' + bitDepth);

  const rowBytes = width * bpp;
  const stride = rowBytes + 1; // +1 for filter byte

  // 解 filter（支持 0=None, 1=Sub, 2=Up, 3=Average, 4=Paeth）
  const pixels = new Uint8ClampedArray(width * height * 4); // RGBA output
  const prevRow = new Uint8ClampedArray(rowBytes);

  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    const filter = raw[rowStart];
    const rowData = raw.slice(rowStart + 1, rowStart + stride);

    // 逆 filter
    const recon = new Uint8ClampedArray(rowBytes);
    for (let x = 0; x < rowBytes; x++) {
      const raw = rowData[x];
      const a = x >= bpp ? recon[x - bpp] : 0;
      const b = prevRow[x];
      const c = x >= bpp ? prevRow[x - bpp] : 0;

      let val;
      switch (filter) {
        case 0: val = raw; break;
        case 1: val = (raw + a) & 0xff; break;
        case 2: val = (raw + b) & 0xff; break;
        case 3: val = (raw + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          // Paeth predictor
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          let pr;
          if (pa <= pb && pa <= pc) pr = a;
          else if (pb <= pc) pr = b;
          else pr = c;
          val = (raw + pr) & 0xff;
          break;
        }
        default: val = raw;
      }
      recon[x] = val;
    }

    // 写入 pixels (RGBA)
    for (let x = 0; x < width; x++) {
      const srcIdx = x * bpp;
      const dstIdx = (y * width + x) * 4;

      if (colorType === 2) {
        pixels[dstIdx] = recon[srcIdx];
        pixels[dstIdx + 1] = recon[srcIdx + 1];
        pixels[dstIdx + 2] = recon[srcIdx + 2];
        pixels[dstIdx + 3] = 255;
      } else if (colorType === 6) {
        pixels[dstIdx] = recon[srcIdx];
        pixels[dstIdx + 1] = recon[srcIdx + 1];
        pixels[dstIdx + 2] = recon[srcIdx + 2];
        pixels[dstIdx + 3] = recon[srcIdx + 3];
      } else if (colorType === 0) {
        const g = recon[srcIdx];
        pixels[dstIdx] = g; pixels[dstIdx + 1] = g; pixels[dstIdx + 2] = g;
        pixels[dstIdx + 3] = 255;
      } else if (colorType === 4) {
        const g = recon[srcIdx];
        pixels[dstIdx] = g; pixels[dstIdx + 1] = g; pixels[dstIdx + 2] = g;
        pixels[dstIdx + 3] = recon[srcIdx + 1];
      } else if (colorType === 3) {
        const idx = recon[srcIdx];
        if (idx < palette.length) {
          pixels[dstIdx] = palette[idx][0];
          pixels[dstIdx + 1] = palette[idx][1];
          pixels[dstIdx + 2] = palette[idx][2];
        }
        // 透明度
        if (trns && idx < trns.length) {
          pixels[dstIdx + 3] = trns[idx];
        } else {
          pixels[dstIdx + 3] = 255;
        }
      }
    }

    // 保存当前行供下一行使用
    prevRow.set(recon);
  }

  return { width, height, pixels };
}

// ========== PNG 编码 ==========
function encodePNG(width, height, pixels) {
  // pixels: Uint8ClampedArray, RGBA, length = width*height*4
  // 每一行: filter byte (0) + RGB*width
  const rowSize = width * 3 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * rowSize + 1 + x * 3;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  // CRC32
  function crc32(data) {
    let crc = 0xffffffff;
    const table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crcVal = crc32(Buffer.concat([typeBytes, data]));
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crcVal);
    return Buffer.concat([len, typeBytes, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;         // bit depth
  ihdr[9] = 2;         // color type: RGB
  ihdr[10] = 0;        // compression
  ihdr[11] = 0;        // filter
  ihdr[12] = 0;        // interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ========== 双线性插值缩放 ==========
function resizeBilinear(src, srcW, srcH, dstW, dstH) {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = (srcW - 1) / dstW;
  const yRatio = (srcH - 1) / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const px = x * xRatio;
      const py = y * yRatio;
      const xFloor = Math.floor(px);
      const yFloor = Math.floor(py);
      const xFrac = px - xFloor;
      const yFrac = py - yFloor;

      const idx00 = (yFloor * srcW + xFloor) * 4;
      const idx10 = (yFloor * srcW + Math.min(xFloor + 1, srcW - 1)) * 4;
      const idx01 = (Math.min(yFloor + 1, srcH - 1) * srcW + xFloor) * 4;
      const idx11 = (Math.min(yFloor + 1, srcH - 1) * srcW + Math.min(xFloor + 1, srcW - 1)) * 4;

      const dstIdx = (y * dstW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const v00 = src[idx00 + c];
        const v10 = src[idx10 + c];
        const v01 = src[idx01 + c];
        const v11 = src[idx11 + c];
        const top = v00 * (1 - xFrac) + v10 * xFrac;
        const bot = v01 * (1 - xFrac) + v11 * xFrac;
        dst[dstIdx + c] = Math.round(top * (1 - yFrac) + bot * yFrac);
      }
    }
  }
  return dst;
}

// ========== alpha 合成 ==========
function blend(dstPixels, dstW, dstH, overlay, ovW, ovH, centerX, centerY) {
  const startX = Math.round(centerX - ovW / 2);
  const startY = Math.round(centerY - ovH / 2);

  for (let y = 0; y < ovH; y++) {
    const dstY = startY + y;
    if (dstY < 0 || dstY >= dstH) continue;
    for (let x = 0; x < ovW; x++) {
      const dstX = startX + x;
      if (dstX < 0 || dstX >= dstW) continue;

      const srcIdx = (y * ovW + x) * 4;
      const dstIdx = (dstY * dstW + dstX) * 4;

      const a = overlay[srcIdx + 3] / 255;
      if (a <= 0.01) continue; // 透明像素跳过

      if (a >= 0.99) {
        dstPixels[dstIdx] = overlay[srcIdx];
        dstPixels[dstIdx + 1] = overlay[srcIdx + 1];
        dstPixels[dstIdx + 2] = overlay[srcIdx + 2];
        dstPixels[dstIdx + 3] = 255;
      } else {
        dstPixels[dstIdx] = Math.round(dstPixels[dstIdx] * (1 - a) + overlay[srcIdx] * a);
        dstPixels[dstIdx + 1] = Math.round(dstPixels[dstIdx + 1] * (1 - a) + overlay[srcIdx + 1] * a);
        dstPixels[dstIdx + 2] = Math.round(dstPixels[dstIdx + 2] * (1 - a) + overlay[srcIdx + 2] * a);
        dstPixels[dstIdx + 3] = 255;
      }
    }
  }
}

// ========== 绘制纯色矩形 ==========
function fillRect(pixels, w, h, x, y, rw, rh, color) {
  for (let py = y; py < y + rh; py++) {
    if (py < 0 || py >= h) continue;
    for (let px = x; px < x + rw; px++) {
      if (px < 0 || px >= w) continue;
      const idx = (py * w + px) * 4;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = color[3] !== undefined ? color[3] : 255;
    }
  }
}

// ========== 5x7 像素字体（简单位图字体，英文标题用）==========
// 用于在卡片上绘制 "LC Builder" 等短文字
const FONT5x7 = {
  'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'N': ['10001', '10001', '11001', '10101', '10011', '10001', '10001'],
  'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  'W': ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  'Y': ['10001', '10001', '10001', '01010', '00100', '00100', '00100'],
  'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10001', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '10001', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00000', '00100'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  ':': ['00000', '00100', '00000', '00000', '00100', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
};

function drawText(pixels, w, h, text, x, y, scale, color) {
  const charW = 5 * scale;
  const charH = 7 * scale;
  const gap = scale; // 字符间距
  let cx = x;

  for (const ch of text.toUpperCase()) {
    const glyph = FONT5x7[ch] || FONT5x7[' '];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === '1') {
          // 绘制 scale×scale 像素块
          fillRect(pixels, w, h, cx + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cx += charW + gap;
  }
}

// ========== 主流程 ==========
console.log('Reading logo.png...');
const logo = decodePNG(LOGO_PATH);
console.log(`  Logo: ${logo.width} x ${logo.height} px`);

// 1) 复制 logo.png 到 public/ 作为 favicon
fs.copyFileSync(LOGO_PATH, FAVICON_OUT_PATH);
console.log('✓ Copied logo.png to public/logo.png');

// 2) 生成 og-cover.png (1200x630)
const CW = 1200;
const CH = 630;

// 初始化背景：纯色深蓝 (#1e3a8a)
const cover = new Uint8ClampedArray(CW * CH * 4);
const bgColor = [30, 58, 138, 255]; // deep blue
const accentColor = [99, 102, 241, 255]; // indigo-500

// 填充背景 + 稍微加一点渐变(上深下浅)
for (let y = 0; y < CH; y++) {
  const t = y / CH;
  const r = Math.round(30 + (45 - 30) * t);
  const g = Math.round(58 + (90 - 58) * t);
  const b = Math.round(138 + (180 - 138) * t);
  for (let x = 0; x < CW; x++) {
    const idx = (y * CW + x) * 4;
    cover[idx] = r;
    cover[idx + 1] = g;
    cover[idx + 2] = b;
    cover[idx + 3] = 255;
  }
}

// 绘制一些装饰性的浅色圆作为背景点缀（不影响主体）
// 左上：一个大的浅色圆环
function drawDiskOutline(pixels, w, h, cx, cy, r, color) {
  for (let y = cy - r; y < cy + r; y++) {
    for (let x = cx - r; x < cx + r; x++) {
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r * r) {
        const dist = Math.sqrt(d2);
        const edgeFade = Math.max(0, 1 - (r - dist) / 80); // 从边缘向内 80px 淡出
        if (edgeFade > 0) {
          const idx = (y * w + x) * 4;
          const a = edgeFade * 0.15;
          cover[idx] = Math.round(cover[idx] * (1 - a) + color[0] * a);
          cover[idx + 1] = Math.round(cover[idx + 1] * (1 - a) + color[1] * a);
          cover[idx + 2] = Math.round(cover[idx + 2] * (1 - a) + color[2] * a);
        }
      }
    }
  }
}

drawDiskOutline(cover, CW, CH, 150, 120, 180, accentColor);
drawDiskOutline(cover, CW, CH, 1050, 500, 220, accentColor);

// 居中放置 logo：缩放 logo 到合适大小（logo 短边占 40%）
// 选择 logo 大小：希望 logo 主体尺寸约为 320×320（不超过高度的一半）
const targetSize = 320;
let logoDisplayW, logoDisplayH;
if (logo.width >= logo.height) {
  logoDisplayH = targetSize;
  logoDisplayW = Math.round(logo.width * (targetSize / logo.height));
} else {
  logoDisplayW = targetSize;
  logoDisplayH = Math.round(logo.height * (targetSize / logo.width));
}

// 确保不超过画面
const maxW = CW * 0.5;
const maxH = CH * 0.55;
if (logoDisplayW > maxW) {
  const scale = maxW / logoDisplayW;
  logoDisplayW = Math.round(logoDisplayW * scale);
  logoDisplayH = Math.round(logoDisplayH * scale);
}
if (logoDisplayH > maxH) {
  const scale = maxH / logoDisplayH;
  logoDisplayW = Math.round(logoDisplayW * scale);
  logoDisplayH = Math.round(logoDisplayH * scale);
}

console.log(`  Resizing logo to ${logoDisplayW} x ${logoDisplayH}...`);
const resizedLogo = resizeBilinear(logo.pixels, logo.width, logo.height, logoDisplayW, logoDisplayH);

// 把 logo 放在画面上方偏中间的位置
const logoCenterX = CW / 2;
const logoCenterY = CH * 0.4;
blend(cover, CW, CH, resizedLogo, logoDisplayW, logoDisplayH, logoCenterX, logoCenterY);

// 绘制标题文字（在 logo 下方）
// 使用大像素字体（每个像素 12px，字符 5×7 = 60×84）
const bigScale = 12;
const titleY = Math.round(logoCenterY + logoDisplayH / 2 + 40);
const titleText = 'LC BUILDER';
drawText(cover, CW, CH, titleText, CW / 2 - (titleText.length * (5 + 1) * bigScale) / 2,
         titleY, bigScale, [255, 255, 255, 255]);

// 绘制副标题（较小）
const smallScale = 6;
const subY = titleY + 7 * bigScale + 30;
const subText = 'LITTLE CUP POKEMON TEAM BUILDER';
drawText(cover, CW, CH, subText, CW / 2 - (subText.length * (5 + 1) * smallScale) / 2,
         subY, smallScale, [180, 200, 240, 255]);

// 右下角小字
const tinyScale = 4;
const footerText = '215 POKEMON · 800+ SETS · EN/ZH';
drawText(cover, CW, CH, footerText, CW / 2 - (footerText.length * (5 + 1) * tinyScale) / 2,
         CH - 7 * tinyScale - 30, tinyScale, [140, 160, 200, 255]);

// 保存
console.log('Encoding cover PNG...');
const coverPNG = encodePNG(CW, CH, cover);
fs.writeFileSync(PUBLIC_OG_COVER, coverPNG);
console.log(`✓ Saved: public/og-cover.png (${(coverPNG.length / 1024).toFixed(1)} KB)`);
console.log('');
console.log('Done. Now commit and push to GitHub Pages.');
