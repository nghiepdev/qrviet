import {useMemo, useState} from 'react'
import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {Copy, History as HistoryIcon, MoreHorizontal, Pin, PinOff, ScanLine, Search, Shapes, Trash2, QrCode} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {AlertDialog} from '@astryxdesign/core/AlertDialog'
import {DropdownMenu} from '@astryxdesign/core/DropdownMenu'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl'
import {Switch} from '@astryxdesign/core/Switch'
import {TextInput} from '@astryxdesign/core/TextInput'
import {useToast} from '@astryxdesign/core/Toast'
import {PageBody, PageHeader} from '#/components/common/PageHeader'
import {BankLogo} from '#/components/bank/BankLogo'
import {clearHistory, removeHistory, restoreHistory, togglePin, useHistory, type HistoryItem} from '#/stores/history'
import {updateSettings, useSettings} from '#/stores/settings'
import {getBankByBin} from '#/data/banks'
import {DEFAULT_QR_STYLE, layoutQr, makeQr, qrToSvg} from '#/lib/qr/render'
import {matchesQuery} from '#/lib/text'
import {looksLikeEmv, parseEmvQr} from '#/lib/vietqr'
import {formatRelative, useLocale, useT} from '#/i18n'
import {useCopy} from '#/hooks/useCopy'

export const Route = createFileRoute('/history')({component: HistoryPage})

const PAGE = 40

function Thumb({payload}: {payload: string}) {
  const svg = useMemo(() => {
    try {
      const style = {...DEFAULT_QR_STYLE, margin: 1}
      return qrToSvg(layoutQr(makeQr(payload, 'L'), style), 56, {style})
    } catch {
      return ''
    }
  }, [payload])
  return <span className="block size-14 shrink-0 rounded-md overflow-hidden border border-border bg-white" aria-hidden dangerouslySetInnerHTML={{__html: svg}} />
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

  const filtered = useMemo(
    () =>
      items
        .filter((h) => filter === 'all' || h.kind === filter)
        .filter((h) => matchesQuery(`${h.title} ${h.subtitle} ${h.meta.accountNumber ?? ''} ${h.meta.purpose ?? ''} ${h.payload}`, query))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt),
    [items, filter, query],
  )

  const open = (h: HistoryItem) => {
    if ((h.kind === 'vietqr' || h.kind === 'scan') && looksLikeEmv(h.payload)) {
      try {
        const p = parseEmvQr(h.payload)
        if (p.kind === 'vietqr') {
          void navigate({
            to: '/',
            search: {bank: p.bin, acc: p.accountNumber, name: h.meta.accountName || p.merchantName || undefined, amount: p.amount || undefined, memo: p.purpose || undefined, card: p.service === 'card' ? true : undefined},
          })
          return
        }
      } catch {
        /* fall through */
      }
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
            <SegmentedControl label={t('his.filter.all')} value={filter} onChange={(v) => setFilter(v as typeof filter)} size="sm">
              <SegmentedControlItem value="all" label={t('his.filter.all')} />
              <SegmentedControlItem value="vietqr" label={t('his.filter.vietqr')} />
              <SegmentedControlItem value="qr" label={t('his.filter.qr')} />
              <SegmentedControlItem value="scan" label={t('his.filter.scan')} />
            </SegmentedControl>
          </div>
          <Switch label={t('his.autoSave')} value={autoSave} onChange={(autoSaveHistory) => updateSettings({autoSaveHistory})} size="sm" />

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-6">
              <EmptyState icon={<HistoryIcon size={40} aria-hidden />} title={t('his.empty')} description={t('his.emptyBody')} actions={<Button label={t('nav.create')} variant="primary" href="/" />} />
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.slice(0, limit).map((h) => {
                const bank = getBankByBin(h.meta.bin)
                const KindIcon = h.kind === 'scan' ? ScanLine : h.kind === 'qr' ? Shapes : QrCode
                return (
                  <li key={h.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5 pr-2 shadow-sm">
                    <button type="button" className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => open(h)} aria-label={`${t('his.open')}: ${h.title}`}>
                      <Thumb payload={h.payload} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <KindIcon size={14} className="text-secondary shrink-0" aria-hidden />
                          <span className="font-semibold truncate">{h.title || '—'}</span>
                          {h.pinned && <Pin size={13} className="text-accent shrink-0" aria-label={t('his.pin')} />}
                        </span>
                        <span className="block text-sm text-secondary truncate">{h.subtitle}</span>
                        <span className="block text-xs text-secondary">{formatRelative(h.createdAt, locale)}</span>
                      </span>
                      {bank && <BankLogo bank={bank} size={28} className="hidden sm:inline-grid" />}
                    </button>
                    <DropdownMenu
                      button={{label: t('common.more'), isIconOnly: true, icon: <MoreHorizontal size={16} />, variant: 'ghost', size: 'sm'}}
                      hasChevron={false}
                      items={[
                        {label: t('his.open'), icon: <QrCode size={15} />, onClick: () => open(h)},
                        {label: t('common.copy'), icon: <Copy size={15} />, onClick: () => void copy(h.payload)},
                        {label: h.pinned ? t('his.unpin') : t('his.pin'), icon: h.pinned ? <PinOff size={15} /> : <Pin size={15} />, onClick: () => togglePin(h.id)},
                        {type: 'divider' as const},
                        {label: t('common.delete'), icon: <Trash2 size={15} />, variant: 'destructive' as const, onClick: () => remove(h)},
                      ]}
                    />
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
