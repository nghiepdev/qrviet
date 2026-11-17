import {parseLinkSearch, rawLocationHash} from '#/lib/route-search'
import {useEffect, useState} from 'react'
import {createFileRoute, useNavigate, useLocation} from '@tanstack/react-router'
import {Copy, ExternalLink, Link2, QrCode, Share2} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {TextInput} from '@astryxdesign/core/TextInput'
import {Switch} from '@astryxdesign/core/Switch'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {PageBody, PageHeader, Panel} from '#/components/common/page-header'
import {AccountFields} from '#/components/vietqr/account-fields'
import {AmountField} from '#/components/vietqr/amount-field'
import {PurposeField} from '#/components/vietqr/purpose-field'
import {SavedAccountsStrip} from '#/components/vietqr/saved-accounts-strip'
import {AccentPicker} from '#/components/qr/template-picker'
import {QrStage} from '#/components/qr/qr-stage'
import {ExportActions} from '#/components/qr/export-actions'
import {useTextMeasure} from '#/components/qr/use-qr-scene'
import {
  EMPTY_FORM,
  draftStore,
  formFromAccount,
  formFromSearch,
  useDerivedVietQr,
  type VietQrForm,
} from '#/components/vietqr/form'
import {LogoMark} from '#/components/brand/logo'
import {PaySheet, usePaySheet} from '#/components/pay/pay-sheet'
import {payLinkUrl} from '#/lib/paylink'
import {layoutQr, makeQr, DEFAULT_QR_STYLE} from '#/lib/qr/render'
import {buildCaptionScene} from '#/lib/qr/templates'
import {shareLink} from '#/lib/qr/export'
import type {Measure} from '#/lib/qr/scene'
import {useSettings} from '#/stores/settings'
import {useCopy} from '#/hooks/use-copy'
import {useT} from '#/i18n'
import {heatStyle} from '#/components/common/icon-badge'
import {pageHead} from '#/seo/head'

export const Route = createFileRoute('/link')({
  head: () => pageHead('link'),
  validateSearch: parseLinkSearch,
  component: LinkBuilder,
})

const EXPIRY: Array<{value: string; ms: number}> = [
  {value: 'none', ms: 0},
  {value: '15m', ms: 15 * 60_000},
  {value: '1h', ms: 3_600_000},
  {value: '1d', ms: 86_400_000},
  {value: '7d', ms: 7 * 86_400_000},
]

/** QR that opens the payment link, with a caption — for printing or showing at the counter. */
function linkQrScene(url: string, caption: string, accent: string, measure: Measure) {
  if (!url) return null
  const style = {
    ...DEFAULT_QR_STYLE,
    dots: 'rounded' as const,
    eyeFrame: 'rounded' as const,
    eyeBall: 'rounded' as const,
    ecc: 'Q' as const,
  }
  const geo = layoutQr(makeQr(url, style.ecc), style, {size: 0.2, excavate: true, plate: 'none'})
  const logo = {
    src: `${import.meta.env.BASE_URL}logo.svg`,
    size: 0.2,
    plate: 'none' as const,
    plateColor: '#fff',
    excavate: true,
  }
  return buildCaptionScene({geo, opts: {style, logo}}, caption, accent, measure)
}

function LinkBuilder() {
  const t = useT()
  const copy = useCopy()
  const navigate = useNavigate({from: '/link'})
  const hash = useLocation({select: rawLocationHash})
  const search = parseLinkSearch(Route.useSearch(), hash)
  const paySheet = usePaySheet()
  const contentMode = useSettings((s) => s.contentMode)
  const [form, setForm] = useState<VietQrForm>(() => ({
    ...EMPTY_FORM,
    bin: draftStore.state.bin,
    accountNumber: draftStore.state.accountNumber,
    accountName: draftStore.state.accountName,
    service: draftStore.state.service,
  }))
  const [note, setNote] = useState('')
  const [expiry, setExpiry] = useState('none')
  const [accent, setAccent] = useState('#d7263d')
  // Off unless asked for: a detailed preview sends the bank, name and amount to the host (src/lib/paylink.ts).
  const [preview, setPreview] = useState(false)
  const measure = useTextMeasure()

  useEffect(() => {
    const hasSearch = Object.values(search).some((v) => v !== undefined)
    if (!hasSearch) return
    const fresh = search.acc !== undefined
    setForm((form) => formFromSearch(form, search))
    if (search.note !== undefined || fresh) setNote(search.note ?? '')
    if (search.exp && EXPIRY.some((expiry) => expiry.value === search.exp)) setExpiry(search.exp)
    else if (fresh) setExpiry('none')
    if (search.preview !== undefined || fresh) setPreview(search.preview ?? false)
    void navigate({search: {}, hash: '', replace: true, resetScroll: false})
  }, [search, navigate])

  const patch = (p: Partial<VietQrForm>) => setForm((f) => ({...f, ...p}))
  const derived = useDerivedVietQr(form, contentMode)

  // The expiry clock starts when the link leaves the page (copy/share/open), not when
  // the option was picked; the on-screen preview and its QR refresh every 30 s.
  const buildUrl = (now: number) => {
    if (!derived.payload) return ''
    const ms = EXPIRY.find((e) => e.value === expiry)?.ms ?? 0
    return payLinkUrl(
      {
        bin: form.bin,
        acc: form.accountNumber,
        name: form.accountName || undefined,
        amount: derived.amount ?? undefined,
        memo: derived.purposeAscii || undefined,
        card: form.service === 'card',
        note: note.trim() || undefined,
        exp: ms ? now + ms : undefined,
        accent,
      },
      preview,
    )
  }
  const [stampedAt, setStampedAt] = useState(() => Date.now())
  useEffect(() => {
    if (expiry === 'none') return
    const id = window.setInterval(() => setStampedAt(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [expiry])
  const url = buildUrl(stampedAt)
  const scene = linkQrScene(url, t('tpl.scanToPay'), accent, measure)

  return (
    <>
      <PageHeader
        title={t('pay.builderTitle')}
        subtitle={t('pay.builderSubtitle')}
        icon={<Link2 size={22} />}
      />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <Panel>
            <div className="flex flex-col gap-5">
              <SavedAccountsStrip
                activeKey={`${form.bin}:${form.accountNumber}`}
                onPick={(a) =>
                  setForm((f) => formFromAccount(a, {amountText: f.amountText, purpose: f.purpose}))
                }
              />
              <AccountFields
                form={form}
                onChange={patch}
                errors={derived.errors}
                showErrors={Boolean(form.accountNumber)}
              />
              <AmountField value={form.amountText} onChange={(amountText) => patch({amountText})} />
              <PurposeField
                value={form.purpose}
                ascii={derived.purposeAscii}
                onChange={(purpose) => patch({purpose})}
                error={derived.errors.purpose}
                warning={derived.warnings.purpose}
              />
              <TextInput
                label={t('pay.note')}
                value={note}
                onChange={setNote}
                placeholder={t('pay.notePlaceholder')}
                isOptional
                hasClear
              />
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">{t('pay.expiry')}</span>
                <div
                  className="flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label={t('pay.expiry')}
                >
                  {/* Deeper along the row, from cyan to blue: time cools where money warms. */}
                  {EXPIRY.map((e, i) => (
                    <button
                      key={e.value}
                      type="button"
                      role="radio"
                      aria-checked={expiry === e.value}
                      onClick={() => {
                        setExpiry(e.value)
                        setStampedAt(Date.now())
                      }}
                      style={heatStyle(i, EXPIRY.length)}
                      className="qv-tile qv-tile-hue qv-heat qv-heat-time qv-hue-text rounded-full px-3 py-1.5 text-sm font-semibold"
                    >
                      {t(`pay.expiry.${e.value}` as 'pay.expiry.none')}
                    </button>
                  ))}
                </div>
              </div>
              <Switch
                label={t('pay.preview')}
                description={t('pay.previewHint')}
                value={preview}
                onChange={setPreview}
              />
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">{t('gen.accent')}</span>
                <AccentPicker value={accent} onChange={setAccent} label={t('gen.accent')} />
              </div>
            </div>
          </Panel>

          <div className="flex min-w-0 flex-col gap-5 md:sticky md:top-20">
            <Panel title={t('pay.link')} icon={Link2} hue="violet">
              {url ? (
                <div className="flex flex-col gap-3">
                  <div className="qv-mono max-h-28 overflow-auto rounded-md bg-muted p-3 text-xs break-all">
                    {url}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      label={t('common.copy')}
                      icon={<Copy size={16} />}
                      variant="primary"
                      onClick={() => void copy(buildUrl(Date.now()), t('gen.linkCopied'))}
                    />
                    <Button
                      label={t('common.share')}
                      icon={<Share2 size={16} />}
                      clickAction={async () => {
                        const fresh = buildUrl(Date.now())
                        const r = await shareLink(fresh, t('pay.title'), 'QRViet')
                        if (r === 'unsupported') await copy(fresh, t('gen.linkCopied'))
                      }}
                    />
                    <Button
                      label={t('pay.open')}
                      icon={<ExternalLink size={16} />}
                      variant="ghost"
                      onClick={() => paySheet.open(buildUrl(Date.now()))}
                    />
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<LogoMark size={48} />}
                  title={t('gen.emptyTitle')}
                  description={t('gen.emptyBody')}
                  isCompact
                />
              )}
            </Panel>
            {scene && (
              <Panel title={t('pay.qrOfLink')} icon={QrCode} hue="blue">
                <div className="flex flex-col gap-4">
                  <QrStage scene={scene} label={url} maxWidth={320} />
                  <ExportActions scene={scene} filename="qrviet-payment-link" />
                </div>
              </Panel>
            )}
          </div>
        </div>
      </PageBody>
      <PaySheet {...paySheet.sheetProps} />
    </>
  )
}
