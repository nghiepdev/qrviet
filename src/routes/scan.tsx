import {useEffect, useEffectEvent, useRef, useState} from 'react'
import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {History, ImageUp, ScanLine, Trash2} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {Tab, TabList} from '@astryxdesign/core/TabList'
import {TextArea} from '@astryxdesign/core/TextArea'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {useToast} from '@astryxdesign/core/Toast'
import {useMediaQuery} from '@astryxdesign/core/hooks'
import {PageBody, PageHeader, Panel} from '#/components/common/page-header'
import {CameraScanner, subscribeCameraStart} from '#/components/scan/camera-scanner'
import {ResultCard, type ScanResult} from '#/components/scan/result-card'
import {decodeBlob, imageFromDataTransfer} from '#/lib/scan'
import {classifyPayload} from '#/lib/payloads'
import {formatVnd} from '#/lib/money'
import {getBankByBin} from '#/data/banks'
import {addHistory} from '#/stores/history'
import {useSettings} from '#/stores/settings'
import {uid} from '#/lib/text'
import {useT} from '#/i18n'
import {pageHead} from '#/seo/head'

interface ScanSearch {
  text?: string
  url?: string
  title?: string
}

export const Route = createFileRoute('/scan')({
  head: () => pageHead('scan'),
  validateSearch: (s: Record<string, unknown>): ScanSearch => {
    const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined)
    return {text: str(s.text), url: str(s.url), title: str(s.title)}
  },
  component: ScanPage,
})

/** Codes found in an image; null when the image could not be read at all. */
async function decodeImageFile(file: Blob): Promise<string[] | null> {
  try {
    return await decodeBlob(file)
  } catch {
    return null
  }
}

function historyEntry(text: string) {
  const c = classifyPayload(text)
  if (c.type === 'emv' && c.emv.kind === 'vietqr') {
    const p = c.emv
    const bank = getBankByBin(p.bin)
    return {
      title: p.merchantName || bank?.shortName || p.accountNumber,
      subtitle: [bank?.shortName, p.accountNumber, p.amount ? formatVnd(p.amount, true) : ''].filter(Boolean).join(' · '),
      meta: {bin: p.bin, accountNumber: p.accountNumber, accountName: p.merchantName, amount: p.amount || undefined, purpose: p.purpose, qrType: 'vietqr'},
    }
  }
  return {title: text.slice(0, 60), subtitle: c.type, meta: {qrType: c.type}}
}

function ScanPage() {
  const t = useT()
  const showToast = useToast()
  const navigate = useNavigate({from: '/scan'})
  const search = Route.useSearch()
  const autoSave = useSettings((s) => s.autoSaveHistory)
  const isMobile = useMediaQuery('(max-width: 767.98px)')
  const [tab, setTab] = useState('camera')
  const [results, setResults] = useState<ScanResult[]>([])
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [externalScanCount, setExternalScanCount] = useState(0)
  const [startRequest, setStartRequest] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const activeTab = isMobile && tab === 'image' ? 'camera' : tab

  const push = (value: string, source: ScanResult['source']) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setResults((list) => [{id: uid(), text: trimmed, at: Date.now(), source}, ...list.filter((r) => r.text !== trimmed)].slice(0, 20))
    if (autoSave) addHistory({kind: 'scan', payload: trimmed, ...historyEntry(trimmed)})
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({behavior: 'smooth', block: 'nearest'}))
  }

  const decodeImage = async (file: Blob) => {
    setBusy(true)
    const found = await decodeImageFile(file)
    setBusy(false)
    if (!found?.length) return showToast({body: t('scan.notFound'), type: 'error', uniqueID: 'scan'})
    found.forEach((f) => push(f, 'image'))
    setExternalScanCount((c) => c + 1)
  }

  const pasteFromClipboard = async () => {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    if (!clipboard) {
      showToast({body: t('scan.pastePermission'), type: 'error', uniqueID: 'scan'})
      return
    }
    setPasting(true)
    try {
      if (typeof clipboard.read === 'function') {
        const items = await clipboard.read()
        for (const item of items) {
          const imageType = item.types.find((type) => type.startsWith('image/'))
          if (imageType) {
            const blob = await item.getType(imageType)
            await decodeImage(blob)
            return
          }
        }
        for (const item of items) {
          if (item.types.includes('text/plain')) {
            const blob = await item.getType('text/plain')
            const pasted = (await blob.text()).trim()
            if (pasted) {
              push(pasted, 'text')
              setExternalScanCount((c) => c + 1)
              return
            }
          }
        }
        showToast({body: t('scan.pasteEmpty'), type: 'error', uniqueID: 'scan'})
        return
      }
      if (typeof clipboard.readText === 'function') {
        const pasted = (await clipboard.readText()).trim()
        if (pasted) {
          push(pasted, 'text')
          setExternalScanCount((c) => c + 1)
          return
        }
        showToast({body: t('scan.pasteEmpty'), type: 'error', uniqueID: 'scan'})
        return
      }
      showToast({body: t('scan.pastePermission'), type: 'error', uniqueID: 'scan'})
    } catch (e) {
      const name = (e as DOMException | undefined)?.name
      if (name !== 'NotAllowedError' && typeof clipboard.readText === 'function') {
        try {
          const pasted = (await clipboard.readText()).trim()
          if (pasted) {
            push(pasted, 'text')
            setExternalScanCount((c) => c + 1)
            return
          }
        } catch {
          /* fall through */
        }
      }
      showToast({
        body: t(name === 'NotAllowedError' ? 'scan.pastePermission' : 'scan.pasteEmpty'),
        type: 'error',
        uniqueID: 'scan',
      })
    } finally {
      setPasting(false)
    }
  }

  // Share target (Android "Share → QRViet") delivers text/url as query params.
  const receiveShare = useEffectEvent(({text, url}: ScanSearch) => {
    const shared = text || url
    if (!shared) return
    push(url && !text?.includes(url) ? `${text ?? ''} ${url}`.trim() : shared, 'share')
    showToast({body: t('scan.shared'), uniqueID: 'shared'})
    setTab('text')
    void navigate({search: {}, replace: true, resetScroll: false})
  })
  useEffect(() => {
    receiveShare(search)
  }, [search])

  // Paste an image (screenshot) anywhere on the page.
  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    const target = e.target as HTMLElement | null
    const image = imageFromDataTransfer(e.clipboardData)
    if (image) {
      e.preventDefault()
      void decodeImage(image)
      return
    }
    if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return
    const pasted = e.clipboardData?.getData('text')
    if (pasted) push(pasted, 'text')
  })
  useEffect(() => {
    const listener = (e: ClipboardEvent) => onPaste(e)
    window.addEventListener('paste', listener)
    return () => window.removeEventListener('paste', listener)
  }, [])

  useEffect(
    () =>
      subscribeCameraStart(() => {
        setTab('camera')
        setStartRequest((n) => n + 1)
      }),
    [],
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const image = imageFromDataTransfer(e.dataTransfer)
    if (image) void decodeImage(image)
  }

  return (
    <div
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
      className="relative">
      <PageHeader title={t('scan.title')} subtitle={t('scan.subtitle')} icon={<ScanLine size={22} />} />
      <PageBody>
        {/* Side by side, the results column takes the row's height, so an empty list fills it; the
            scanner keeps its own height when many results make the row taller. */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Panel hue="blue" className="md:self-start">
            <div className="flex flex-col gap-4">
              <TabList value={activeTab} onChange={setTab} layout="fill" role="tablist">
                <Tab value="camera" label={t('scan.camera')} panelId="scan-panel" />
                {!isMobile && <Tab value="image" label={t('scan.image')} panelId="scan-panel" />}
                <Tab value="text" label={t('scan.text')} panelId="scan-panel" />
              </TabList>
              <div id="scan-panel" role="tabpanel" className="flex flex-col gap-4">
              {activeTab === 'camera' && (
                <CameraScanner
                  onResult={(r) => push(r, 'camera')}
                  onPickImage={() => fileRef.current?.click()}
                  isPickingImage={busy}
                  onPaste={() => void pasteFromClipboard()}
                  isPasting={pasting}
                  externalScanCount={externalScanCount}
                  startRequest={startRequest}
                />
              )}
              {activeTab === 'image' && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                    dragging ? 'border-accent bg-accent-muted' : 'border-border hover:border-strong'
                  }`}>
                  <ImageUp size={36} className="text-accent" aria-hidden />
                  <span className="font-semibold">{dragging ? t('scan.drop') : t('scan.pick')}</span>
                  <span className="text-sm text-secondary">{t('scan.pasteHint')}</span>
                  {busy && <span className="text-sm text-secondary">…</span>}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void decodeImage(f)
                  e.target.value = ''
                }}
              />
              {activeTab === 'text' && (
                <div className="flex flex-col gap-3">
                  <TextArea label={t('scan.text')} isLabelHidden value={text} onChange={setText} placeholder={t('scan.textPlaceholder')} rows={5} hasSpellCheck={false} />
                  <div>
                    <Button label={t('scan.decode')} variant="primary" isDisabled={!text.trim()} onClick={() => push(text, 'text')} />
                  </div>
                </div>
              )}
              </div>
            </div>
          </Panel>

          <div className="flex min-w-0 flex-col" ref={resultsRef}>
            <Panel
              title={t('scan.results')}
              icon={History}
              hue="violet"
              actions={results.length > 0 && <Button label={t('scan.clearResults')} size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setResults([])} />}
              className="flex flex-1 flex-col">
              {results.length === 0 ? (
                <div className="flex flex-1 flex-col justify-center">
                  <EmptyState icon={<ScanLine size={36} aria-hidden />} title={t('common.empty')} description={t('scan.pasteHint')} isCompact />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {results.map((r) => (
                    <ResultCard key={r.id} result={r} onRemove={() => setResults((list) => list.filter((x) => x.id !== r.id))} />
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </PageBody>
      {dragging && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)] backdrop-blur-sm pointer-events-none">
          <div className="rounded-2xl bg-surface px-8 py-6 shadow-lg font-bold text-lg">{t('scan.drop')}</div>
        </div>
      )}
    </div>
  )
}
