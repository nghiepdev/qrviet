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
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1 snap-x">
        {sorted.map((a) => {
          const bank = getBankByBin(a.bin)
          const active = activeKey === `${a.bin}:${a.accountNumber}`
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onPick(a)}
              aria-pressed={active}
              className="qv-tile snap-start shrink-0 flex items-center gap-2 pl-2 pr-3 py-2 text-left max-w-60"
            >
              <span
                className="w-1 self-stretch rounded-full"
                style={{background: a.color}}
                aria-hidden
              />
              <BankLogo bank={bank} size={26} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">
                  {a.nickname || a.accountName || bank?.shortName}
                </span>
                <span className="block text-xs text-secondary qv-mono truncate">
                  {a.accountNumber}
                </span>
              </span>
            </button>
          )
        })}
        <Link
          to="/accounts"
          className="qv-tile shrink-0 grid place-items-center px-3 text-secondary"
          aria-label={t('acc.add')}
          title={t('acc.add')}
        >
          <Plus size={18} aria-hidden />
        </Link>
      </div>
    </div>
  )
}
