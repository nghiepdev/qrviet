/**
 * Refresh the offline bank directory and deeplink registry used by QRViet.
 *
 *   pnpm sync:banks                    # banks + logos + deeplink crawler
 *   pnpm sync:banks -- --no-logos      # banks + deeplinks (skip logo downloads)
 *   pnpm sync:banks -- --deeplinks-only
 *   pnpm sync:banks -- --no-deeplinks
 *
 * Writes:
 * - src/data/banks.json (trimmed fields) and public/banks/<code>.webp
 * - src/data/bank-apps.json (offline banking/wallet deeplink specs)
 *
 * Logos are downscaled to 240px wide with `cwebp` when it is installed
 * (brew install webp); otherwise the original PNG is kept.
 * The app never calls any API at runtime: everything ships in the bundle so it
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

/** Shape of https://api.vietqr.io/v2/{ios,android}-app-deeplinks entries. */
interface VietQrDeeplinkApp {
  appId: string
  appName: string
  bankName: string
  deeplink: string
  autofill: number
}

/** Shape of vietqr-core gateway `/v1/apps` entries. */
interface VietQrCoreApp {
  appCode: string
  bin: string | null
  shortName: string
  appName: string
  supportsAutofill: boolean
}

type HandoffFormat =
  | {kind: 'qrPay'; path: string; param?: string}
  | {kind: 'momoQr'}
  | {kind: 'zalopayQr'}
  | {kind: 'namABank'}

interface BankAppRecord {
  code: string
  ios: {
    scheme: string
    appStoreId: string
    handoff: HandoffFormat | null
  }
  android: {
    package: string
  }
  tier: 'autofill' | 'qrpay' | 'launch'
}

const ROOT = resolve(import.meta.dirname, '..')
const BANKS_API = 'https://api.vietqr.io/v2/banks'
const IOS_DEEPLINKS_API = 'https://api.vietqr.io/v2/ios-app-deeplinks'
const ANDROID_DEEPLINKS_API = 'https://api.vietqr.io/v2/android-app-deeplinks'
const DL_VIETQR_BASE = 'https://dl.vietqr.io/pay'
const VIETQR_CORE_DISCOVERY_URL = 'https://raw.githubusercontent.com/Ngochiendev/vietqr-core/main/vietqr-discovery.json'

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'

const args = new Set(process.argv.slice(2))
const deeplinksOnly = args.has('--deeplinks-only')
const withLogos = !args.has('--no-logos')
const withDeeplinks = !args.has('--no-deeplinks')

const outBanksJson = join(ROOT, 'src', 'data', 'banks.json')
const outBankAppsJson = join(ROOT, 'src', 'data', 'bank-apps.json')

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

async function fetchJson<T>(url: string, timeoutMs = 12_000): Promise<T | null> {
  try {
    const res = await fetch(url, {signal: AbortSignal.timeout(timeoutMs)})
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function syncBanksDirectory(): Promise<BankRecord[]> {
  const existingIcons = new Map<string, string>()
  if (existsSync(outBanksJson)) {
    try {
      const prev = JSON.parse(readFileSync(outBanksJson, 'utf8')) as BankRecord[]
      for (const entry of prev) {
        if (entry.icon) existingIcons.set(entry.bin, entry.icon)
      }
    } catch {
      // ignore malformed prior JSON
    }
  }

  const res = await fetch(BANKS_API, {signal: AbortSignal.timeout(15_000)})
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
      const r = await fetch(b.logo, {signal: AbortSignal.timeout(15_000)})
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

  writeFileSync(outBanksJson, `${JSON.stringify(banks, null, 2)}\n`)
  if (existsSync(tmpDir)) rmSync(tmpDir, {recursive: true, force: true})
  console.log(`Synced ${banks.length} banks${withLogos ? ` (+ logos as ${cwebp ? 'webp' : 'png'})` : ''}.`)
  return banks
}

/** Map `dl.vietqr.io` appId slug to canonical uppercase bank code in `banks.json`. */
function normalizeAppIdToCode(appId: string): string | null {
  const clean = appId.trim().toLowerCase()
  if (clean === 'acb-biz') return null // corporate app variant; retail ACB uses `acb`
  if (clean === 'vib-2') return 'VIB'
  return clean.toUpperCase()
}

async function mapConcurrent<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({length: Math.min(limit, items.length)}, async () => {
      while (next < items.length) {
        const idx = next++
        out[idx] = await fn(items[idx]!)
      }
    }),
  )
  return out
}

interface DlProbeResult {
  appId: string
  code: string
  iosScheme: string
  androidPackage: string
}

async function probeDlVietQr(appId: string, code: string): Promise<DlProbeResult> {
  const url = `${DL_VIETQR_BASE}?app=${encodeURIComponent(appId)}`
  const [iosRes, andRes] = await Promise.all([
    fetch(url, {redirect: 'manual', headers: {'User-Agent': IOS_UA}, signal: AbortSignal.timeout(10_000)}).catch(() => null),
    fetch(url, {redirect: 'manual', headers: {'User-Agent': ANDROID_UA}, signal: AbortSignal.timeout(10_000)}).catch(() => null),
  ])

  let iosScheme = ''
  if (iosRes) {
    const loc = iosRes.headers.get('location') ?? ''
    if (loc && /^[a-z0-9.+-]+:\/\//i.test(loc) && !loc.startsWith('http')) {
      iosScheme = `${loc.split('://')[0]}://`
    } else if (iosRes.ok) {
      const html = await iosRes.text().catch(() => '')
      const fallback = html.match(/"fallback":"([^"]+)"/)?.[1] ?? ''
      if (fallback && /^[a-z0-9.+-]+:\/\//i.test(fallback)) {
        iosScheme = `${fallback.split('://')[0]}://`
      }
    }
  }

  let androidPackage = ''
  if (andRes) {
    const loc = andRes.headers.get('location') ?? ''
    const pkg = loc.match(/package=([^;]+)/)?.[1] ?? ''
    if (pkg) androidPackage = pkg.trim()
  }

  return {appId, code, iosScheme, androidPackage}
}

async function isPlayStoreLive(pkg: string): Promise<boolean> {
  if (!pkg) return false
  try {
    const res = await fetch(`https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`, {
      signal: AbortSignal.timeout(10_000),
    })
    return res.ok
  } catch {
    return false
  }
}

async function resolveAppStoreId(pkg: string, appName: string): Promise<string> {
  if (pkg) {
    const byBundle = await fetchJson<{results?: Array<{trackId?: number}>}>(
      `https://itunes.apple.com/lookup?country=vn&bundleId=${encodeURIComponent(pkg)}`,
    )
    const id = byBundle?.results?.[0]?.trackId
    if (id) return String(id)
  }
  if (appName) {
    const byName = await fetchJson<{results?: Array<{trackId?: number}>}>(
      `https://itunes.apple.com/search?country=vn&entity=software&limit=1&term=${encodeURIComponent(appName)}`,
    )
    const id = byName?.results?.[0]?.trackId
    if (id) return String(id)
  }
  return ''
}

async function syncDeeplinks(banks: readonly BankRecord[]) {
  const bankByCode = new Map(banks.map((b) => [b.code.toUpperCase(), b]))
  const bankByBin = new Map(banks.map((b) => [b.bin, b]))

  const current: BankAppRecord[] = existsSync(outBankAppsJson)
    ? (JSON.parse(readFileSync(outBankAppsJson, 'utf8')) as BankAppRecord[])
    : []
  const byCode = new Map(current.map((entry) => [entry.code.toUpperCase(), structuredClone(entry)]))

  // 1. Fetch official VietQR deeplink catalogs + vietqr-core gateway concurrently.
  const [iosCatalog, androidCatalog, discovery] = await Promise.all([
    fetchJson<{apps?: VietQrDeeplinkApp[]}>(IOS_DEEPLINKS_API),
    fetchJson<{apps?: VietQrDeeplinkApp[]}>(ANDROID_DEEPLINKS_API),
    fetchJson<{gateway?: string}>(VIETQR_CORE_DISCOVERY_URL),
  ])

  const gateway =
    typeof discovery?.gateway === 'string' && /^https?:\/\//i.test(discovery.gateway)
      ? discovery.gateway.replace(/\/+$/, '')
      : null
  if (!gateway) {
    console.warn('! vietqr-core discovery unreachable; skipping vietqr-core check.')
  }
  const vietqrCoreCatalog = gateway ? await fetchJson<{code?: string; data?: VietQrCoreApp[]}>(`${gateway}/v1/apps`) : null

  const iosApps = iosCatalog?.apps ?? []
  const androidApps = androidCatalog?.apps ?? []
  const vietqrCoreApps = vietqrCoreCatalog?.data ?? []

  if (!iosApps.length && !androidApps.length && !vietqrCoreApps.length) {
    console.warn('! Deeplink crawler: all upstream sources unreachable; keeping existing bank-apps.json.')
    return
  }

  // Build unique probe targets from api.vietqr.io (prefer `vib-2` over legacy `vib` alias).
  const rawIds = new Map<string, {appId: string; code: string; appName: string; autofill: boolean}>()
  for (const app of [...iosApps, ...androidApps]) {
    const code = normalizeAppIdToCode(app.appId)
    if (!code) continue
    const prev = rawIds.get(code)
    // Prefer `vib-2` over `vib` when both appear
    if (prev && prev.appId === 'vib-2') continue
    rawIds.set(code, {
      appId: app.appId,
      code,
      appName: app.appName || app.bankName,
      autofill: Boolean(app.autofill) || Boolean(prev?.autofill),
    })
  }

  // 2. Crawl dl.vietqr.io for live iOS schemes & Android package names.
  const probes = await mapConcurrent([...rawIds.values()], 6, (item) => probeDlVietQr(item.appId, item.code))
  const probeByCode = new Map(probes.map((p) => [p.code, p]))

  const added: string[] = []
  const notices: string[] = []
  const missingSpecs: string[] = []

  // 3. Reconcile official VietQR deeplink entries.
  for (const [code, meta] of rawIds) {
    if (!bankByCode.has(code)) continue // skip non-directory codes
    const probe = probeByCode.get(code)
    const existing = byCode.get(code)

    if (!existing) {
      if (!probe?.iosScheme || !probe.androidPackage) {
        missingSpecs.push(`${code} (dl.vietqr.io missing ${!probe?.iosScheme ? 'iosScheme' : 'androidPackage'})`)
        continue
      }
      const [pkgLive, appStoreId] = await Promise.all([
        isPlayStoreLive(probe.androidPackage),
        resolveAppStoreId(probe.androidPackage, meta.appName),
      ])
      if (!pkgLive) {
        missingSpecs.push(`${code} (Play Store package ${probe.androidPackage} returned non-200)`)
        continue
      }
      if (!appStoreId) {
        missingSpecs.push(`${code} (could not resolve App Store ID for ${meta.appName})`)
        continue
      }
      const tier: BankAppRecord['tier'] = meta.autofill ? 'qrpay' : 'launch'
      byCode.set(code, {
        code,
        ios: {
          scheme: probe.iosScheme,
          appStoreId,
          handoff: tier === 'qrpay' ? {kind: 'qrPay', path: 'applink'} : null,
        },
        android: {package: probe.androidPackage},
        tier,
      })
      added.push(code)
      continue
    }

    // Existing entry: fill empty fields, or log verified upstream changes for review.
    if (!existing.ios.scheme && probe?.iosScheme) {
      existing.ios.scheme = probe.iosScheme
      notices.push(`${code}: filled missing ios.scheme -> ${probe.iosScheme}`)
    }
    if (!existing.android.package && probe?.androidPackage) {
      existing.android.package = probe.androidPackage
      notices.push(`${code}: filled missing android.package -> ${probe.androidPackage}`)
    } else if (probe?.androidPackage && probe.androidPackage !== existing.android.package) {
      const upstreamLive = await isPlayStoreLive(probe.androidPackage)
      if (upstreamLive) {
        notices.push(`${code}: upstream android.package differs (${existing.android.package} vs ${probe.androidPackage})`)
      }
    }
    if (meta.autofill && existing.tier === 'launch') {
      notices.push(`${code}: upstream api.vietqr.io reports autofill=1 (currently tier='launch')`)
    }
  }

  // 4. Cross-check vietqr-core catalog for newly supported banks or autofill changes.
  for (const item of vietqrCoreApps) {
    const code = (item.appCode || '').trim().toUpperCase()
    const bank = bankByCode.get(code) ?? (item.bin ? bankByBin.get(item.bin) : undefined)
    if (!bank) continue
    const bankCode = bank.code.toUpperCase()
    const existing = byCode.get(bankCode)
    if (!existing) {
      if (!rawIds.has(bankCode)) {
        missingSpecs.push(`${bankCode} (listed by vietqr-core as ${item.appName}; needs iOS scheme + Android package)`)
      }
      continue
    }
    if (item.supportsAutofill && existing.tier === 'launch') {
      notices.push(`${bankCode}: vietqr-core reports supportsAutofill=true (currently tier='launch')`)
    }
  }

  // Preserve tier ordering (`autofill` -> `qrpay` -> `launch`) and existing order within each tier.
  const tierOrder: Record<BankAppRecord['tier'], number> = {autofill: 0, qrpay: 1, launch: 2}
  const existingIndex = new Map(current.map((e, i) => [e.code.toUpperCase(), i]))
  const merged = [...byCode.values()].sort((a, b) => {
    const td = tierOrder[a.tier] - tierOrder[b.tier]
    if (td !== 0) return td
    const ia = existingIndex.get(a.code.toUpperCase()) ?? Number.MAX_SAFE_INTEGER
    const ib = existingIndex.get(b.code.toUpperCase()) ?? Number.MAX_SAFE_INTEGER
    if (ia !== ib) return ia - ib
    return a.code.localeCompare(b.code)
  })

  writeFileSync(outBankAppsJson, `${JSON.stringify(merged, null, 2)}\n`)
  console.log(
    `Synced ${merged.length} deeplink bank apps (upstream: api.vietqr.io iOS=${iosApps.length}/Android=${androidApps.length}, vietqr-core=${vietqrCoreApps.length}${added.length ? `, added=${added.join(',')}` : ''}).`,
  )
  for (const note of notices) console.log(`  ~ ${note}`)
  for (const miss of missingSpecs) console.log(`  ? ${miss}`)
}

const banks = deeplinksOnly
  ? (JSON.parse(readFileSync(outBanksJson, 'utf8')) as BankRecord[])
  : await syncBanksDirectory()

if (withDeeplinks || deeplinksOnly) {
  await syncDeeplinks(banks)
}
