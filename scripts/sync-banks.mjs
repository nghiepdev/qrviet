#!/usr/bin/env node
// Refresh the offline bank directory used by QRViet.
//
//   node scripts/sync-banks.mjs            # data + logos
//   node scripts/sync-banks.mjs --no-logos # data only
//
// Writes src/data/banks.json (trimmed fields) and public/banks/<code>.webp.
// Logos are downscaled to 240px wide with `cwebp` when it is installed
// (brew install webp); otherwise the original PNG is kept.
// The app never calls the API at runtime: everything ships in the bundle so
// it keeps working offline.

import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.vietqr.io/v2/banks';
const withLogos = !process.argv.includes('--no-logos');

function hasCwebp() {
  try {
    execFileSync('cwebp', ['-version'], {stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
}

function slug(code) {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

const res = await fetch(API);
if (!res.ok) throw new Error(`Bank API failed: ${res.status}`);
const body = await res.json();
if (!Array.isArray(body.data)) throw new Error('Unexpected bank API payload');

const cwebp = withLogos && hasCwebp();
const logoDir = join(ROOT, 'public', 'banks');
if (withLogos) mkdirSync(logoDir, {recursive: true});
const tmpDir = join(ROOT, 'node_modules', '.cache', 'bank-logos');
if (withLogos) mkdirSync(tmpDir, {recursive: true});

const banks = [];
for (const b of body.data) {
  const code = String(b.code).trim();
  const file = `${slug(code)}.${cwebp ? 'webp' : 'png'}`;
  if (withLogos && b.logo) {
    const png = join(tmpDir, `${slug(code)}.png`);
    const r = await fetch(b.logo);
    if (r.ok) {
      writeFileSync(png, Buffer.from(await r.arrayBuffer()));
      const out = join(logoDir, file);
      if (cwebp) {
        execFileSync('cwebp', ['-quiet', '-q', '86', '-alpha_q', '90', '-resize', '240', '0', png, '-o', out]);
      } else {
        writeFileSync(out, Buffer.from(await (await fetch(b.logo)).arrayBuffer()));
      }
    } else {
      console.warn(`! logo missing for ${code}`);
    }
  }
  banks.push({
    bin: String(b.bin),
    code,
    shortName: String(b.shortName ?? b.short_name ?? code).trim(),
    name: String(b.name).trim(),
    swift: b.swift_code ?? null,
    transfer: b.transferSupported === 1 || b.isTransfer === 1,
    lookup: b.lookupSupported === 1,
    logo: withLogos ? `banks/${file}` : null,
  });
}

writeFileSync(join(ROOT, 'src', 'data', 'banks.json'), JSON.stringify(banks, null, 2) + '\n');
if (existsSync(tmpDir)) rmSync(tmpDir, {recursive: true, force: true});
console.log(`Synced ${banks.length} banks${withLogos ? ` (+ logos as ${cwebp ? 'webp' : 'png'})` : ''}.`);
