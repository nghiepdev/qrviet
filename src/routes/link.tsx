import {useCallback, useEffect, useMemo, useState} from 'react'
import {createFileRoute} from '@tanstack/react-router'
import {Copy, ExternalLink, Link2, Share2} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {TextInput} from '@astryxdesign/core/TextInput'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {PageBody, PageHeader, Panel} from '#/components/common/PageHeader'
import {AccountFields} from '#/components/vietqr/AccountFields'
import {AmountField} from '#/components/vietqr/AmountField'
import {PurposeField} from '#/components/vietqr/PurposeField'
import {SavedAccountsStrip} from '#/components/vietqr/SavedAccountsStrip'
import {AccentPicker} from '#/components/qr/TemplatePicker'
import {QrStage} from '#/components/qr/QrStage'
import {ExportActions} from '#/components/qr/ExportActions'
import {useFontsTick} from '#/components/qr/useQrScene'
import {EMPTY_FORM, draftStore, formFromAccount, useDerivedVietQr, type VietQrForm} from '#/components/vietqr/form'
import {LogoMark} from '#/components/brand/Logo'
import {payLinkUrl} from '#/lib/paylink'
import {layoutQr, makeQr, DEFAULT_QR_STYLE} from '#/lib/qr/render'
import {buildCaptionScene} from '#/lib/qr/templates'
import {createMeasure, shareLink} from '#/lib/qr/export'
import {useSettings} from '#/stores/settings'
import {useCopy} from '#/hooks/useCopy'
import {useT} from '#/i18n'

export const Route = createFileRoute('/link')({component: LinkBuilder})

const EXPIRY: Array<{value: string; ms: number}> = [
  {value: 'none', ms: 0},
  {value: '15m', ms: 15 * 60_000},
  {value: '1h', ms: 3_600_000},
  {value: '1d', ms: 86_400_000},
  {value: '7d', ms: 7 * 86_400_000},
]

function LinkBuilder() {
  const t = useT()
  const copy = useCopy()
  const contentMode = useSettings((s) => s.contentMode)
  const [form, setForm] = useState<VietQrForm>(() => ({...EMPTY_FORM, bin: draftStore.state.bin, accountNumber: draftStore.state.accountNumber, accountName: draftStore.state.accountName, service: draftStore.state.service}))
  const [note, setNote] = useState('')
  const [expiry, setExpiry] = useState('none')
  const [accent, setAccent] = useState('#d7263d')
  const fontsTick = useFontsTick()
  const patch = (p: Partial<VietQrForm>) => setForm((f) => ({...f, ...p}))
  const derived = useDerivedVietQr(form, contentMode)

  // The expiry clock starts when the link leaves the page (copy/share/open), not when
  // the option was picked; the on-screen preview and its QR refresh every 30 s.
  const buildUrl = useCallback(
    (now: number) => {
      if (!derived.payload) return ''
      const ms = EXPIRY.find((e) => e.value === expiry)?.ms ?? 0
      return payLinkUrl({
      bin: form.bin,
      acc: form.accountNumber,
      name: form.accountName || undefined,
      amount: derived.amount ?? undefined,
      memo: derived.purposeAscii || undefined,
      card: form.service === 'card',
      note: note.trim() || undefined,
        exp: ms ? now + ms : undefined,
        accent,
      })
    },
    [derived.payload, derived.amount, derived.purposeAscii, form, note, expiry, accent],
  )
  const [stampedAt, setStampedAt] = useState(() => Date.now())
  useEffect(() => {
    if (expiry === 'none') return
    const id = window.setInterval(() => setStampedAt(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [expiry])
  const url = useMemo(() => buildUrl(stampedAt), [buildUrl, stampedAt])

  const scene = useMemo(() => {
    if (!url) return null
    const style = {...DEFAULT_QR_STYLE, dots: 'rounded' as const, eyeFrame: 'rounded' as const, eyeBall: 'rounded' as const, ecc: 'Q' as const}
    const geo = layoutQr(makeQr(url, style.ecc), style, {size: 0.2, excavate: true, plate: 'none'})
    return buildCaptionScene({geo, opts: {style, logo: {src: `${import.meta.env.BASE_URL}logo.svg`, size: 0.2, plate: 'none', plateColor: '#fff', excavate: true}}}, t('tpl.scanToPay'), accent, createMeasure())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, accent, t, fontsTick])

  return (
    <>
      <PageHeader title={t('pay.builderTitle')} subtitle={t('pay.builderSubtitle')} icon={<Link2 size={22} />} />
      <PageBody>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] items-start">
          <Panel>
            <div className="flex flex-col gap-5">
              <SavedAccountsStrip activeKey={`${form.bin}:${form.accountNumber}`} onPick={(a) => setForm((f) => formFromAccount(a, {amountText: f.amountText, purpose: f.purpose}))} />
              <AccountFields form={form} onChange={patch} errors={derived.errors} showErrors={Boolean(form.accountNumber)} />
              <AmountField value={form.amountText} onChange={(amountText) => patch({amountText})} />
              <PurposeField value={form.purpose} ascii={derived.purposeAscii} onChange={(purpose) => patch({purpose})} error={derived.errors.purpose} warning={derived.warnings.purpose} />
              <TextInput label={t('pay.note')} value={note} onChange={setNote} placeholder={t('pay.notePlaceholder')} isOptional hasClear />
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">{t('pay.expiry')}</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('pay.expiry')}>
                  {EXPIRY.map((e) => (
                    <button
                      key={e.value}
                      type="button"
                      role="radio"
                      aria-checked={expiry === e.value}
                      onClick={() => {
                        setExpiry(e.value)
                        setStampedAt(Date.now())
                      }}
                      className="qv-tile px-3 py-1.5 rounded-full text-sm font-semibold">
                      {t(`pay.expiry.${e.value}` as 'pay.expiry.none')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">{t('gen.accent')}</span>
                <AccentPicker value={accent} onChange={setAccent} label={t('gen.accent')} />
              </div>
            </div>
          </Panel>

          <div className="flex flex-col gap-5 lg:sticky lg:top-20 min-w-0">
            <Panel title={t('pay.link')}>
              {url ? (
                <div className="flex flex-col gap-3">
                  <div className="rounded-md bg-muted p-3 qv-mono text-xs break-all max-h-28 overflow-auto">{url}</div>
                  <div className="flex flex-wrap gap-2">
                    <Button label={t('common.copy')} icon={<Copy size={16} />} variant="primary" onClick={() => void copy(buildUrl(Date.now()), t('gen.linkCopied'))} />
                    <Button
                      label={t('common.share')}
                      icon={<Share2 size={16} />}
                      clickAction={async () => {
                        const fresh = buildUrl(Date.now())
                        const r = await shareLink(fresh, t('pay.title'), 'QRViet')
                        if (r === 'unsupported') await copy(fresh, t('gen.linkCopied'))
                      }}
                    />
                    <Button label={t('pay.open')} icon={<ExternalLink size={16} />} variant="ghost" onClick={() => window.open(buildUrl(Date.now()), '_blank', 'noopener')} />
                  </div>
                </div>
              ) : (
                <EmptyState icon={<LogoMark size={48} />} title={t('gen.emptyTitle')} description={t('gen.emptyBody')} isCompact />
              )}
            </Panel>
            {scene && (
              <Panel title={t('pay.qrOfLink')}>
                <div className="flex flex-col gap-4">
                  <QrStage scene={scene} label={url} maxWidth={320} />
                  <ExportActions scene={scene} filename="qrviet-payment-link" hotkeys={false} />
                </div>
              </Panel>
            )}
          </div>
        </div>
      </PageBody>
    </>
  )
}
