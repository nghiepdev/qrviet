import {useEffect, useState, type ReactNode} from 'react'
import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {Copy, History as HistoryIcon, MoreHorizontal, Pin, PinOff, ScanLine, Search, Shapes, Trash2, QrCode} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {AlertDialog} from '@astryxdesign/core/AlertDialog'
import {Badge, type BadgeVariant} from '@astryxdesign/core/Badge'
import {DropdownMenu} from '@astryxdesign/core/DropdownMenu'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl'
import {Switch} from '@astryxdesign/core/Switch'
import {TextInput} from '@astryxdesign/core/TextInput'
import {useToast} from '@astryxdesign/core/Toast'
import {PageBody, PageHeader, Panel} from '#/components/common/page-header'
import {BankLogo} from '#/components/bank/bank-logo'
import {clearHistory, removeHistory, restoreHistory, togglePin, useHistory, type HistoryItem} from '#/stores/history'
import {updateSettings, useSettings} from '#/stores/settings'
import {getBankByBin} from '#/data/banks'
import {DEFAULT_QR_STYLE, layoutQr, makeQr, qrToSvg} from '#/lib/qr/render'
import {groupDigits, matchesQuery} from '#/lib/text'
import {formatVnd} from '#/lib/money'
import {looksLikeEmv, parseEmvQr} from '#/lib/vietqr'
import {classifyPayload} from '#/lib/payloads'
import {formatRelative, useLocale, useT, type MessageKey, type TFunction} from '#/i18n'
import {useCopy} from '#/hooks/use-copy'
import {pageHead} from '#/seo/head'
import {sheetUnlessAnchored} from '#/app/anchoring'
import {loadThumb} from '#/lib/thumbs'
import {applyHistoryEntry} from '#/components/vietqr/history-entry'

export const Route = createFileRoute('/history')({
  head: () => pageHead('history'),
  component: HistoryPage,
})

const PAGE = 40

/** Small QR preview; '' when the payload cannot be encoded. */
function thumbSvg(payload: string): string {
  try {
    const style = {...DEFAULT_QR_STYLE, margin: 1}
    return qrToSvg(layoutQr(makeQr(payload, 'L'), style), 56, {style})
  } catch {
    return ''
  }
}

/**
 * The detail line without what the title already says: when an entry has no account name its title
 * falls back to the bank name, and the subtitle starts with the bank too ("BIDV · 0123… · 20.000 ₫").
 */
function detailLine(h: HistoryItem): string {
  const prefix = `${h.title} · `
  return h.subtitle.startsWith(prefix) ? h.subtitle.slice(prefix.length) : h.subtitle
}

/**
 * Title for a code that is not a bank transfer. Entries store the start of the raw payload, which
 * reads badly for structured codes (and shows a Wi-Fi password), so show what it is about instead.
 */
function contentTitle(h: HistoryItem): string {
  const c = classifyPayload(h.payload)
  switch (c.type) {
    case 'wifi':
      return c.wifi.ssid || h.title
    case 'vcard':
      return c.name || h.title
    case 'event':
      return c.title || h.title
    case 'email':
      return c.to || h.title
    case 'phone':
    case 'sms':
      return c.phone || h.title
    case 'geo':
      return c.query || `${c.lat}, ${c.lng}`
    default:
      return h.title
  }
}

/** Static/dynamic and account/card for a VietQR payload; null when it is not one. */
function vietQrKind(payload: string): {dynamic: boolean; card: boolean} | null {
  try {
    const p = parseEmvQr(payload)
    return p.kind === 'vietqr' ? {dynamic: p.initiation === 'dynamic', card: p.service === 'card'} : null
  } catch {
    return null
  }
}

interface Tag {
  key: string
  label: string
  variant: BadgeVariant
  icon?: ReactNode
}

/** The chips under a card: code type, card transfer, where it came from and whether it is pinned. */
function entryTags(h: HistoryItem, t: TFunction): Tag[] {
  const tags: Tag[] = []
  const qr = h.meta.bin ? vietQrKind(h.payload) : null
  if (qr) tags.push(qr.dynamic ? {key: 'init', label: t('scan.dynamic'), variant: 'blue'} : {key: 'init', label: t('scan.static'), variant: 'neutral'})
  if (qr?.card) tags.push({key: 'card', label: t('gen.serviceCard'), variant: 'purple'})
  if (h.kind === 'scan') tags.push({key: 'scan', label: t('his.filter.scan'), variant: 'neutral', icon: <ScanLine size={11} />})
  if (h.kind === 'qr') tags.push({key: 'qr', label: t('his.filter.qr'), variant: 'neutral', icon: <Shapes size={11} />})
  if (h.pinned) tags.push({key: 'pin', label: t('his.pinned'), variant: 'yellow', icon: <Pin size={11} />})
  return tags
}

/** Scans store the raw content type ("wifi"); the studio stores a translated label already. */
const SCAN_TYPES = new Set(['url', 'wifi', 'vcard', 'email', 'phone', 'sms', 'geo', 'event', 'text'])

/**
 * The stored image of an entry's export as an object URL: undefined while it loads, null when there
 * is none. `version` (the entry's time) changes when the code is exported again with a new design.
 */
function useThumbUrl(id: string, version: number, isStored: boolean): string | null | undefined {
  const key = `${id}:${version}`
  const [loaded, setLoaded] = useState<{key: string; url: string | null} | null>(null)
  useEffect(() => {
    if (!isStored) return
    let alive = true
    let url: string | null = null
    void loadThumb(id).then((blob) => {
      if (!alive) return
      url = blob ? URL.createObjectURL(blob) : null
      setLoaded({key, url})
    })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [id, key, isStored])
  if (!isStored) return null
  return loaded?.key === key ? loaded.url : undefined
}

const THUMB_BOX = 'block size-16 shrink-0 overflow-hidden rounded-md border border-border'

/** The image as it was exported; scans and entries saved before images were kept draw the bare code. */
function Thumb({entry}: {entry: HistoryItem}) {
  const url = useThumbUrl(entry.id, entry.createdAt, Boolean(entry.thumb))
  if (url) return <img src={url} alt="" className={`${THUMB_BOX} bg-muted object-contain p-0.5`} />
  if (url === undefined) return <span className={`${THUMB_BOX} bg-muted`} aria-hidden />
  return <span className={`${THUMB_BOX} bg-white [&>svg]:size-full`} aria-hidden dangerouslySetInnerHTML={{__html: thumbSvg(entry.payload)}} />
}

function HistoryPage() {
  const t = useT()
  const locale = useLocale()
  const items = useHistory()
  const autoSave = useSettings((s) => s.autoSaveHistory)
  const navigate = useNavigate()
  const showToast = useToast()
  const copy = useCopy()
  const [filter, setFilter] = useState<'all' | HistoryItem['kind']>('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const filtered = items
    .filter((h) => filter === 'all' || h.kind === filter)
    .filter((h) => matchesQuery(`${h.title} ${h.subtitle} ${h.meta.accountNumber ?? ''} ${h.meta.purpose ?? ''} ${h.payload}`, query))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)

  const open = (h: HistoryItem) => {
    // A VietQR goes back into the generator, at the entry's own URL. Loading it before navigating
    // means the generator's first frame already shows it, not the previous draft and design.
    if ((h.kind === 'vietqr' || h.kind === 'scan') && looksLikeEmv(h.payload) && applyHistoryEntry(h)) {
      return void navigate({to: '/', search: {h: h.id}})
    }
    void navigate({to: '/scan', search: {text: h.payload}})
  }

  const remove = (h: HistoryItem) => {
    const removed = removeHistory(h.id)
    showToast({body: t('common.deleted'), uniqueID: `h-${h.id}`, endContent: removed ? <Button label={t('common.undo')} size="sm" variant="ghost" onClick={() => restoreHistory(removed)} /> : undefined})
  }

  return (
    <>
      <PageHeader
        title={t('his.title')}
        subtitle={t('his.subtitle')}
        icon={<HistoryIcon size={22} />}
        actions={items.length > 0 ? <Button label={t('his.clearAll')} icon={<Trash2 size={16} />} variant="ghost" onClick={() => setConfirmOpen(true)} /> : undefined}
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex-1">
              <TextInput type="search" label={t('common.search')} isLabelHidden value={query} onChange={setQuery} placeholder={t('his.searchPlaceholder')} startIcon={Search} hasClear />
            </div>
            <SegmentedControl label={t('his.filter.all')} value={filter} onChange={(v) => setFilter(v as typeof filter)}>
              <SegmentedControlItem value="all" label={t('his.filter.all')} />
              <SegmentedControlItem value="vietqr" label={t('his.filter.vietqr')} />
              <SegmentedControlItem value="qr" label={t('his.filter.qr')} />
              <SegmentedControlItem value="scan" label={t('his.filter.scan')} />
            </SegmentedControl>
          </div>
          <Switch label={t('his.autoSave')} value={autoSave} onChange={(autoSaveHistory) => updateSettings({autoSaveHistory})} size="sm" />

          {filtered.length === 0 ? (
            <Panel hue="blue">
              <EmptyState icon={<HistoryIcon size={40} aria-hidden />} title={t('his.empty')} description={t('his.emptyBody')} actions={<Button label={t('nav.create')} variant="primary" href="/" />} />
            </Panel>
          ) : (
            // Cards of at least 20rem, as many per row as fit: 1 on phones, 2–3 on wider screens.
            <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))]">
              {filtered.slice(0, limit).map((h) => {
                const bank = getBankByBin(h.meta.bin)
                const KindIcon = h.kind === 'scan' ? ScanLine : h.kind === 'qr' ? Shapes : QrCode
                const account = h.meta.accountNumber ? groupDigits(h.meta.accountNumber) : ''
                const amount = h.meta.amount ? formatVnd(Number(h.meta.amount), true) : ''
                const title = bank ? h.title : contentTitle(h)
                const detail = account || (h.kind === 'scan' && SCAN_TYPES.has(h.subtitle) ? t(`scan.type.${h.subtitle}` as MessageKey) : detailLine(h))
                return (
                  <li
                    key={h.id}
                    className="relative rounded-lg border border-border bg-surface shadow-sm transition-[border-color,box-shadow] hover:border-[var(--color-border-emphasized)] hover:shadow-md">
                    <button
                      type="button"
                      className="flex w-full flex-col gap-2.5 rounded-lg p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                      onClick={() => open(h)}
                      aria-label={`${t('his.open')}: ${title}`}>
                      <span className="flex w-full items-center gap-3">
                        <Thumb entry={h} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          {/* pr-8 keeps the title clear of the menu in the corner. */}
                          <span className="flex min-w-0 items-center gap-2 pr-8">
                            {bank ? <BankLogo bank={bank} size={18} /> : <KindIcon size={16} className="shrink-0 text-secondary" aria-hidden />}
                            <span className="truncate font-semibold">{title || '—'}</span>
                          </span>
                          <span className={`truncate text-sm text-secondary ${account ? 'qv-mono' : ''}`}>{detail}</span>
                          {(amount || h.meta.purpose) && (
                            <span className="flex min-w-0 items-baseline gap-1.5">
                              {amount && <span className="qv-num shrink-0 font-semibold text-accent">{amount}</span>}
                              {h.meta.purpose && (
                                <span className="truncate text-xs text-secondary">
                                  {amount ? '· ' : ''}
                                  {h.meta.purpose}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="flex w-full flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
                        {entryTags(h, t).map((tag) => (
                          <Badge key={tag.key} variant={tag.variant} label={tag.label} icon={tag.icon} />
                        ))}
                        <span className="ml-auto shrink-0 text-xs text-secondary">{formatRelative(h.createdAt, locale)}</span>
                      </span>
                    </button>
                    <span className="absolute right-2 top-2">
                      <DropdownMenu
                        button={{label: t('common.more'), isIconOnly: true, icon: <MoreHorizontal size={16} />, variant: 'ghost', size: 'sm'}}
                        hasChevron={false}
                        presentation={sheetUnlessAnchored('popover')}
                        items={[
                          {label: t('his.open'), icon: <QrCode size={15} />, onClick: () => open(h)},
                          {label: t('common.copy'), icon: <Copy size={15} />, onClick: () => void copy(h.payload)},
                          {label: h.pinned ? t('his.unpin') : t('his.pin'), icon: h.pinned ? <PinOff size={15} /> : <Pin size={15} />, onClick: () => togglePin(h.id)},
                          {type: 'divider' as const},
                          {label: t('common.delete'), icon: <Trash2 size={15} />, variant: 'destructive' as const, onClick: () => remove(h)},
                        ]}
                      />
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {filtered.length > limit && (
            <div className="flex justify-center">
              <Button label={t('common.more')} onClick={() => setLimit((l) => l + PAGE)} />
            </div>
          )}
        </div>
      </PageBody>
      <AlertDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('his.clearConfirm')}
        description={t('his.clearConfirmBody')}
        actionLabel={t('common.clear')}
        cancelLabel={t('common.cancel')}
        onAction={() => {
          clearHistory()
          setConfirmOpen(false)
        }}
      />
    </>
  )
}
