import {Plus} from 'lucide-react'
import {Link} from '@tanstack/react-router'
import {getBankByBin} from '#/data/banks'
import {useAccounts, type SavedAccount} from '#/stores/accounts'
import {useT} from '#/i18n'
import {BankLogo} from '#/components/bank/bank-logo'

/** One-tap switch between saved accounts. */
export function SavedAccountsStrip({
  activeKey,
  onPick,
}: {
  activeKey: string
  onPick: (a: SavedAccount) => void
}) {
  const t = useT()
  const accounts = useAccounts()
  if (!accounts.length) return null
  const sorted = [...accounts].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault) || (b.usedAt ?? 0) - (a.usedAt ?? 0),
  )
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{t('gen.pickSaved')}</span>
      <div className="-mx-1 flex snap-x scrollbar-none gap-2 overflow-x-auto px-1 pb-1">
        {sorted.map((a) => {
          const bank = getBankByBin(a.bin)
          const active = activeKey === `${a.bin}:${a.accountNumber}`
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onPick(a)}
              aria-pressed={active}
              className="qv-tile flex max-w-60 shrink-0 snap-start items-center gap-2 py-2 pr-3 pl-2 text-left"
            >
              <span
                className="w-1 self-stretch rounded-full"
                style={{background: a.color}}
                aria-hidden
              />
              <BankLogo bank={bank} size={26} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {a.nickname || a.accountName || bank?.shortName}
                </span>
                <span className="qv-mono block truncate text-xs text-secondary">
                  {a.accountNumber}
                </span>
              </span>
            </button>
          )
        })}
        <Link
          to="/accounts"
          className="qv-tile grid shrink-0 place-items-center px-3 text-secondary"
          aria-label={t('acc.add')}
          title={t('acc.add')}
        >
          <Plus size={18} aria-hidden />
        </Link>
      </div>
    </div>
  )
}
