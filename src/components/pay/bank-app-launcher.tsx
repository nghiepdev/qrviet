import {useEffect, useRef, useState} from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  RotateCcw,
  Smartphone,
  Store,
} from 'lucide-react'
import {Banner} from '@astryxdesign/core/Banner'
import {Button} from '@astryxdesign/core/Button'
import {Heading} from '@astryxdesign/core/Heading'
import {useToast} from '@astryxdesign/core/Toast'
import {BankDeeplinkBadge} from '#/components/bank/bank-deeplink-badge'
import {BankLogo} from '#/components/bank/bank-logo'
import {BankSheet} from '#/components/bank/bank-picker'
import {HUES, IconBadge} from '#/components/common/icon-badge'
import {DEEPLINK_BANKS, getBankByBin, hasBankDeeplink, type Bank} from '#/data/banks'
import {useCopy} from '#/hooks/use-copy'
import {useT} from '#/i18n'
import {
  buildBankLaunchPlan,
  detectInAppBrowser,
  detectPlatform,
  launchNativeApp,
  type BankLaunchPayment,
  type InAppBrowserInfo,
  type InAppBrowserKind,
  type LaunchStatus,
  type Platform,
} from '#/lib/deeplink'
import {setPreferredBankApp, useSettings} from '#/stores/settings'

const QUICK_APP_BINS = [
  '970422', // MBBank
  '971025', // MoMo
  '971101', // ZaloPay
  '970418', // BIDV
  '970423', // TPBank
  '970448', // OCB
  '546034', // CAKE
  '970436', // Vietcombank
]

const IAB_NAMES: Record<InAppBrowserKind, string> = {
  zalo: 'Zalo',
  messenger: 'Messenger',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  line: 'LINE',
  webview: 'In-App Browser',
}

function quickPickApps(
  selectedBin: string,
  preferredBin: string | null,
  recipientBin: string,
): Bank[] {
  const ordered = [selectedBin, preferredBin, recipientBin, ...QUICK_APP_BINS]
  const seen = new Set<string>()
  const result: Bank[] = []
  for (const bin of ordered) {
    if (!bin || seen.has(bin)) continue
    const bank = getBankByBin(bin)
    if (!bank || !hasBankDeeplink(bank)) continue
    seen.add(bin)
    result.push(bank)
    if (result.length >= 6) break
  }
  return result
}

function defaultAppBin(preferredBin: string | null, recipientBin: string): string {
  if (preferredBin && hasBankDeeplink(getBankByBin(preferredBin))) return preferredBin
  if (hasBankDeeplink(getBankByBin(recipientBin))) return recipientBin
  return DEEPLINK_BANKS[0]?.bin ?? '970422'
}

interface Props {
  payment: BankLaunchPayment
  disabled?: boolean
  onSaveQr?: () => void
  framed?: boolean
}

export function BankAppLauncher({payment, disabled = false, onSaveQr, framed = true}: Props) {
  const t = useT()
  const copy = useCopy()
  const showToast = useToast()
  const preferredBin = useSettings((s) => s.preferredBankAppBin)

  const [os, setOs] = useState<Platform>('desktop')
  const [iab, setIab] = useState<InAppBrowserInfo>({isInApp: false, app: null})
  const [chosenBin, setChosenBin] = useState<string | null>(null)
  const [sheetKey, setSheetKey] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [status, setStatus] = useState<LaunchStatus>('idle')
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setOs(detectPlatform())
    setIab(detectInAppBrowser())
    return () => cleanupRef.current?.()
  }, [])

  const activeBin = chosenBin ?? defaultAppBin(preferredBin, payment.bin)
  const selectedBank = getBankByBin(activeBin) ?? DEEPLINK_BANKS[0]
  const plan = selectedBank ? buildBankLaunchPlan(selectedBank, payment, os) : null
  const quickApps = quickPickApps(activeBin, preferredBin, payment.bin)

  if (!selectedBank || !plan) return null

  const selectApp = (bin: string) => {
    cleanupRef.current?.()
    setChosenBin(bin)
    setPreferredBankApp(bin)
    setStatus('idle')
  }

  const openPicker = () => {
    setSheetKey((k) => k + 1)
    setSheetOpen(true)
  }

  const launch = () => {
    if (!plan.launchUrl || disabled) return
    cleanupRef.current?.()
    setPreferredBankApp(selectedBank.bin)
    if (plan.autofillMode !== 'confirmed' && payment.accountNumber) {
      // Write synchronously without blocking window.location.href so Safari keeps the user gesture.
      navigator.clipboard?.writeText(payment.accountNumber).catch(() => {})
      showToast({
        body: t('pay.copiedAccOpening', {bank: selectedBank.shortName}),
        uniqueID: 'deeplink-copy',
      })
    }
    setStatus('opening')
    cleanupRef.current = launchNativeApp(plan.launchUrl, (next) => setStatus(next))
  }

  const modeHint =
    plan.autofillMode === 'confirmed'
      ? t('pay.modeConfirmed')
      : plan.autofillMode === 'qrpay'
        ? t('pay.modeQrPay')
        : t('pay.modeLaunch')

  const openedMessage =
    plan.autofillMode === 'confirmed'
      ? t('pay.openedAutofill')
      : plan.autofillMode === 'qrpay'
        ? t('pay.openedQrPay')
        : t('pay.openedManual')

  const storeLabel = os === 'android' ? t('pay.storeAndroid') : t('pay.storeIos')

  const content = (
    <div className="flex flex-col gap-3.5">
      {framed && (
        <div className="flex items-start gap-3">
          <IconBadge hue="indigo">
            <Smartphone size={20} />
          </IconBadge>
          <div className="min-w-0 flex-1">
            <Heading level={2}>{t('pay.openAppTitle')}</Heading>
            <p className="text-xs text-secondary mt-0.5">{t('pay.openAppSubtitle')}</p>
          </div>
        </div>
      )}

      {iab.isInApp && (
        <Banner
          status="warning"
          title={t('pay.iabTitle', {app: iab.app ? IAB_NAMES[iab.app] : 'In-App Browser'})}
          description={t('pay.iabBody')}
          endContent={
            <Button
              label={t('pay.iabCopyLink')}
              size="sm"
              variant="secondary"
              icon={<Copy size={14} />}
              onClick={() => void copy(location.href, t('gen.linkCopied'))}
            />
          }
        />
      )}

      {/* Quick-pick strip + full picker */}
      <div className="flex flex-wrap gap-1.5">
        {quickApps.map((b) => {
          const active = b.bin === selectedBank.bin
          return (
            <button
              key={b.bin}
              type="button"
              aria-pressed={active}
              onClick={() => selectApp(b.bin)}
              className="qv-tile inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold"
            >
              <BankLogo bank={b} size={18} />
              <span>{b.shortName}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={openPicker}
          className="qv-tile inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-secondary hover:text-primary"
        >
          <span>{t('pay.otherApp')}</span>
          <ChevronDown size={14} aria-hidden />
        </button>
      </div>

      {/* Selected bank app card */}
      <div className="rounded-xl border border-border bg-surface p-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <BankLogo bank={selectedBank} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold truncate">{selectedBank.shortName}</span>
              <BankDeeplinkBadge bank={selectedBank} compact />
            </div>
            <p className="text-xs text-secondary mt-0.5">{modeHint}</p>
          </div>
        </div>

        {os === 'desktop' ? (
          <div className="flex flex-col gap-2.5 rounded-lg bg-muted p-3 text-xs text-secondary">
            <p>{t('pay.desktopHint')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                label={t('pay.openStore', {store: t('pay.storeIos')})}
                size="sm"
                variant="secondary"
                icon={<Store size={14} />}
                href={plan.iosStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
              <Button
                label={t('pay.openStore', {store: t('pay.storeAndroid')})}
                size="sm"
                variant="secondary"
                icon={<Store size={14} />}
                href={plan.androidStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Button
              label={
                status === 'opening'
                  ? t('pay.opening', {bank: selectedBank.shortName})
                  : t('pay.openButton', {bank: selectedBank.shortName})
              }
              icon={<ExternalLink size={16} />}
              variant="primary"
              isDisabled={disabled}
              onClick={launch}
            />

            {status === 'opened' && (
              <div className="rounded-lg border border-border bg-muted p-3 text-xs flex flex-col gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-success">
                  <CheckCircle2 size={15} aria-hidden />
                  <span>{t('pay.openedTitle', {bank: selectedBank.shortName})}</span>
                </div>
                <p className="text-secondary">{openedMessage}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    label={t('pay.retryOpen')}
                    size="sm"
                    variant="secondary"
                    icon={<RotateCcw size={14} />}
                    onClick={launch}
                  />
                  {plan.storeUrl && (
                    <Button
                      label={t('pay.openStore', {store: storeLabel})}
                      size="sm"
                      variant="ghost"
                      icon={<Store size={14} />}
                      href={plan.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  )}
                </div>
              </div>
            )}

            {status === 'fallback' && (
              <div className="rounded-lg border border-border bg-muted p-3 text-xs flex flex-col gap-2">
                <div className="font-semibold">
                  {t('pay.fallbackTitle', {bank: selectedBank.shortName})}
                </div>
                <p className="text-secondary">{t('pay.fallbackBody')}</p>
                <div className="flex flex-wrap gap-2">
                  {plan.storeUrl && (
                    <Button
                      label={t('pay.openStore', {store: storeLabel})}
                      size="sm"
                      variant="primary"
                      icon={<Store size={14} />}
                      href={plan.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  )}
                  <Button
                    label={t('pay.retryOpen')}
                    size="sm"
                    variant="secondary"
                    icon={<RotateCcw size={14} />}
                    onClick={launch}
                  />
                  {onSaveQr && (
                    <Button
                      label={t('pay.saveImage')}
                      size="sm"
                      variant="ghost"
                      icon={<Download size={14} />}
                      onClick={onSaveQr}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {sheetKey > 0 && (
        <BankSheet
          key={sheetKey}
          value={selectedBank.bin}
          isOpen={sheetOpen}
          onOpenChange={setSheetOpen}
          onlyDeeplink
          title={t('pay.selectApp')}
          onSelect={(b) => {
            selectApp(b.bin)
            setSheetOpen(false)
          }}
        />
      )}
    </div>
  )

  if (!framed) return content

  return (
    <section className={`${HUES.indigo} qv-tint rounded-2xl border border-border p-5 shadow-sm`}>
      {content}
    </section>
  )
}
