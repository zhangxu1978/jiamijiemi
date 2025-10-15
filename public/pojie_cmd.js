#!/usr/bin/env node
/**
 * rpgm_decrypt_node.js
 *
 * Usage:
 *   node rpgm_decrypt_node.js [targetDir]
 *
 * If no targetDir is provided, uses current working directory.
 *
 * Behavior:
 * - Searches recursively for files ending with '_' (e.g. Actor.png_, bgm.ogg_)
 * - Tries to read encryptionKey from nearest www/data/System.json (searching upward)
 * - If no key, attempts to detect key from PNG files (using PNG magic header)
 * - Decrypts by removing fake header (16 bytes by default) and XORing first headerLen bytes
 * - Writes output under ./decrypted_out preserving original structure and removing trailing '_'
 *
 * No external dependencies.
 */

const fs = require('fs').promises;
const path = require('path');

const DEFAULT_HEADER_LEN = 16;
const PNG_MAGIC = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52]);

async function findSystemKey(startDir) {
  // look up to root for 'www/data/System.json' or 'data/System.json'
  let dir = path.resolve(startDir);
  for (let i = 0; i < 8; i++) { // limit depth
    const cand1 = path.join(dir, 'www', 'data', 'System.json');
    const cand2 = path.join(dir, 'data', 'System.json');
    for (const cand of [cand1, cand2]) {
      try {
        const txt = await fs.readFile(cand, 'utf8');
        const j = JSON.parse(txt);
        if (j && j.encryptionKey) {
          console.log('[*] Found encryptionKey in', cand);
          return j.encryptionKey;
        }
      } catch (e) {
        // ignore
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function isHex(str) {
  return /^[0-9a-fA-F]+$/.test(str);
}

function normalizeKeyHex(keyStr) {
  // Accept 32-hex (16 bytes). If provided as 16-char ASCII, convert to hex.
  if (!keyStr) return null;
  if (isHex(keyStr) && keyStr.length === 32) return keyStr.toLowerCase();
  // if 16 chars ascii
  if (Buffer.from(keyStr, 'utf8').length === 16) return Buffer.from(keyStr, 'utf8').toString('hex');
  return null;
}

async function walkDirCollect(startDir) {
  const files = [];
  async function walk(d) {
    const items = await fs.readdir(d, { withFileTypes: true });
    for (const it of items) {
      const full = path.join(d, it.name);
      if (it.isDirectory()) await walk(full);
      else {
        if (it.name.endsWith('_')) files.push(full);
      }
    }
  }
  await walk(startDir);
  return files;
}

function deriveKeyFromPngHeader(fileBuf, headerLen = DEFAULT_HEADER_LEN) {
  // Expect at least headerLen * 2 bytes: fake header + encrypted original header
  if (fileBuf.length < headerLen * 2) return null;
  const fileHeader = fileBuf.slice(headerLen, headerLen * 2);
  const pngHeader = PNG_MAGIC.slice(0, headerLen);
  const keyBytes = Buffer.alloc(headerLen);
  for (let i = 0; i < headerLen; i++) {
    keyBytes[i] = pngHeader[i] ^ fileHeader[i];
  }
  return keyBytes.toString('hex');
}

function xorFirstBytes(buf, keyHex, headerLen = DEFAULT_HEADER_LEN) {
  const key = Buffer.from(keyHex, 'hex');
  const out = Buffer.from(buf); // copy
  for (let i = 0; i < headerLen && i < out.length && i < key.length; i++) {
    out[i] = out[i] ^ key[i];
  }
  return out;
}

function removeFakeHeaderAndFix(buf, headerLen = DEFAULT_HEADER_LEN) {
  if (buf.length <= headerLen) return Buffer.alloc(0);
  return buf.slice(headerLen);
}

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function processFile(filePath, keyHexGlobal, outRoot, baseDir, headerLen = DEFAULT_HEADER_LEN) {
  try {
    const raw = await fs.readFile(filePath);
    let keyHex = keyHexGlobal;

    // If no global key, try derive from PNG
    if (!keyHex) {
      const tryKey = deriveKeyFromPngHeader(raw, headerLen);
      if (tryKey && tryKey.length === headerLen * 2) {
        keyHex = tryKey;
        // console.log('  derived key from', filePath, keyHex);
      }
    }

    // If still no key -> attempt restore header only (put normal PNG header)
    let processed;
    if (!keyHex) {
      // fallback: attempt restore PNG header (useful to preview) — matches Decrypter.restorePngHeader
      // We'll try to detect if it's likely a PNG by searching for PNG magic inside, else just strip first headerLen*2 bytes and re-prepend PNG magic
      // We'll follow original Decrypter: slice(headerLen*2, end) then prepend PNG_MAGIC up to headerLen
      if (raw.length >= headerLen * 2) {
        const slice = raw.slice(headerLen * 2);
        const header = PNG_MAGIC.slice(0, headerLen);
        const merged = Buffer.concat([header, slice]);
        processed = merged;
        // But keep extension same (we'll write with name without _)
      } else {
        // can't do much
        throw new Error('no key and file too small to restore header');
      }
    } else {
      // Proper decrypt: remove fake header, XOR first headerLen bytes
      const removed = removeFakeHeaderAndFix(raw, headerLen);
      const xored = xorFirstBytes(removed, keyHex, headerLen);
      processed = xored;
    }

    // compute output path preserving structure under outRoot
    const rel = path.relative(baseDir, filePath);
    const relNoUnderscore = rel.replace(/_$/, '');
    const outPath = path.join(outRoot, relNoUnderscore);
    await ensureDir(outPath);
    await fs.writeFile(outPath, processed);
    return { ok: true, outPath, key: keyHex || null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

(async () => {
  try {
    const targetArg = process.argv[2] || '.';
    const targetDir = path.resolve(targetArg);
    const stat = await fs.stat(targetDir);
    if (!stat.isDirectory()) {
      console.error('目标不是目录：', targetDir);
      process.exit(1);
    }

    console.log('[*] Start dir:', targetDir);
    const keyFound = await findSystemKey(targetDir);
    const normKey = normalizeKeyHex(keyFound);

    if (keyFound && !normKey) {
      console.warn('[!] Found encryptionKey in System.json but it is not 32-hex or 16-char ASCII. Ignoring.');
    }

    const keyHexGlobal = normKey; // may be null

    if (keyHexGlobal) console.log('[*] Using global key:', keyHexGlobal);

    const files = await walkDirCollect(targetDir);
    if (files.length === 0) {
      console.log('未找到以 "_" 结尾的文件，退出。');
      process.exit(0);
    }
    console.log(`找到 ${files.length} 个候选文件，开始处理...`);

    const outRoot = path.join(targetDir, 'decrypted_out');
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      process.stdout.write(`[${i+1}/${files.length}] ${path.relative(targetDir, f)} -> `);
      const res = await processFile(f, keyHexGlobal, outRoot, targetDir);
      if (res.ok) {
        console.log(`写出 ${path.relative(targetDir, res.outPath)}${res.key ? ` (key=${res.key})` : ' (restored header)'}`);
      } else {
        console.log(`失败: ${res.error}`);
      }
    }

    console.log('处理完成，输出目录：', outRoot);
  } catch (err) {
    console.error('错误：', err.message || err);
    process.exit(1);
  }
})();
