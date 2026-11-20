import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { open, mkdir, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';

export const sqliteHeader = Buffer.from('PROJECTOS-BACKUP-v1\n');
export const postgresHeader = Buffer.from('PROJECTOS-POSTGRES-v1\n');
const saltBytes = 24, nonceBytes = 12, tagBytes = 16;

function key(passphrase, salt) {
  if (typeof passphrase !== 'string' || passphrase.length < 20) throw new Error('Backup passphrase is missing or too short');
  return scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
}

async function writeAll(handle, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const written = await handle.write(buffer, offset, buffer.length - offset, null);
    if (!written.bytesWritten) throw new Error('Could not write encrypted backup');
    offset += written.bytesWritten;
  }
}

export async function encryptArchive(input, destination, passphrase, header) {
  const salt = randomBytes(saltBytes), nonce = randomBytes(nonceBytes);
  const cipher = createCipheriv('aes-256-gcm', key(passphrase, salt), nonce);
  cipher.setAAD(header);
  const prefix = Buffer.concat([header, salt, nonce, Buffer.alloc(tagBytes)]);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  const handle = await open(destination, 'wx', 0o600);
  try {
    await writeAll(handle, prefix);
    let payloadBytes=0;
    for await (const chunk of input) {
      const encrypted=cipher.update(chunk);
      await writeAll(handle, encrypted);
      payloadBytes+=encrypted.length;
    }
    const final=cipher.final();
    await writeAll(handle, final);
    const tag = cipher.getAuthTag();
    const written = await handle.write(tag, 0, tag.length, prefix.length - tag.length);
    if (written.bytesWritten !== tag.length) throw new Error('Failed to finalize encrypted backup');
    await handle.sync();
    return payloadBytes+final.length;
  } catch (error) {
    await handle.close().catch(() => {});
    await unlink(destination).catch(() => {});
    throw error;
  } finally {
    await handle.close().catch(() => {});
  }
}

export async function decryptArchive(source, destination, passphrase, header) {
  const offset = header.length + saltBytes + nonceBytes + tagBytes;
  const prefix = Buffer.alloc(offset);
  const handle = await open(source, 'r');
  try {
    const result = await handle.read(prefix, 0, prefix.length, 0);
    if (result.bytesRead !== offset || !prefix.subarray(0, header.length).equals(header)) {
      throw new Error('Unknown archive format');
    }
    const saltEnd = header.length + saltBytes, nonceEnd = saltEnd + nonceBytes;
    const decipher = createDecipheriv('aes-256-gcm', key(passphrase, prefix.subarray(header.length, saltEnd)),
      prefix.subarray(saltEnd, nonceEnd));
    decipher.setAAD(header);
    decipher.setAuthTag(prefix.subarray(nonceEnd));
    // Use a private temporary output. Callers open the result only after GCM verifies.
    await pipeline(handle.createReadStream({ autoClose: false, start: offset }), decipher,
      createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
  } finally {
    await handle.close();
  }
}
