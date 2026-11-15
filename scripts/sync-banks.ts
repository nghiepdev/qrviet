/**
 * Refresh the offline bank directory used by QRViet.
 *
 *   pnpm sync:banks                 # data + logos
 *   pnpm sync:banks -- --no-logos   # data only
 *
 * Writes src/data/banks.json (trimmed fields) and public/banks/<code>.webp.
 * Logos are downscaled to 240px wide with `cwebp` when it is installed
 * (brew install webp); otherwise the original PNG is kept.
 * The app never calls the API at runtime: everything ships in the bundle so it
 * keeps working offline.
 */
import {execFileSync} from 'node:child_process'
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'

/** One entry of https://api.vietqr.io/v2/banks (only the fields we read). */
interface ApiBank {
  bin: string | number
  code: string
  shortName?: string
  short_name?: string
  name: string
  logo?: string
  swift_code?: string | null
  transferSupported?: number
  isTransfer?: number
  lookupSupported?: number
}

/** Shape of src/data/banks.json (mirrors `Bank` in src/data/banks.ts). */
interface BankRecord {
  bin: string
  code: string
  shortName: string
  name: string
  swift: string | null
  transfer: boolean
  lookup: boolean
  logo: string | null
  icon?: string | null
}

const ROOT = resolve(import.meta.dirname, '..')
const API = 'https://api.vietqr.io/v2/banks'
const withLogos = !process.argv.includes('--no-logos')
const outJson = join(ROOT, 'src', 'data', 'banks.json')

const existingIcons = new Map<string, string>()
if (existsSync(outJson)) {
  try {
    const prev = JSON.parse(readFileSync(outJson, 'utf8')) as BankRecord[]
    for (const entry of prev) {
      if (entry.icon) existingIcons.set(entry.bin, entry.icon)
    }
  } catch {
    // ignore malformed prior JSON
  }
}

function hasCwebp(): boolean {
  try {
    execFileSync('cwebp', ['-version'], {stdio: 'ignore'})
    return true
  } catch {
    return false
  }
}

function slug(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

const res = await fetch(API)
if (!res.ok) throw new Error(`Bank API failed: ${res.status}`)
const body = (await res.json()) as {data?: unknown}
if (!Array.isArray(body.data)) throw new Error('Unexpected bank API payload')

const cwebp = withLogos && hasCwebp()
const logoDir = join(ROOT, 'public', 'banks')
const tmpDir = join(ROOT, 'node_modules', '.cache', 'bank-logos')
if (withLogos) {
  mkdirSync(logoDir, {recursive: true})
  mkdirSync(tmpDir, {recursive: true})
}

const banks: BankRecord[] = []
for (const b of body.data as ApiBank[]) {
  const code = String(b.code).trim()
  const file = `${slug(code)}.${cwebp ? 'webp' : 'png'}`
  if (withLogos && b.logo) {
    const r = await fetch(b.logo)
    if (r.ok) {
      const bytes = Buffer.from(await r.arrayBuffer())
      const out = join(logoDir, file)
      if (cwebp) {
        const png = join(tmpDir, `${slug(code)}.png`)
        writeFileSync(png, bytes)
        execFileSync('cwebp', ['-quiet', '-q', '86', '-alpha_q', '90', '-resize', '240', '0', png, '-o', out])
      } else {
        writeFileSync(out, bytes)
      }
    } else {
      console.warn(`! logo missing for ${code}`)
    }
  }
  const bin = String(b.bin)
  const icon = existingIcons.get(bin)
  banks.push({
    bin,
    code,
    shortName: String(b.shortName ?? b.short_name ?? code).trim(),
    name: String(b.name).trim(),
    swift: b.swift_code ?? null,
    transfer: b.transferSupported === 1 || b.isTransfer === 1,
    lookup: b.lookupSupported === 1,
    logo: withLogos ? `banks/${file}` : null,
    ...(icon ? {icon} : {}),
  })
}

writeFileSync(outJson, `${JSON.stringify(banks, null, 2)}\n`)
if (existsSync(tmpDir)) rmSync(tmpDir, {recursive: true, force: true})
console.log(`Synced ${banks.length} banks${withLogos ? ` (+ logos as ${cwebp ? 'webp' : 'png'})` : ''}.`)
