const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.from(data);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(d.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, crc]);
}
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function makePNG(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / l2));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function draw(size, inner, th) {
  const bg = [15, 23, 42, 255];
  const accent = [45, 212, 191, 255];
  const white = [248, 250, 252, 255];
  const row = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    row[o++] = 0;
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const r = Math.hypot(u - 0.5, v - 0.5);
      let col = bg;
      if (r <= inner) col = accent;
      const d1 = segDist(u, v, 0.34, 0.53, 0.47, 0.66);
      const d2 = segDist(u, v, 0.47, 0.66, 0.68, 0.36);
      if (r <= inner && Math.min(d1, d2) <= th) col = white;
      const i = o;
      row[i] = col[0]; row[i + 1] = col[1]; row[i + 2] = col[2]; row[i + 3] = col[3];
      o += 4;
    }
  }
  return row;
}
function drawMaskable(size) {
  const bg = [15, 23, 42, 255];
  const accent = [45, 212, 191, 255];
  const white = [248, 250, 252, 255];
  const row = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    row[o++] = 0;
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const r = Math.hypot(u - 0.5, v - 0.5);
      let col = bg;
      if (r <= 0.3) col = accent;
      const d1 = segDist(u, v, 0.4, 0.53, 0.49, 0.62);
      const d2 = segDist(u, v, 0.49, 0.62, 0.63, 0.42);
      if (r <= 0.3 && Math.min(d1, d2) <= 0.028) col = white;
      const i = o;
      row[i] = col[0]; row[i + 1] = col[1]; row[i + 2] = col[2]; row[i + 3] = col[3];
      o += 4;
    }
  }
  return row;
}

fs.mkdirSync(path.join(__dirname, '..', 'icons'), { recursive: true });
const outDir = path.join(__dirname, '..', 'icons');
fs.writeFileSync(path.join(outDir, 'icon-192.png'), makePNG(192, draw(192, 0.42, 0.035)));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makePNG(512, draw(512, 0.42, 0.035)));
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), makePNG(512, drawMaskable(512)));
console.log('Icons generated in', outDir);