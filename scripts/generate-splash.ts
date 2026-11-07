/**
 * Renders the iOS launch screens listed in src/app/splash.ts into
 * public/splash/, from the boot splash in src/app/boot-splash.ts (frozen at its first
 * frame). Re-run after changing the boot splash: `pnpm gen:splash`.
 *
 * Needs Google Chrome or Chromium (set CHROME_PATH to point at another binary).
 * When ffmpeg is installed the PNGs are reduced to an 8-bit palette, which
 * roughly halves their size with no visible difference.
 */
import {spawn, spawnSync} from 'node:child_process'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {SPLASH_DIR, splashVariants} from '../src/app/splash.ts'
import {BOOT_CSS, BOOT_HTML} from '../src/app/boot-splash.ts'

const root = resolve(import.meta.dirname, '..')
const outDir = join(root, 'public', SPLASH_DIR)

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

/** The boot splash as a standalone page, animations frozen at rest. */
function bootSplashPage(): string {
  const font = pathToFileURL(join(root, 'node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-700-normal.woff2')).href
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Be Vietnam Pro'; font-weight: 700; src: url('${font}') format('woff2'); }
${BOOT_CSS}
#boot, #boot * { animation: none !important; transition: none !important; }
/* The "V" is drawn by a dash animation; a still image shows it complete. */
#boot .qv-v { stroke-dasharray: none !important; }
body { margin: 0; }
</style></head><body>${BOOT_HTML}</body></html>`
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

function pngSize(png: Buffer): [number, number] {
  return [png.readUInt32BE(16), png.readUInt32BE(20)]
}

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], {stdio: 'ignore'}).status === 0

/** 8-bit palette PNG (with dithering for the logo's gradient and shadow), in place. */
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
  const work = mkdtempSync(join(tmpdir(), 'qrviet-splash-'))
  const pagePath = join(work, 'splash.html')
  writeFileSync(pagePath, bootSplashPage())
  const {send, close} = await openPage(join(work, 'profile'))
  try {
    await send('Page.enable')
    await send('Page.navigate', {url: pathToFileURL(pagePath).href})
    await send('Runtime.evaluate', {expression: `new Promise((r) => document.readyState === 'complete' ? r() : addEventListener('load', r))`, awaitPromise: true})

    rmSync(outDir, {recursive: true, force: true})
    mkdirSync(outDir, {recursive: true})
    let bytes = 0
    const variants = splashVariants()
    for (const v of variants) {
      await send('Emulation.setDeviceMetricsOverride', {width: v.cssWidth, height: v.cssHeight, deviceScaleFactor: v.screen.ratio, mobile: true})
      await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: v.scheme}]})
      await send('Runtime.evaluate', {
        expression: `document.fonts.load('700 22px "Be Vietnam Pro"').then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))`,
        awaitPromise: true,
      })
      const {data} = (await send('Page.captureScreenshot', {format: 'png'})) as {data: string}
      const png = Buffer.from(data, 'base64')
      const [w, h] = pngSize(png)
      if (w !== v.cssWidth * v.screen.ratio || h !== v.cssHeight * v.screen.ratio) {
        throw new Error(`${v.file}: rendered ${w}×${h}, expected ${v.cssWidth * v.screen.ratio}×${v.cssHeight * v.screen.ratio}`)
      }
      const file = join(root, 'public', v.file)
      writeFileSync(file, png)
      if (hasFfmpeg) quantize(file)
      bytes += readFileSync(file).length
    }
    console.log(
      `Wrote ${variants.length} launch screens to public/${SPLASH_DIR}/ (${(bytes / 1024).toFixed(0)} KiB${hasFfmpeg ? ', palette PNG' : ', install ffmpeg to shrink them'})`,
    )
  } finally {
    await close()
    rmSync(work, {recursive: true, force: true, maxRetries: 5, retryDelay: 200})
  }
}

await main()
