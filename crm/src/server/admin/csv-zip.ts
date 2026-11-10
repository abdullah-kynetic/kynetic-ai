const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

/** Stored (uncompressed) zip. Enough for a handful of CSV files. */
export function zipStored(files: { name: string; body: string }[]): Uint8Array {
  const encoded = files.map((file) => ({
    name: new TextEncoder().encode(file.name),
    body: new TextEncoder().encode(file.body),
    crc: 0
  }));
  for (const file of encoded) file.crc = crc32(file.body);
  const localSize = encoded.reduce((n, file) => n + 30 + file.name.length + file.body.length, 0);
  const centralSize = encoded.reduce((n, file) => n + 46 + file.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let offset = 0;
  const locals: number[] = [];
  for (const file of encoded) {
    locals.push(offset);
    u32(view, offset, 0x04034b50);
    u16(view, offset + 4, 20);
    u16(view, offset + 8, 0);
    u32(view, offset + 14, file.crc);
    u32(view, offset + 18, file.body.length);
    u32(view, offset + 22, file.body.length);
    u16(view, offset + 26, file.name.length);
    out.set(file.name, offset + 30);
    out.set(file.body, offset + 30 + file.name.length);
    offset += 30 + file.name.length + file.body.length;
  }
  const centralStart = offset;
  encoded.forEach((file, index) => {
    u32(view, offset, 0x02014b50);
    u16(view, offset + 4, 20);
    u16(view, offset + 6, 20);
    u32(view, offset + 16, file.crc);
    u32(view, offset + 20, file.body.length);
    u32(view, offset + 24, file.body.length);
    u16(view, offset + 28, file.name.length);
    u32(view, offset + 42, locals[index] ?? 0);
    out.set(file.name, offset + 46);
    offset += 46 + file.name.length;
  });
  u32(view, offset, 0x06054b50);
  u16(view, offset + 8, encoded.length);
  u16(view, offset + 10, encoded.length);
  u32(view, offset + 12, centralSize);
  u32(view, offset + 16, centralStart);
  return out;
}
