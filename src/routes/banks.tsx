import {useState} from 'react'
import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {Copy, Landmark, QrCode, Search, Star} from 'lucide-react'
import {Badge} from '@astryxdesign/core/Badge'
import {Button} from '@astryxdesign/core/Button'
import {IconButton} from '@astryxdesign/core/IconButton'
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl'
import {Switch} from '@astryxdesign/core/Switch'
import {TextInput} from '@astryxdesign/core/TextInput'
import {PageBody, PageHeader} from '#/components/common/page-header'
import {BankLogo} from '#/components/bank/bank-logo'
import {BankDeeplinkBadge} from '#/components/bank/bank-deeplink-badge'
import {BANKS, hasBankDeeplink, hasBankQrHandoff, searchBanks} from '#/data/banks'
import {toggleFavoriteBank, useSettings} from '#/stores/settings'
import {useCopy} from '#/hooks/use-copy'
import {useT} from '#/i18n'
import {pageHead} from '#/seo/head'

export const Route = createFileRoute('/banks')({
  head: () => pageHead('banks'),
  component: BanksPage,
})

type AppFilter = 'all' | 'deeplink' | 'autofill'

function BanksPage() {
  const t = useT()
  const copy = useCopy()
  const navigate = useNavigate()
  const favorites = useSettings((s) => s.favoriteBins)
  const [query, setQuery] = useState('')
  const [napasOnly, setNapasOnly] = useState(false)
  const [appFilter, setAppFilter] = useState<AppFilter>('all')

  const base = BANKS.filter((b) => {
    if (napasOnly && !b.transfer) return false
    if (appFilter === 'deeplink' && !hasBankDeeplink(b)) return false
    if (appFilter === 'autofill' && !hasBankQrHandoff(b)) return false
    return true
  })
  const found = query.trim()
    ? searchBanks(query, base)
    : [...base].sort(
        (a, b) => Number(b.transfer) - Number(a.transfer) || a.shortName.localeCompare(b.shortName),
      )
  const list = [...found].sort(
    (a, b) => Number(favorites.includes(b.bin)) - Number(favorites.includes(a.bin)),
  )

  return (
    <>
      <PageHeader
        title={t('bank.directoryTitle')}
        subtitle={t('bank.directorySubtitle', {count: BANKS.length})}
        icon={<Landmark size={22} />}
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <TextInput
                type="search"
                label={t('bank.search')}
                isLabelHidden
                value={query}
                onChange={setQuery}
                placeholder={t('bank.search')}
                startIcon={Search}
                hasClear
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="scrollbar-none overflow-x-auto">
                <SegmentedControl
                  label={t('bank.filterDeeplink')}
                  size="sm"
                  value={appFilter}
                  onChange={(v) => setAppFilter(v as AppFilter)}
                >
                  <SegmentedControlItem value="all" label={t('bank.filterAll')} />
                  <SegmentedControlItem value="deeplink" label={t('bank.filterDeeplink')} />
                  <SegmentedControlItem value="autofill" label={t('bank.filterAutofill')} />
                </SegmentedControl>
              </div>
              <Switch
                label={t('bank.filterNapas')}
                value={napasOnly}
                onChange={setNapasOnly}
                size="sm"
              />
            </div>
          </div>
          <div className="flex flex-col justify-between gap-1 text-sm text-secondary sm:flex-row sm:items-center">
            <p>{t('bank.count', {count: list.length})}</p>
            <p className="text-xs">{t('bank.tagLegend')}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((b) => {
              const fav = favorites.includes(b.bin)
              return (
                <li
                  key={b.bin}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <BankLogo bank={b} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{b.shortName}</div>
                      <div className="line-clamp-2 text-xs text-secondary">{b.name}</div>
                    </div>
                    <IconButton
                      label={fav ? t('bank.unfavorite') : t('bank.favorite')}
                      icon={
                        <Star
                          size={16}
                          fill={fav ? '#ffc93c' : 'none'}
                          stroke={fav ? '#d4a017' : 'currentColor'}
                        />
                      }
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
                      <dd className="qv-mono truncate font-semibold">{b.code}</dd>
                    </div>
                    <div>
                      <dt className="text-secondary">{t('bank.swift')}</dt>
                      <dd className="qv-mono truncate font-semibold">{b.swift ?? '—'}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5">
                    {b.transfer ? (
                      <Badge variant="success" label={t('bank.napas')} />
                    ) : (
                      <Badge variant="neutral" label={t('bank.napasNo')} />
                    )}
                    <BankDeeplinkBadge bank={b} />
                    <span className="ml-auto flex gap-1">
                      <IconButton
                        label={t('bank.copyBin')}
                        icon={<Copy size={15} />}
                        variant="ghost"
                        size="sm"
                        onClick={() => void copy(b.bin, `${t('common.copied')}: ${b.bin}`)}
                      />
                      <Button
                        label={t('acc.createQr')}
                        icon={<QrCode size={15} />}
                        size="sm"
                        onClick={() => void navigate({to: '/', search: {bank: b.bin}})}
                      />
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
