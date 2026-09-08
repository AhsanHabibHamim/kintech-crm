// Generates simple solid-color PNG icons for PWA usage (no external deps).
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makeIcon(size, [r, g, b]) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const o = y * (size * 4 + 1) + 1 + x * 4;
      // Simple "K" motif: vertical bar + diagonal from center-top-right
      let dr = 0.0, dg = 0.0, db = 0.0;
      const col = x < size * 0.22 ? 0 : 1;
      const diag = Math.abs((x - size * 0.55) - (y - size * 0.28) * 0.7) < size * 0.06 && x > size * 0.24 ? 1 : 0;
      const accent = (col || diag) ? 0 : 1;
      if (accent) { dr = 99; dg = 102; db = 241; } else { dr = r; dg = g; db = b; } // slate accent vs indigo
      raw[o] = dr; raw[o + 1] = dg; raw[o + 2] = db; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.writeFileSync(path.join(outDir, 'icon-192.png'), makeIcon(192, [37, 99, 235]));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makeIcon(512, [37, 99, 235]));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), makeIcon(180, [15, 23, 42]));
console.log('icons written to', outDir);