import {useEffect, useState} from 'react'
import {createFileRoute, useRouterState} from '@tanstack/react-router'
import {Clock, Download, Link2, ListChecks, Share2, ShieldCheck, Smartphone, Volume2} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {IconButton} from '@astryxdesign/core/IconButton'
import {Heading} from '@astryxdesign/core/Heading'
import {IconBadge, HUES} from '#/components/common/icon-badge'
import {CopyField} from '#/components/common/copy-field'
import {BankLogo} from '#/components/bank/bank-logo'
import {QrStage} from '#/components/qr/qr-stage'
import {exportPng} from '#/components/qr/export-actions'
import {useQrScene} from '#/components/qr/use-qr-scene'
import {buildTemplateInfo} from '#/components/vietqr/template-info'
import {speakAmount} from '#/components/vietqr/amount-field'
import {LogoMark} from '#/components/brand/logo'
import {decodePayLink, type PayLinkData} from '#/lib/paylink'
import {buildVietQr, toQrAscii} from '#/lib/vietqr'
import {amountToWords, formatVnd} from '#/lib/money'
import {downloadBlob, shareLink} from '#/lib/qr/export'
import {DEFAULT_QR_STYLE} from '#/lib/qr/render'
import {getBankByBin, resolveBank, type Bank} from '#/data/banks'
import {DEFAULT_DESIGN} from '#/stores/settings'
import {useLocale, useT} from '#/i18n'
import {useCopy} from '#/hooks/use-copy'
import {payHead} from '#/seo/head'

export const Route = createFileRoute('/pay')({
  head: ({match}) => payHead(match.search),
  component: PayPage,
})

function useCountdown(exp?: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!exp) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [exp])
  if (!exp) return null
  const left = Math.max(0, exp - now)
  const h = Math.floor(left / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {expired: left === 0, text: h > 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h > 0 ? `${h}:` : ''}${pad(m)}:${pad(s)}`}
}

const PAY_QR_STYLE = {...DEFAULT_QR_STYLE, ecc: 'M' as const}

/** The VietQR payload a payment link stands for, or null when its data does not make a valid code. */
function payPayload(data: PayLinkData, bank: Bank): string | null {
  try {
    return buildVietQr({bin: bank.bin, accountNumber: data.acc, amount: data.amount, purpose: toQrAscii(data.memo ?? ''), service: data.card ? 'card' : 'account'})
  } catch {
    return null
  }
}

/**
 * The payment link carried in the URL fragment (and, for a detailed link preview, the query
 * string), decoded, plus its bank. A hook so the values reach PayPage frozen and the compiler
 * can memoize everything derived from them.
 */
function usePayLink(): {data: PayLinkData | null; bank: Bank | undefined} {
  const hash = useRouterState({select: (s) => s.location.hash})
  const search = useRouterState({select: (s) => s.location.searchStr})
  const data = decodePayLink(hash || (typeof location !== 'undefined' ? location.hash : ''), search)
  return {data, bank: data ? (getBankByBin(data.bin) ?? resolveBank(data.bin)) : undefined}
}

function PayPage() {
  const t = useT()
  const locale = useLocale()
  const copy = useCopy()
  const {data, bank} = usePayLink()
  const payload = data && bank ? payPayload(data, bank) : null
  const design = {...DEFAULT_DESIGN, accent: data?.accent ?? DEFAULT_DESIGN.accent, showBrand: true}
  const info = payload && data ? buildTemplateInfo({bank, accountName: data.name, accountNumber: data.acc, amount: data.amount, purpose: data.memo, design, locale, t}) : null
  // Consumers of the derived values come after them, so the once-a-second countdown
  // re-render does not rebuild the QR.
  const {scene} = useQrScene(payload, 'compact', info, PAY_QR_STYLE, null)
  const countdown = useCountdown(data?.exp)

  if (!data || !bank || !payload) {
    return (
      <div className="p-6 lg:p-12">
        <EmptyState
          icon={<Link2 size={40} aria-hidden />}
          headingLevel={1}
          title={t('pay.invalid')}
          description={t('pay.invalidBody')}
          actions={<Button label={t('pay.makeOwn')} variant="primary" href="/link" />}
        />
      </div>
    )
  }

  const expired = countdown?.expired
  const words = data.amount ? amountToWords(data.amount, locale) : ''

  const saveImage = async () => {
    if (!scene) return
    downloadBlob(await exportPng(scene), `qrviet-${bank.code.toLowerCase()}-${data.acc}.png`)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:py-10">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
        <section className={`${HUES.red} qv-tint rounded-2xl border border-border shadow-md overflow-hidden animate-qv-rise`}>
          <div
            className="px-5 py-5 text-white"
            style={{background: `linear-gradient(135deg, ${design.accent}, color-mix(in srgb, ${design.accent} 55%, #000))`}}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                {/* text-inherit: the Astryx reset colours headings with the page text colour, which is dark on this banner. */}
                <h1 className="text-sm/5 font-normal text-inherit opacity-90">{t('pay.title')}</h1>
                <div className="text-3xl font-extrabold qv-num tracking-tight">{data.amount ? formatVnd(data.amount, true) : '—'}</div>
                {words && <div className="text-xs opacity-90 italic mt-0.5">{words}</div>}
              </div>
              {data.amount && typeof speechSynthesis !== 'undefined' ? (
                <IconButton label={t('gen.speak')} icon={<Volume2 size={18} />} variant="secondary" onClick={() => speakAmount(words, locale)} />
              ) : null}
            </div>
            {countdown && (
              <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${expired ? 'bg-black/30' : 'bg-white/20'}`}>
                <Clock size={13} aria-hidden /> {expired ? t('pay.expired') : t('pay.expiresIn', {time: countdown.text})}
              </div>
            )}
          </div>
          <div className="p-4 sm:p-5">
            {expired ? (
              <EmptyState icon={<Clock size={36} aria-hidden />} title={t('pay.expired')} isCompact />
            ) : (
              <QrStage scene={scene} label={`VietQR ${bank.shortName} ${data.acc}`} maxWidth={360} />
            )}
            {data.note && <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-sm italic">“{data.note}”</p>}
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <section className={`${HUES.green} qv-tint rounded-2xl border border-border p-5 shadow-sm`}>
            <div className="flex items-center gap-3 mb-2">
              <BankLogo bank={bank} size={40} />
              <div className="min-w-0">
                <div className="font-bold truncate">{bank.shortName}</div>
                <div className="text-xs text-secondary truncate">{bank.name}</div>
              </div>
            </div>
            <CopyField label={t('pay.to')} value={data.name ?? ''} />
            <CopyField label={data.card ? t('gen.card') : t('gen.account')} value={data.acc} mono />
            {data.amount ? <CopyField label={t('pay.amount')} value={String(data.amount)} display={formatVnd(data.amount, true)} emphasize /> : null}
            {data.memo && <CopyField label={t('pay.purpose')} value={data.memo} />}
            <p className="mt-3 text-xs text-secondary">{t('pay.copyHint')}</p>
          </section>

          <section className={`${HUES.blue} qv-tint rounded-2xl border border-border p-5 shadow-sm`}>
            <div className="flex items-center gap-3">
              <IconBadge hue="blue">
                <ListChecks size={20} />
              </IconBadge>
              <Heading level={2}>{t('pay.howTo')}</Heading>
            </div>
            <ol className="mt-4 flex flex-col gap-3">
              {(['pay.step1', 'pay.step2', 'pay.step3'] as const).map((k, i) => (
                <li key={k} className="flex items-start gap-3">
                  <span className="grid place-items-center size-7 shrink-0 rounded-full bg-accent text-on-accent text-sm font-bold">{i + 1}</span>
                  <span className="pt-0.5">{t(k)}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button label={t('pay.saveImage')} icon={<Download size={16} />} variant="primary" isDisabled={!scene || expired} clickAction={saveImage} />
              <Button
                label={t('common.share')}
                icon={<Share2 size={16} />}
                clickAction={async () => {
                  const r = await shareLink(location.href, t('pay.title'), 'QRViet')
                  if (r === 'unsupported') await copy(location.href, t('gen.linkCopied'))
                }}
              />
            </div>
          </section>

          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border p-4">
            <LogoMark size={36} className="shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
              <p className="flex items-start gap-1.5 text-sm font-semibold">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />
                <span>{t('pay.secure')}</span>
              </p>
              <Button label={t('pay.makeOwn')} size="sm" variant="secondary" icon={<Smartphone size={15} />} href="/link" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
