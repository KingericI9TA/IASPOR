/** ZIP STORE (sin comprimir) para copias de taller. */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}
function u32(n: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function concat(parts: Uint8Array[]) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export async function zipStore(files: { name: string; data: Uint8Array }[]) {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = new TextEncoder().encode(f.name.replace(/\\/g, "/"));
    const crc = crc32(f.data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(f.data.length),
      u32(f.data.length),
      u16(name.length),
      u16(0),
      name,
      f.data,
    ]);
    locals.push(local);
    centrals.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(f.data.length),
        u32(f.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  }
  const central = concat(centrals);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);
  return new Blob([concat([...locals, central, end]) as BlobPart], { type: "application/zip" });
}

export function unzipStore(buf: ArrayBuffer) {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const files: { name: string; data: Uint8Array }[] = [];
  let i = 0;
  while (i + 30 <= bytes.length) {
    const sig = view.getUint32(i, true);
    if (sig === 0x02014b50 || sig === 0x06054b50) break;
    if (sig !== 0x04034b50) break;
    const nameLen = view.getUint16(i + 26, true);
    const extra = view.getUint16(i + 28, true);
    const size = view.getUint32(i + 18, true);
    const method = view.getUint16(i + 8, true);
    const name = new TextDecoder().decode(bytes.slice(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extra;
    if (method !== 0) {
      i = start + size;
      continue;
    }
    files.push({ name, data: bytes.slice(start, start + size) });
    i = start + size;
  }
  return files;
}
