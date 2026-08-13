const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

const crc32 = buffer => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = date => {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | Math.max(0, Math.min(29, Math.floor(date.getSeconds() / 2)));
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, day };
};

const listFiles = directory => {
  const files = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  walk(directory);
  return files;
};

function createZipBuffer(sourceDirectory) {
  const files = listFiles(sourceDirectory);
  const parts = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const data = fs.readFileSync(file);
    const stat = fs.statSync(file);
    const compressed = zlib.deflateRawSync(data);
    const name = path.relative(sourceDirectory, file).split(path.sep).join('/');
    const nameBuf = Buffer.from(name, 'utf8');
    const { time, day } = dosDateTime(stat.mtime);
    const crc = crc32(data);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(day, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28);

    parts.push(header, nameBuf, compressed);
    central.push({ nameBuf, crc, compressed: compressed.length, size: data.length, offset, time, day });
    offset += header.length + nameBuf.length + compressed.length;
  }

  const centralOffset = offset;
  for (const entry of central) {
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x0800, 8);
    record.writeUInt16LE(8, 10);
    record.writeUInt16LE(entry.time, 12);
    record.writeUInt16LE(entry.day, 14);
    record.writeUInt32LE(entry.crc, 16);
    record.writeUInt32LE(entry.compressed, 20);
    record.writeUInt32LE(entry.size, 24);
    record.writeUInt16LE(entry.nameBuf.length, 28);
    record.writeUInt16LE(0, 30);
    record.writeUInt16LE(0, 32);
    record.writeUInt16LE(0, 34);
    record.writeUInt16LE(0, 36);
    record.writeUInt32LE(0, 38);
    record.writeUInt32LE(entry.offset, 42);
    parts.push(record, entry.nameBuf);
    offset += record.length + entry.nameBuf.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(offset - centralOffset, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);
  parts.push(eocd);

  return Buffer.concat(parts);
}

function extractZipToDirectory(zipBuffer, targetDirectory) {
  const buffer = Buffer.isBuffer(zipBuffer) ? zipBuffer : Buffer.from(zipBuffer);
  const fileCount = (name) => path.join(targetDirectory, ...name.split('/'));
  const entries = parseZipEntries(buffer);
  fs.mkdirSync(targetDirectory, { recursive: true });
  for (const entry of entries) {
    const name = entry.name.replace(/\\/g, '/');
    if (!name || name.endsWith('/')) continue;
    const resolved = path.resolve(targetDirectory, name);
    if (resolved !== targetDirectory && !resolved.startsWith(path.resolve(targetDirectory) + path.sep)) throw new Error('Unsafe path in archive');
    const output = fileCount(name);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, entry.data);
  }
}

function parseZipEntries(buffer) {
  const endRecord = findEndOfCentralDirectory(buffer);
  if (!endRecord) throw new Error('Not a valid ZIP archive');
  const entryCount = endRecord.buffer.readUInt16LE(endRecord.offset + 10);
  let cursor = endRecord.buffer.readUInt32LE(endRecord.offset + 16);
  const entries = [];
  for (let index = 0; index < entryCount; index++) {
    if (endRecord.buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP central directory');
    const method = endRecord.buffer.readUInt16LE(cursor + 10);
    const compressedSize = endRecord.buffer.readUInt32LE(cursor + 20);
    const nameLength = endRecord.buffer.readUInt16LE(cursor + 28);
    const extraLength = endRecord.buffer.readUInt16LE(cursor + 30);
    const commentLength = endRecord.buffer.readUInt16LE(cursor + 32);
    const localOffset = endRecord.buffer.readUInt32LE(cursor + 42);
    const name = endRecord.buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (method !== 0 && method !== 8) throw new Error(`Unsupported compression method in archive: ${method}`);
    const local = endRecord.buffer.readUInt32LE(localOffset) === 0x04034b50;
    const localNameLength = local ? endRecord.buffer.readUInt16LE(localOffset + 26) : nameLength;
    const localExtraLength = local ? endRecord.buffer.readUInt16LE(localOffset + 28) : extraLength;
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = endRecord.buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 8 ? zlib.inflateRawSync(compressed) : compressed;
    entries.push({ name, data });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function findEndOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - 65557);
  for (let cursor = buffer.length - 22; cursor >= minimum; cursor--) {
    if (buffer.readUInt32LE(cursor) === 0x06054b50) return { buffer, offset: cursor };
  }
  return null;
}

module.exports = { createZipBuffer, extractZipToDirectory };
