/**
 * Renders the Open Graph preview cards (`public/og-image.png` and `public/og-image-pay.png`,
 * 1200 × 630) using headless Google Chrome / Chromium and the project's self-hosted Be Vietnam Pro
 * font. Re-run with `pnpm gen:og`.
 *
 * When ffmpeg is installed the PNGs are quantized to an 8-bit palette to keep file sizes small.
 */
import {spawn, spawnSync} from 'node:child_process'
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {DEFAULT_QR_STYLE, layoutQr, makeQr, qrToSvgParts, type QrLogo} from '../src/lib/qr/render.ts'

const root = resolve(import.meta.dirname, '..')

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

function dataUri(relPath: string, mime: string): string {
  const buf = readFileSync(join(root, relPath))
  return `data:${mime};base64,${buf.toString('base64')}`
}

function qrSvgMarkup(payload: string, logoUri: string, sizePx: number): string {
  const style = {
    ...DEFAULT_QR_STYLE,
    dots: 'rounded' as const,
    eyeFrame: 'rounded' as const,
    eyeBall: 'rounded' as const,
    ecc: 'Q' as const,
    margin: 1,
    fg: '#251116',
    eyeFrameColor: '#d7263d',
    eyeBallColor: '#a5122a',
  }
  const logo: QrLogo = {
    src: logoUri,
    size: 0.22,
    plate: 'rounded',
    plateColor: '#ffffff',
    excavate: true,
  }
  const geo = layoutQr(makeQr(payload, style.ecc), style, logo)
  const {defs, body} = qrToSvgParts(geo, 0, 0, sizePx, {style, logo, idPrefix: `og-${sizePx}`})
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}" aria-hidden="true">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`
}

function fontFacesCss(): string {
  const weights = [500, 600, 700, 800] as const
  const subsets = ['vietnamese', 'latin'] as const
  const rules: string[] = []
  for (const w of weights) {
    for (const s of subsets) {
      const file = join(root, `node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-${s}-${w}-normal.woff2`)
      rules.push(`@font-face {
        font-family: 'Be Vietnam Pro';
        font-style: normal;
        font-weight: ${w};
        src: url('${pathToFileURL(file).href}') format('woff2');
      }`)
    }
  }
  return rules.join('\n')
}

function sharedCss(): string {
  return `${fontFacesCss()}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 1200px;
  height: 630px;
  overflow: hidden;
  font-family: 'Be Vietnam Pro', system-ui, -apple-system, sans-serif;
  color: #251116;
  background: #fff8f4;
  -webkit-font-smoothing: antialiased;
}
.canvas {
  position: relative;
  width: 1200px;
  height: 630px;
  padding: 54px 62px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 416px;
  gap: 44px;
  align-items: center;
  background:
    radial-gradient(640px 520px at 4% 0%, rgba(255, 205, 213, 0.72), transparent 70%),
    radial-gradient(560px 460px at 96% 100%, rgba(255, 228, 173, 0.42), transparent 72%),
    linear-gradient(135deg, #fff6f4 0%, #fffaf6 55%, #fff7f0 100%);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.brand-logo {
  width: 58px;
  height: 58px;
  border-radius: 14px;
  box-shadow: 0 12px 26px -6px rgba(215, 38, 61, 0.36);
}
.brand-name {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #251116;
}
.brand-name span { color: #d7263d; }
h1 {
  font-size: 50px;
  font-weight: 800;
  line-height: 1.14;
  letter-spacing: -0.032em;
  color: #220f14;
  margin-bottom: 18px;
}
.desc {
  font-size: 22px;
  font-weight: 500;
  line-height: 1.48;
  color: #634149;
  max-width: 590px;
  margin-bottom: 30px;
}
.desc strong {
  color: #b8142b;
  font-weight: 700;
}
.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(130, 62, 74, 0.16);
  color: #46252c;
  box-shadow: 0 2px 8px rgba(37, 17, 22, 0.04);
}
.pill-accent {
  background: #fff0f2;
  border-color: rgba(215, 38, 61, 0.34);
  color: #b5152c;
  font-weight: 700;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #d7263d;
}
.card {
  width: 416px;
  border-radius: 28px;
  background: #ffffff;
  border: 1px solid rgba(180, 74, 92, 0.14);
  box-shadow:
    0 26px 54px -18px rgba(102, 22, 36, 0.18),
    0 6px 18px -6px rgba(37, 17, 22, 0.06);
  overflow: hidden;
}
.card-body {
  padding: 24px 26px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.qr-frame {
  padding: 14px;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid rgba(37, 17, 22, 0.08);
  box-shadow: inset 0 0 0 1px rgba(215, 38, 61, 0.04);
}
.deeplink-bar {
  width: 100%;
  margin-top: 18px;
  padding: 12px 14px;
  border-radius: 16px;
  background: #fff5f6;
  border: 1px solid rgba(215, 38, 61, 0.18);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.bank-stack {
  display: flex;
  align-items: center;
}
.bank-chip {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: #ffffff;
  border: 2px solid #fff5f6;
  box-shadow: 0 2px 6px rgba(37, 17, 22, 0.10);
  object-fit: contain;
  padding: 3px;
}
.bank-chip + .bank-chip { margin-left: -6px; }
.cta-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 13px;
  border-radius: 11px;
  background: linear-gradient(135deg, #f0435a 0%, #d7263d 100%);
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
  box-shadow: 0 6px 14px -4px rgba(215, 38, 61, 0.45);
}
.home-card-top {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.tag {
  font-size: 13px;
  font-weight: 700;
  color: #d7263d;
  background: #fff0f2;
  padding: 5px 11px;
  border-radius: 999px;
}
.tag-sub {
  font-size: 13px;
  font-weight: 600;
  color: #7c565e;
}
.pay-banner {
  padding: 20px 24px 18px;
  background: linear-gradient(135deg, #f0435a 0%, #d7263d 58%, #a5122a 100%);
  color: #ffffff;
}
.pay-banner-kicker {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.9;
  margin-bottom: 4px;
}
.pay-banner-title {
  font-size: 25px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
`
}

function bankStackHtml(banks: string[]): string {
  return `<div class="bank-stack">${banks.map((src) => `<img class="bank-chip" src="${src}" alt="">`).join('')}</div>`
}

function homeOgHtml(logoUri: string, qrSvg: string, banks: string[]): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>${sharedCss()}</style></head>
<body>
  <main class="canvas">
    <section>
      <div class="brand">
        <img class="brand-logo" src="${logoUri}" alt="">
        <div class="brand-name">QR<span>Viet</span></div>
      </div>
      <h1>Tạo, quét &amp; mở app<br>chuyển khoản VietQR</h1>
      <p class="desc">Mã QR cho mọi ngân hàng, link thanh toán &amp; <strong>Deeplink mở thẳng app ngân hàng</strong> ngay trên điện thoại.</p>
      <div class="pills">
        <span class="pill pill-accent"><span class="dot"></span>Deeplink 40+ app</span>
        <span class="pill">100% Offline</span>
        <span class="pill">Riêng tư</span>
        <span class="pill">Miễn phí</span>
      </div>
    </section>
    <aside class="card">
      <div class="card-body">
        <div class="home-card-top">
          <span class="tag">VietQR · NAPAS 24/7</span>
          <span class="tag-sub">40+ ngân hàng &amp; ví</span>
        </div>
        <div class="qr-frame">${qrSvg}</div>
        <div class="deeplink-bar">
          ${bankStackHtml(banks)}
          <span class="cta-badge">Mở app ngân hàng →</span>
        </div>
      </div>
    </aside>
  </main>
</body></html>`
}

function payOgHtml(logoUri: string, qrSvg: string, banks: string[]): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>${sharedCss()}</style></head>
<body>
  <main class="canvas">
    <section>
      <div class="brand">
        <img class="brand-logo" src="${logoUri}" alt="">
        <div class="brand-name">QR<span>Viet</span></div>
      </div>
      <h1>Thanh toán<br>chuyển khoản</h1>
      <p class="desc">Quét mã VietQR, dùng <strong>Deeplink mở app ngân hàng</strong> trực tiếp hoặc sao chép nhanh để chuyển khoản.</p>
      <div class="pills">
        <span class="pill pill-accent"><span class="dot"></span>Deeplink mở app</span>
        <span class="pill">Mọi ngân hàng</span>
        <span class="pill">Sao chép nhanh</span>
        <span class="pill">Riêng tư</span>
      </div>
    </section>
    <aside class="card">
      <div class="pay-banner">
        <div class="pay-banner-kicker">Link thanh toán VietQR</div>
        <div class="pay-banner-title">Chạm mở app · Quét QR</div>
      </div>
      <div class="card-body">
        <div class="qr-frame">${qrSvg}</div>
        <div class="deeplink-bar">
          ${bankStackHtml(banks)}
          <span class="cta-badge">Deeplink mở app →</span>
        </div>
      </div>
    </aside>
  </main>
</body></html>`
}

type Send = (method: string, params?: object) => Promise<Record<string, unknown>>

async function openPage(userDataDir: string) {
  const chrome = CHROME_CANDIDATES.find((p) => p && existsSync(p))
  if (!chrome) throw new Error('Chrome/Chromium not found — set CHROME_PATH')
  const proc = spawn(
    chrome,
    ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'],
    {stdio: ['ignore', 'ignore', 'pipe']},
  )
  const browserWs = await new Promise<string>((resolveWs, reject) => {
    let log = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      log += chunk
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/)
      if (match) resolveWs(match[1])
    })
    proc.on('exit', () => reject(new Error(`Chrome exited early:\n${log}`)))
  })
  const port = new URL(browserWs).port
  const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as Array<{type: string; webSocketDebuggerUrl: string}>
  const ws = new WebSocket(targets.find((t) => t.type === 'page')!.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, {once: true}))
  let nextId = 0
  const pending = new Map<number, {resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void}>()
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data))
    const entry = msg.id ? pending.get(msg.id) : undefined
    if (!entry) return
    pending.delete(msg.id)
    if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)))
    else entry.resolve(msg.result)
  })
  const send: Send = (method, params = {}) =>
    new Promise((resolveCall, reject) => {
      const id = ++nextId
      pending.set(id, {resolve: resolveCall, reject})
      ws.send(JSON.stringify({id, method, params}))
    })
  const exited = new Promise((r) => proc.once('exit', r))
  const close = async () => {
    ws.close()
    proc.kill()
    await exited
  }
  return {send, close}
}

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], {stdio: 'ignore'}).status === 0

function quantize(file: string) {
  const tmp = `${file}.tmp.png`
  const filter = 'split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a'
  const run = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', file, '-vf', filter, '-pix_fmt', 'pal8', tmp])
  if (run.status !== 0) throw new Error(`ffmpeg failed for ${file}: ${run.stderr}`)
  rmSync(file)
  writeFileSync(file, readFileSync(tmp))
  rmSync(tmp)
}

async function main() {
  const logoUri = dataUri('public/logo.svg', 'image/svg+xml')
  const banks = [
    dataUri('public/banks/icons/mb.webp', 'image/webp'),
    dataUri('public/banks/icons/vcb.svg', 'image/svg+xml'),
    dataUri('public/banks/icons/tcb.svg', 'image/svg+xml'),
    dataUri('public/banks/icons/momo.webp', 'image/webp'),
  ]
  const homeQr = qrSvgMarkup('https://qrviet.nghiep.dev', logoUri, 240)
  const payQr = qrSvgMarkup('https://qrviet.nghiep.dev/pay', logoUri, 208)

  const cards = [
    {file: 'public/og-image.png', html: homeOgHtml(logoUri, homeQr, banks)},
    {file: 'public/og-image-pay.png', html: payOgHtml(logoUri, payQr, banks)},
  ]

  const work = mkdtempSync(join(tmpdir(), 'qrviet-og-'))
  const {send, close} = await openPage(join(work, 'profile'))
  try {
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', {width: 1200, height: 630, deviceScaleFactor: 1, mobile: false})
    for (const card of cards) {
      const pagePath = join(work, `${card.file.replace(/\W+/g, '_')}.html`)
      writeFileSync(pagePath, card.html)
      await send('Page.navigate', {url: pathToFileURL(pagePath).href})
      await send('Runtime.evaluate', {
        expression: `new Promise((r) => document.readyState === 'complete' ? r() : addEventListener('load', r))`,
        awaitPromise: true,
      })
      await send('Runtime.evaluate', {
        expression: `document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))`,
        awaitPromise: true,
      })
      const {data} = (await send('Page.captureScreenshot', {format: 'png'})) as {data: string}
      const outPath = join(root, card.file)
      writeFileSync(outPath, Buffer.from(data, 'base64'))
      if (hasFfmpeg) quantize(outPath)
      const kb = (readFileSync(outPath).length / 1024).toFixed(1)
      console.log(`Wrote ${card.file} (1200x630, ${kb} KiB${hasFfmpeg ? ', palette PNG' : ''})`)
    }
  } finally {
    await close()
    rmSync(work, {recursive: true, force: true, maxRetries: 5, retryDelay: 200})
  }
}

await main()
