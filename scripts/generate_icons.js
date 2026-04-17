/**
 * ClodCount — Icon Generator (Node.js, zero dependencies)
 * Generates icon16.png, icon48.png, icon128.png in ./icons/
 *
 * Run: node generate_icons.js
 */

'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ─── Color Palette ────────────────────────────────────────────────────────────
const BG_COLOR     = [0x1a, 0x19, 0x18]; // #1a1918 — claude.ai dark
const ACCENT_COLOR = [0xd9, 0x77, 0x57]; // #d97757 — claude.ai orange

// ─── CRC32 Implementation ─────────────────────────────────────────────────────
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── PNG Chunk Builder ────────────────────────────────────────────────────────
function makeChunk(type, data) {
  const lenBuf  = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf  = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// ─── PNG Builder ──────────────────────────────────────────────────────────────
function buildPNG(width, height, pixels) {
  // pixels: Float32Array or Uint8Array — RGBA, row-major
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8; // 8-bit depth
  ihdr[9]  = 6; // RGBA color type
  ihdr[10] = 0; // deflate compression
  ihdr[11] = 0; // adaptive filter
  ihdr[12] = 0; // no interlace

  // Raw (uncompressed) scanline data — filter byte 0 (None) prepended per row
  const raw = Buffer.allocUnsafe(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (width * 4 + 1) + 1 + x * 4;
      raw[di]     = pixels[si];
      raw[di + 1] = pixels[si + 1];
      raw[di + 2] = pixels[si + 2];
      raw[di + 3] = pixels[si + 3];
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Drawing Helpers ──────────────────────────────────────────────────────────

/** Set pixel RGBA */
function setPixel(pixels, width, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  const i = (Math.round(y) * width + Math.round(x)) * 4;
  pixels[i]     = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = a;
}

/** Blend accent over background with alpha */
function blendPixel(pixels, width, x, y, r, g, b, alpha) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= width || yi >= width) return;
  const i   = (yi * width + xi) * 4;
  const a   = alpha / 255;
  const ia  = 1 - a;
  pixels[i]     = Math.round(pixels[i]     * ia + r * a);
  pixels[i + 1] = Math.round(pixels[i + 1] * ia + g * a);
  pixels[i + 2] = Math.round(pixels[i + 2] * ia + b * a);
  pixels[i + 3] = 255;
}

/** Draw a filled circle with soft edge anti-aliasing */
function drawCircle(pixels, size, cx, cy, r, [R, G, B]) {
  const minX = Math.max(0, Math.floor(cx - r - 1));
  const maxX = Math.min(size - 1, Math.ceil(cx + r + 1));
  const minY = Math.max(0, Math.floor(cy - r - 1));
  const maxY = Math.min(size - 1, Math.ceil(cy + r + 1));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < r - 0.5) {
        setPixel(pixels, size, x, y, R, G, B);
      } else if (dist < r + 0.5) {
        const alpha = Math.round((r + 0.5 - dist) * 255);
        blendPixel(pixels, size, x, y, R, G, B, alpha);
      }
    }
  }
}

/** Draw a ring (filled donut) */
function drawRing(pixels, size, cx, cy, outerR, innerR, [R, G, B]) {
  const minX = Math.max(0, Math.floor(cx - outerR - 1));
  const maxX = Math.min(size - 1, Math.ceil(cx + outerR + 1));
  const minY = Math.max(0, Math.floor(cy - outerR - 1));
  const maxY = Math.min(size - 1, Math.ceil(cy + outerR + 1));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist  = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const angle = Math.atan2(y - cy, x - cx); // -π to π
      const deg   = ((angle * 180 / Math.PI) + 360) % 360;

      // Cut out right opening of "C" shape: ~315° – 45°
      const isGap = deg >= 315 || deg <= 45;
      if (isGap) continue;

      const inOuter = dist <= outerR + 0.5;
      const inInner = dist >= innerR - 0.5;

      if (!inOuter || !inInner) continue;

      // Outer edge fade
      let alpha = 255;
      if (dist > outerR - 0.5) alpha = Math.min(alpha, Math.round((outerR + 0.5 - dist) * 255));
      // Inner edge fade
      if (dist < innerR + 0.5) alpha = Math.min(alpha, Math.round((dist - innerR + 0.5) * 255));

      if (alpha <= 0) continue;
      blendPixel(pixels, size, x, y, R, G, B, alpha);
    }
  }
}

/** Draw rounded-rect background (fully opaque) */
function drawRoundedRect(pixels, size, bRadius, [R, G, B]) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Distance from nearest corner
      const dx = Math.max(0, bRadius - x, x - (size - 1 - bRadius));
      const dy = Math.max(0, bRadius - y, y - (size - 1 - bRadius));
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= bRadius + 0.5) {
        const alpha = dist < bRadius - 0.5 ? 255 : Math.round((bRadius + 0.5 - dist) * 255);
        blendPixel(pixels, size, x, y, R, G, B, alpha);
      }
    }
  }
}

// ─── Icon Renderer ────────────────────────────────────────────────────────────

function renderIcon(size) {
  const pixels = new Uint8Array(size * size * 4); // all transparent

  if (size <= 16) {
    // 16px: solid circle background + accent dot
    const c = size / 2;
    const r = size / 2 - 0.5;
    drawCircle(pixels, size, c, c, r, BG_COLOR);
    drawCircle(pixels, size, c, c, r * 0.42, ACCENT_COLOR);
    return pixels;
  }

  // 48px & 128px: rounded-rect bg + "C" ring + accent dot
  const br   = size * 0.22;
  const cx   = size / 2;
  const cy   = size / 2;

  // 1. Rounded rect background
  drawRoundedRect(pixels, size, br, BG_COLOR);

  // 2. "C" arc (ring with opening)
  const outerR = size * 0.36;
  const innerR = size * 0.22;
  drawRing(pixels, size, cx, cy, outerR, innerR, ACCENT_COLOR);

  // 3. Small accent center dot
  drawCircle(pixels, size, cx, cy, size * 0.05, ACCENT_COLOR);

  return pixels;
}

// ─── Generate Files ───────────────────────────────────────────────────────────

const sizes = [16, 48, 128];
const outDir = path.join(__dirname, 'icons');

for (const size of sizes) {
  const pixels = renderIcon(size);
  const png    = buildPNG(size, size, pixels);
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✓ Generated ${outPath}  (${png.length} bytes)`);
}

console.log('\n✅ All icons generated successfully!');
