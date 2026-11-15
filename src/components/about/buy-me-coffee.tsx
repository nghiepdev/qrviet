import {useState, type ComponentType} from 'react'
import {Banknote, Code2, Coffee, CupSoda, ExternalLink, GlassWater, Heart, Sandwich, Volume2} from 'lucide-react'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {IconButton} from '@astryxdesign/core/IconButton'
import {TextInput} from '@astryxdesign/core/TextInput'
import {BankLogo} from '#/components/bank/bank-logo'
import {CopyField} from '#/components/common/copy-field'
import {HUES, type Hue} from '#/components/common/icon-badge'
import {Panel} from '#/components/common/page-header'
import {PaySheet, usePaySheet} from '#/components/pay/pay-sheet'
import {ExportActions} from '#/components/qr/export-actions'
import {QrStage} from '#/components/qr/qr-stage'
import {resolveLogo, useQrScene} from '#/components/qr/use-qr-scene'
import {speakAmount} from '#/components/vietqr/amount-field'
import {buildTemplateInfo} from '#/components/vietqr/template-info'
import {getBankByBin} from '#/data/banks'
import {useCopy} from '#/hooks/use-copy'
import {useLocale, useT, type MessageKey} from '#/i18n'
import {amountToWords, formatVnd, parseAmount, shortAmount} from '#/lib/money'
import {payLinkUrl} from '#/lib/paylink'
import {DEFAULT_QR_STYLE} from '#/lib/qr/render'
import {AMOUNT_MAX_DIGITS, buildVietQr, normalizeAmount} from '#/lib/vietqr'
import {DEFAULT_DESIGN} from '#/stores/settings'

const SUPPORT_ACCOUNT = {
  bin: '970415', // VietinBank
  accountNumber: '100883847134',
  accountName: 'NGUYEN THI NGAN',
} as const

const CUSTOM_AMOUNT_MAX = 10_000_000
const SUPPORT_QR_STYLE = {...DEFAULT_QR_STYLE, ecc: 'M' as const}

type IconComponent = ComponentType<{size?: number; className?: string; 'aria-hidden'?: boolean}>

/** Lucide-styled drooling face icon for the "fasting" breakfast option. */
function DroolingFace({size = 24, className, 'aria-hidden': ariaHidden}: {size?: number; className?: string; 'aria-hidden'?: boolean}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 9.5c.6-.8 1.6-.8 2.2 0" />
      <path d="M13.8 9.5c.6-.8 1.6-.8 2.2 0" />
      <path d="M8.5 14c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2" />
      <path d="M13.8 15.6v2.7a1.1 1.1 0 0 0 2.2 0v-4" />
    </svg>
  )
}

/** Sunny-side-up fried egg icon with white albumen and golden yolk. */
function FriedEggIcon({size = 24, className, 'aria-hidden': ariaHidden}: {size?: number; className?: string; 'aria-hidden'?: boolean}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}>
      <path
        d="M12 3C8.5 3 6.2 4.8 5 7.5c-1.1 2.4-2.5 4.2-2.2 7 .3 3 2.8 5.8 6 6.3 2.2.4 4.1-.2 6-.8 2.8-.9 5.9-2.2 6.2-5.6.2-2.4-1.4-4.2-2.5-6.2C17.2 5.7 15.2 3 12 3Z"
        fill="#fffbeb"
      />
      <circle cx="11.8" cy="12.2" r="4.2" fill="#fbbf24" strokeWidth={1.8} />
      <path d="M10.1 11.2a2 2 0 0 1 1.8-1.2" stroke="#ffffff" strokeWidth={1.6} />
    </svg>
  )
}

type DrinkId = 'blackCoffee' | 'milkCoffee' | 'milkTea' | 'icedTea' | 'custom'
type BreakfastId = 'fasting' | 'bread' | 'breadEgg'

interface DrinkOption {
  id: DrinkId
  labelKey: MessageKey
  asciiLabel: string
  amount: number | null
  icon: IconComponent
  hue: Hue
}

interface BreakfastOption {
  id: BreakfastId
  labelKey: MessageKey
  asciiLabel: string
  amount: number
  icon: IconComponent
  hue: Hue
}

const DRINKS: readonly DrinkOption[] = [
  {id: 'blackCoffee', labelKey: 'support.drink.blackCoffee', asciiLabel: 'Ca phe den', amount: 12_000, icon: Coffee, hue: 'amber'},
  {id: 'milkCoffee', labelKey: 'support.drink.milkCoffee', asciiLabel: 'Ca phe sua', amount: 15_000, icon: Coffee, hue: 'orange'},
  {id: 'milkTea', labelKey: 'support.drink.milkTea', asciiLabel: 'Tra sua', amount: 25_000, icon: CupSoda, hue: 'pink'},
  {id: 'icedTea', labelKey: 'support.drink.icedTea', asciiLabel: 'Tra da', amount: 5_000, icon: GlassWater, hue: 'cyan'},
  {id: 'custom', labelKey: 'support.drink.custom', asciiLabel: 'Tuy tam', amount: null, icon: Heart, hue: 'red'},
]

const BREAKFASTS: readonly BreakfastOption[] = [
  {id: 'fasting', labelKey: 'support.breakfast.fasting', asciiLabel: '', amount: 0, icon: DroolingFace, hue: 'slate'},
  {id: 'bread', labelKey: 'support.breakfast.bread', asciiLabel: 'Banh mi', amount: 15_000, icon: Sandwich, hue: 'amber'},
  {id: 'breadEgg', labelKey: 'support.breakfast.breadEgg', asciiLabel: 'Banh mi op la', amount: 25_000, icon: FriedEggIcon, hue: 'orange'},
]

function buildSupportPurpose(drink: DrinkOption, breakfast: BreakfastOption): string {
  const parts = [drink.asciiLabel, breakfast.asciiLabel].filter(Boolean)
  return `Moi ${parts.join(' + ')}`
}

function buildSupportPayload(amount: number, purpose: string): string | null {
  try {
    return buildVietQr({
      bin: SUPPORT_ACCOUNT.bin,
      accountNumber: SUPPORT_ACCOUNT.accountNumber,
      amount: amount > 0 ? amount : undefined,
      purpose,
    })
  } catch {
    return null
  }
}

export function BuyMeCoffee() {
  const t = useT()
  const locale = useLocale()
  const copy = useCopy()
  const paySheet = usePaySheet()

  const [drinkId, setDrinkId] = useState<DrinkId>('milkCoffee')
  const [breakfastId, setBreakfastId] = useState<BreakfastId>('fasting')
  const [customText, setCustomText] = useState('')

  const drink = DRINKS.find((d) => d.id === drinkId) ?? DRINKS[1]
  const breakfast = BREAKFASTS.find((b) => b.id === breakfastId) ?? BREAKFASTS[0]

  const trimmedCustom = customText.trim()
  const customParsed = drink.id === 'custom' && trimmedCustom ? parseAmount(trimmedCustom) : null
  let customError: MessageKey | undefined
  if (drink.id === 'custom' && trimmedCustom) {
    if (customParsed === null) customError = 'gen.invalid.amount'
    else if (customParsed > CUSTOM_AMOUNT_MAX) customError = 'support.tooMuch'
    else if (normalizeAmount(customParsed).length > AMOUNT_MAX_DIGITS) customError = 'gen.invalid.amountLarge'
  }

  const drinkAmount = drink.id === 'custom' ? (customError ? 0 : (customParsed ?? 0)) : (drink.amount ?? 0)
  const totalAmount = customError ? 0 : drinkAmount + breakfast.amount
  const purpose = buildSupportPurpose(drink, breakfast)

  const bank = getBankByBin(SUPPORT_ACCOUNT.bin)
  const payload = customError ? null : buildSupportPayload(totalAmount, purpose)
  const info = payload
    ? buildTemplateInfo({
        bank,
        accountName: SUPPORT_ACCOUNT.accountName,
        accountNumber: SUPPORT_ACCOUNT.accountNumber,
        amount: totalAmount > 0 ? totalAmount : null,
        purpose,
        design: DEFAULT_DESIGN,
        locale,
        t,
      })
    : null
  const {scene} = useQrScene(payload, 'compact', info, SUPPORT_QR_STYLE, resolveLogo(DEFAULT_DESIGN, bank))

  const words = totalAmount > 0 ? amountToWords(totalAmount, locale) : ''
  const canSpeak = totalAmount > 0 && typeof speechSynthesis !== 'undefined'

  const openPayPage = () => {
    if (!payload) return
    const url = payLinkUrl({
      bin: SUPPORT_ACCOUNT.bin,
      acc: SUPPORT_ACCOUNT.accountNumber,
      name: SUPPORT_ACCOUNT.accountName,
      amount: totalAmount > 0 ? totalAmount : undefined,
      memo: purpose,
      accent: DEFAULT_DESIGN.accent,
    })
    paySheet.open(url)
  }

  return (
    <>
      <Panel id="buy-me-a-coffee" title={t('support.title')} description={t('support.subtitle')} icon={Coffee} hue="amber">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t('support.drinks')}</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('support.drinks')}>
              {DRINKS.map((item) => {
                const Icon = item.icon
                const selected = item.id === drinkId
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDrinkId(item.id)}
                    className={`${HUES[item.hue]} qv-tile qv-tile-hue flex items-center gap-2.5 px-3 py-2.5 text-left`}>
                    <Icon size={18} className="shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t(item.labelKey)}</span>
                      <span className="qv-num block text-xs text-secondary">
                        {item.amount !== null ? shortAmount(item.amount, locale) : '…'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {drinkId === 'custom' && (
            <TextInput
              label={t('support.customAmount')}
              value={customText}
              onChange={setCustomText}
              placeholder={t('support.customPlaceholder')}
              description={t('support.customHint')}
              startIcon={Banknote}
              inputMode="text"
              enterKeyHint="done"
              autoComplete="off"
              isOptional
              hasClear
              status={customError ? {type: 'error', message: t(customError)} : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customParsed && !customError) setCustomText(formatVnd(customParsed))
              }}
              controlStyle={{fontVariantNumeric: 'tabular-nums'}}
            />
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t('support.breakfast')}</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('support.breakfast')}>
              {BREAKFASTS.map((item) => {
                const Icon = item.icon
                const selected = item.id === breakfastId
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setBreakfastId(item.id)}
                    className={`${HUES[item.hue]} qv-tile qv-tile-hue flex items-center gap-2.5 px-3 py-2.5 text-left`}>
                    <Icon size={18} className="shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t(item.labelKey)}</span>
                      <span className="qv-num block text-xs text-secondary">
                        {item.amount > 0 ? `+${shortAmount(item.amount, locale)}` : '0k'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-accent-muted/40 px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-secondary">{t('support.total')}</div>
              <div className="qv-num text-xl font-extrabold text-accent leading-tight">
                {totalAmount > 0 ? formatVnd(totalAmount, true) : t('support.anyAmount')}
              </div>
              {words && <div className="text-xs text-secondary italic mt-0.5">{words}</div>}
            </div>
            {canSpeak && (
              <IconButton label={t('gen.speak')} icon={<Volume2 size={16} />} size="sm" variant="ghost" onClick={() => speakAmount(words, locale)} />
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface/80 p-4">
            {bank && (
              <div className="mb-2 flex items-center gap-3">
                <BankLogo bank={bank} size={36} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{bank.shortName}</div>
                  <div className="truncate text-xs text-secondary">{bank.name}</div>
                </div>
              </div>
            )}
            <CopyField label={t('pay.to')} value={SUPPORT_ACCOUNT.accountName} />
            <CopyField label={t('gen.account')} value={SUPPORT_ACCOUNT.accountNumber} mono />
            {totalAmount > 0 && <CopyField label={t('pay.amount')} value={String(totalAmount)} display={formatVnd(totalAmount, true)} emphasize />}
            <CopyField label={t('pay.purpose')} value={purpose} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <QrStage
            scene={scene}
            label={`VietQR ${bank?.shortName ?? 'VietinBank'} ${SUPPORT_ACCOUNT.accountNumber}`}
            maxWidth={340}
            empty={
              <EmptyState
                icon={<Coffee size={36} aria-hidden />}
                title={customError === 'support.tooMuch' ? t('support.tooMuch') : t('support.invalidHint')}
                isCompact
              />
            }
          />
          <ExportActions
            scene={scene}
            filename={`qrviet-coffee-${totalAmount > 0 ? totalAmount : 'custom'}`}
            shareText={totalAmount > 0 ? `${t('support.title')} · ${formatVnd(totalAmount, true)}` : t('support.title')}
            side={{label: t('support.openPay'), icon: <ExternalLink size={16} />, isDisabled: !payload, onClick: openPayPage}}
            menuItems={[
              {
                id: 'payload',
                label: t('gen.copyVietQr'),
                icon: <Code2 size={16} />,
                isDisabled: !payload,
                onClick: () => {
                  if (payload) void copy(payload)
                },
              },
            ]}
          />
        </div>
      </div>
      </Panel>
      <PaySheet {...paySheet.sheetProps} />
    </>
  )
}
