import {useId, useState} from 'react'
import {Check, ChevronDown, Search, Star} from 'lucide-react'
import {TextInput} from '@astryxdesign/core/TextInput'
import {Text} from '@astryxdesign/core/Text'
import {Badge} from '@astryxdesign/core/Badge'
import {AdaptiveSheet, useIsTouchSheet} from '#/components/common/adaptive-sheet'
import {BankLogo} from './bank-logo'
import {BANKS, POPULAR_BINS, getBankByBin, searchBanks, type Bank} from '#/data/banks'
import {useT, type TFunction} from '#/i18n'
import {pushRecentBank, toggleFavoriteBank, useSettings} from '#/stores/settings'

interface Props {
  value: string
  onChange: (bin: string) => void
  label?: string
  error?: string
  isRequired?: boolean
}

export function BankPicker({value, onChange, label, error, isRequired}: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  // The sheet mounts on first open and stays mounted while closed, so it can animate out (and
  // return focus to this trigger itself). A new key per open starts the search from scratch.
  const [sheetKey, setSheetKey] = useState(0)
  const bank = getBankByBin(value)
  const id = `bank-${useId()}`

  const openSheet = () => {
    setSheetKey((k) => k + 1)
    setOpen(true)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-primary">
        {label ?? t('bank.label')}
        {isRequired && <span className="text-error ml-0.5" aria-hidden>*</span>}
      </label>
      <button
        id={id}
        type="button"
        onClick={openSheet}
        aria-haspopup="dialog"
        aria-invalid={error ? true : undefined}
        className={`group flex items-center gap-3 w-full min-h-14 px-3 py-2 rounded-md border bg-surface text-left transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 ${
          error ? 'border-error' : 'border-border'
        }`}>
        {bank ? (
          <>
            <BankLogo bank={bank} size={36} />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold truncate">{bank.shortName}</span>
              <span className="block text-xs text-secondary truncate">{bank.name}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-secondary">{t('bank.placeholder')}</span>
        )}
        <ChevronDown size={18} className="text-secondary shrink-0 transition-transform group-hover:translate-y-0.5" aria-hidden />
      </button>
      {error && <span className="text-xs text-error">{error}</span>}
      {sheetKey > 0 && (
        <BankSheet
          key={sheetKey}
          value={value}
          isOpen={open}
          onOpenChange={setOpen}
          onSelect={(b) => {
            onChange(b.bin)
            pushRecentBank(b.bin)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

/** Favourites, recents, popular, then every bank — or a flat search result. */
function bankSections(query: string, favorites: string[], recent: string[], t: TFunction) {
  if (query.trim()) return [{title: t('bank.all'), banks: searchBanks(query)}]
  const pick = (bins: string[]) => bins.map((b) => getBankByBin(b)).filter((b): b is Bank => Boolean(b))
  const out: Array<{title: string; banks: Bank[]}> = []
  const fav = pick(favorites)
  if (fav.length) out.push({title: t('bank.favorites'), banks: fav})
  const rec = pick(recent).filter((b) => !favorites.includes(b.bin))
  if (rec.length) out.push({title: t('bank.recent'), banks: rec})
  out.push({title: t('bank.popular'), banks: pick(POPULAR_BINS)})
  out.push({
    title: t('bank.all'),
    banks: [...BANKS].sort((a, b) => Number(b.transfer) - Number(a.transfer) || a.shortName.localeCompare(b.shortName)),
  })
  return out
}

function BankSheet({value, isOpen, onOpenChange, onSelect}: {value: string; isOpen: boolean; onOpenChange: (open: boolean) => void; onSelect: (b: Bank) => void}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const favorites = useSettings((s) => s.favoriteBins)
  const recent = useSettings((s) => s.recentBins)
  const touch = useIsTouchSheet()

  const sections = bankSections(query, favorites, recent, t)

  const first = sections[0]?.banks[0]

  return (
    <AdaptiveSheet isOpen={isOpen} onOpenChange={onOpenChange} title={t('bank.placeholder')} subtitle={t('bank.count', {count: BANKS.length})} width={560}>
      <div className="flex flex-col gap-3">
        {/*
          Phones: the sheet itself scrolls (one scroll area, so swipe-to-close keeps working) and search
          stays pinned. No z-index: the rows paint under it and the sheet's grabber (z-index 1) stays on
          top, inside the 16px of padding the negative margin cancels while the search is not stuck.
        */}
        <div className={touch ? 'sticky top-0 -mt-4 pt-4 -mx-1 px-1 pb-1 bg-surface' : undefined}>
          <TextInput
            type="search"
            label={t('bank.search')}
            isLabelHidden
            value={query}
            onChange={setQuery}
            placeholder={t('bank.search')}
            startIcon={Search}
            hasClear
            hasAutoFocus={!touch}
            enterKeyHint="search"
            autoComplete="off"
            onEnter={() => first && onSelect(first)}
          />
        </div>
        <div className={`flex flex-col gap-4 -mx-1 px-1 pb-2 ${touch ? '' : 'max-h-[60dvh] overflow-y-auto overflow-x-hidden'}`} role="list">
          {sections.map((section) =>
            section.banks.length ? (
              <section key={section.title} aria-label={section.title} className="min-w-0">
                <Text type="supporting" color="secondary" weight="semibold">
                  {section.title}
                </Text>
                <ul className="mt-1.5 grid grid-cols-1 gap-1">
                  {section.banks.map((b) => (
                    <BankRow key={`${section.title}-${b.bin}`} bank={b} selected={b.bin === value} favorite={favorites.includes(b.bin)} onSelect={onSelect} />
                  ))}
                </ul>
              </section>
            ) : null,
          )}
          {sections.every((s) => !s.banks.length) && (
            <div className="py-10 text-center text-secondary">{t('bank.noResults')}</div>
          )}
        </div>
      </div>
    </AdaptiveSheet>
  )
}

function BankRow({bank, selected, favorite, onSelect}: {bank: Bank; selected: boolean; favorite: boolean; onSelect: (b: Bank) => void}) {
  const t = useT()
  return (
    <li className="flex items-center gap-1 min-w-0">
      <button
        type="button"
        onClick={() => onSelect(bank)}
        aria-pressed={selected}
        className={`flex-1 min-w-0 flex items-center gap-3 p-2 rounded-md text-left transition-colors hover:bg-(--color-overlay-hover) ${
          selected ? 'bg-accent-muted' : ''
        }`}>
        <BankLogo bank={bank} size={34} />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-semibold truncate">{bank.shortName}</span>
            {!bank.transfer && <Badge variant="neutral" label={t('bank.napasNo')} />}
          </span>
          <span className="block text-xs text-secondary leading-snug wrap-break-word">{bank.name}</span>
        </span>
        <span className="text-xs text-secondary qv-mono shrink-0">{bank.bin}</span>
        {selected && <Check size={18} className="text-accent shrink-0" aria-hidden />}
      </button>
      <button
        type="button"
        onClick={() => toggleFavoriteBank(bank.bin)}
        aria-label={favorite ? t('bank.unfavorite') : t('bank.favorite')}
        aria-pressed={favorite}
        className="shrink-0 p-2 rounded-md text-secondary hover:bg-(--color-overlay-hover)">
        <Star size={16} fill={favorite ? '#ffc93c' : 'none'} stroke={favorite ? '#d4a017' : 'currentColor'} aria-hidden />
      </button>
    </li>
  )
}
