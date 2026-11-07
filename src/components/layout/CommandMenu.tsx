import {useMemo} from 'react'
import {useNavigate} from '@tanstack/react-router'
import {CommandPalette} from '@astryxdesign/core/CommandPalette'
import type {SearchableItem, SearchSource} from '@astryxdesign/core/Typeahead'
import {Text} from '@astryxdesign/core/Text'
import {Languages, Landmark, Moon, Wallet} from 'lucide-react'
import {NAV_ITEMS} from '#/app/nav'
import {useT} from '#/i18n'
import {BANKS, bankLogoUrl, getBankByBin} from '#/data/banks'
import {cycleMode, updateSettings, settingsStore} from '#/stores/settings'
import {useAccounts} from '#/stores/accounts'
import {foldForSearch} from '#/lib/text'

type Cmd = SearchableItem<{group: string; hint?: string; icon?: React.ReactNode; keywords: string; run: () => void}>

export function CommandMenu({isOpen, onOpenChange}: {isOpen: boolean; onOpenChange: (open: boolean) => void}) {
  const t = useT()
  const navigate = useNavigate()
  const accounts = useAccounts()

  const items = useMemo<Cmd[]>(() => {
    const pages: Cmd[] = NAV_ITEMS.map((item) => {
      const Icon = item.icon
      return {
        id: `page:${item.to}`,
        label: t(item.label),
        auxiliaryData: {
          group: t('cmd.pages'),
          icon: <Icon size={16} aria-hidden />,
          keywords: `${t(item.label)} ${item.keywords ?? ''}`,
          run: () => void navigate({to: item.to as never}),
        },
      }
    })
    const actions: Cmd[] = [
      {
        id: 'action:mode',
        label: t('cmd.toggleMode'),
        auxiliaryData: {group: t('cmd.actions'), icon: <Moon size={16} aria-hidden />, hint: 'Shift+D', keywords: 'dark light toi sang mode', run: () => cycleMode()},
      },
      {
        id: 'action:lang',
        label: t('cmd.switchLang'),
        auxiliaryData: {
          group: t('cmd.actions'),
          icon: <Languages size={16} aria-hidden />,
          keywords: 'language ngon ngu english tieng viet',
          run: () => updateSettings({locale: settingsStore.state.locale === 'vi' ? 'en' : 'vi'}),
        },
      },
    ]
    const accountItems: Cmd[] = accounts.map((a) => {
      const bank = getBankByBin(a.bin)
      return {
        id: `account:${a.id}`,
        label: a.nickname || a.accountName || a.accountNumber,
        auxiliaryData: {
          group: t('cmd.accounts'),
          hint: `${bank?.shortName ?? a.bin} · ${a.accountNumber}`,
          icon: <Wallet size={16} aria-hidden />,
          keywords: `${a.nickname} ${a.accountName} ${a.accountNumber} ${bank?.shortName ?? ''}`,
          run: () => void navigate({to: '/', search: {account: a.id}}),
        },
      }
    })
    const bankItems: Cmd[] = BANKS.map((b) => {
      const logo = bankLogoUrl(b)
      return {
        id: `bank:${b.bin}`,
        label: b.shortName,
        auxiliaryData: {
          group: t('cmd.banks'),
          hint: `${b.bin} · ${b.code}`,
          icon: logo ? <img src={logo} alt="" className="h-4 w-10 object-contain" /> : <Landmark size={16} aria-hidden />,
          keywords: `${b.shortName} ${b.name} ${b.code} ${b.bin}`,
          run: () => void navigate({to: '/', search: {bank: b.bin}}),
        },
      }
    })
    return [...pages, ...actions, ...accountItems, ...bankItems]
  }, [t, navigate, accounts])

  const source = useMemo<SearchSource<Cmd>>(() => {
    const index = items.map((i) => [i, foldForSearch(`${i.label} ${i.auxiliaryData?.keywords ?? ''}`)] as const)
    return {
      bootstrap: () => items.filter((i) => !i.id.startsWith('bank:')),
      search: (query) => {
        const q = foldForSearch(query)
        if (!q) return items.filter((i) => !i.id.startsWith('bank:'))
        const tokens = q.split(' ')
        return index.filter(([, hay]) => tokens.every((tok) => hay.includes(tok))).map(([i]) => i).slice(0, 40)
      },
    }
  }, [items])

  return (
    <CommandPalette
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      searchSource={source}
      label={t('app.search')}
      emptySearchText={t('cmd.empty')}
      onValueChange={(id) => {
        const item = items.find((i) => i.id === id)
        onOpenChange(false)
        item?.auxiliaryData?.run()
      }}
      renderItem={(item: Cmd) => (
        <span className="flex items-center gap-3 w-full min-w-0">
          <span className="text-secondary shrink-0 grid place-items-center w-10">{item.auxiliaryData?.icon}</span>
          <Text type="body" maxLines={1}>
            {item.label}
          </Text>
          {item.auxiliaryData?.hint && (
            <span className="ml-auto text-xs text-secondary qv-mono truncate">{item.auxiliaryData.hint}</span>
          )}
        </span>
      )}
    />
  )
}
