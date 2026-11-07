import {useMemo, useState} from 'react'
import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {Copy, Landmark, QrCode, Search, Star} from 'lucide-react'
import {Badge} from '@astryxdesign/core/Badge'
import {Button} from '@astryxdesign/core/Button'
import {IconButton} from '@astryxdesign/core/IconButton'
import {Switch} from '@astryxdesign/core/Switch'
import {TextInput} from '@astryxdesign/core/TextInput'
import {PageBody, PageHeader} from '#/components/common/PageHeader'
import {BankLogo} from '#/components/bank/BankLogo'
import {BANKS, searchBanks} from '#/data/banks'
import {toggleFavoriteBank, useSettings} from '#/stores/settings'
import {useCopy} from '#/hooks/useCopy'
import {useT} from '#/i18n'

export const Route = createFileRoute('/banks')({component: BanksPage})

function BanksPage() {
  const t = useT()
  const copy = useCopy()
  const navigate = useNavigate()
  const favorites = useSettings((s) => s.favoriteBins)
  const [query, setQuery] = useState('')
  const [napasOnly, setNapasOnly] = useState(false)

  const list = useMemo(() => {
    const base = napasOnly ? BANKS.filter((b) => b.transfer) : BANKS
    const found = query.trim() ? searchBanks(query, base) : [...base].sort((a, b) => Number(b.transfer) - Number(a.transfer) || a.shortName.localeCompare(b.shortName))
    return [...found].sort((a, b) => Number(favorites.includes(b.bin)) - Number(favorites.includes(a.bin)))
  }, [query, napasOnly, favorites])

  return (
    <>
      <PageHeader title={t('bank.directoryTitle')} subtitle={t('bank.directorySubtitle', {count: BANKS.length})} icon={<Landmark size={22} />} />
      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex-1">
              <TextInput type="search" label={t('bank.search')} isLabelHidden value={query} onChange={setQuery} placeholder={t('bank.search')} startIcon={Search} hasClear />
            </div>
            <Switch label={t('bank.filterNapas')} value={napasOnly} onChange={setNapasOnly} size="sm" />
          </div>
          <p className="text-sm text-secondary">{t('bank.count', {count: list.length})}</p>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((b) => {
              const fav = favorites.includes(b.bin)
              return (
                <li key={b.bin} className="rounded-xl border border-border bg-surface p-3 shadow-sm flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <BankLogo bank={b} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate">{b.shortName}</div>
                      <div className="text-xs text-secondary line-clamp-2">{b.name}</div>
                    </div>
                    <IconButton
                      label={fav ? t('bank.unfavorite') : t('bank.favorite')}
                      icon={<Star size={16} fill={fav ? '#ffc93c' : 'none'} stroke={fav ? '#d4a017' : 'currentColor'} />}
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFavoriteBank(b.bin)}
                    />
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-secondary">{t('bank.bin')}</dt>
                      <dd className="qv-mono font-semibold">{b.bin}</dd>
                    </div>
                    <div>
                      <dt className="text-secondary">{t('bank.code')}</dt>
                      <dd className="qv-mono font-semibold truncate">{b.code}</dd>
                    </div>
                    <div>
                      <dt className="text-secondary">{t('bank.swift')}</dt>
                      <dd className="qv-mono font-semibold truncate">{b.swift ?? '—'}</dd>
                    </div>
                  </dl>
                  <div className="flex items-center gap-2 mt-auto">
                    {b.transfer ? <Badge variant="success" label={t('bank.napas')} /> : <Badge variant="neutral" label={t('bank.napasNo')} />}
                    <span className="ml-auto flex gap-1">
                      <IconButton label={t('bank.copyBin')} icon={<Copy size={15} />} variant="ghost" size="sm" onClick={() => void copy(b.bin, `${t('common.copied')}: ${b.bin}`)} />
                      <Button label={t('acc.createQr')} icon={<QrCode size={15} />} size="sm" onClick={() => void navigate({to: '/', search: {bank: b.bin}})} />
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </PageBody>
    </>
  )
}
