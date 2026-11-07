import {useEffect, useRef, useState} from 'react'
import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {useSelector} from '@tanstack/react-store'
import {ArrowDown, BookmarkPlus, Code2, Eraser, Landmark, Link2, Palette, QrCode, Settings2} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {Collapsible} from '@astryxdesign/core/Collapsible'
import {TextInput} from '@astryxdesign/core/TextInput'
import {Switch} from '@astryxdesign/core/Switch'
import {RadioList, RadioListItem} from '@astryxdesign/core/RadioList'
import {Tab, TabList} from '@astryxdesign/core/TabList'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {useToast} from '@astryxdesign/core/Toast'
import {PageBody, PageHeader, Panel} from '#/components/common/page-header'
import {AccountFields} from '#/components/vietqr/account-fields'
import {AmountField} from '#/components/vietqr/amount-field'
import {PurposeField} from '#/components/vietqr/purpose-field'
import {SavedAccountsStrip} from '#/components/vietqr/saved-accounts-strip'
import {ScanCheckBadge, useScanCheck} from '#/components/vietqr/scan-check'
import {EMPTY_FORM, draftStore, formFromAccount, useDerivedVietQr, type VietQrForm} from '#/components/vietqr/form'
import {buildTemplateInfo} from '#/components/vietqr/template-info'
import {QrStage} from '#/components/qr/qr-stage'
import {ExportActions, type ExportKind} from '#/components/qr/export-actions'
import {StylePanel} from '#/components/qr/style-panel'
import {AccentPicker, TemplatePicker} from '#/components/qr/template-picker'
import {resolveLogo, useQrScene} from '#/components/qr/use-qr-scene'
import {LogoMark} from '#/components/brand/logo'
import {getBankByBin, resolveBank} from '#/data/banks'
import {useLocale, useT} from '#/i18n'
import {accountsStore, findDuplicate, getDefaultAccount, saveAccount, touchAccount} from '#/stores/accounts'
import {addHistory} from '#/stores/history'
import {saveSceneThumb} from '#/lib/thumbs'
import {updateDesign, updateQrStyle, useSettings} from '#/stores/settings'
import {formatVnd, parseAmount} from '#/lib/money'
import {slugify} from '#/lib/text'
import {payLinkUrl} from '#/lib/paylink'
import {useCopy} from '#/hooks/use-copy'

interface GenSearch {
  bank?: string
  acc?: string
  name?: string
  amount?: string
  memo?: string
  account?: string
  card?: boolean
}

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : undefined)

export const Route = createFileRoute('/')({
  validateSearch: (s: Record<string, unknown>): GenSearch => ({
    bank: str(s.bank),
    acc: str(s.acc),
    name: str(s.name),
    amount: str(s.amount),
    memo: str(s.memo),
    account: str(s.account),
    card: s.card === true || s.card === 'true' || s.card === '1' ? true : undefined,
  }),
  component: GeneratorPage,
})

function GeneratorPage() {
  const t = useT()
  const locale = useLocale()
  const navigate = useNavigate({from: '/'})
  const search = Route.useSearch()
  const showToast = useToast()
  const copy = useCopy()
  const form = useSelector(draftStore, (s) => s)
  const contentMode = useSettings((s) => s.contentMode)
  const design = useSettings((s) => s.design)
  const autoSave = useSettings((s) => s.autoSaveHistory)
  const [touched, setTouched] = useState(false)
  const [designTab, setDesignTab] = useState('template')
  const previewRef = useRef<HTMLDivElement>(null)
  const [previewVisible, setPreviewVisible] = useState(true)

  const patch = (p: Partial<VietQrForm>) => {
    setTouched(true)
    draftStore.setState((f) => ({...f, ...p}))
  }

  // Seed from URL (command palette, saved accounts, banks page, scan → re-issue), then clean the URL.
  const seeded = useRef(false)
  useEffect(() => {
    const hasSearch = Object.values(search).some((v) => v !== undefined)
    const firstRun = !seeded.current
    seeded.current = true
    if (!hasSearch) {
      // Only on first mount (not after we clear the URL): an empty draft starts from the default account.
      if (firstRun && !draftStore.state.accountNumber) {
        const def = getDefaultAccount()
        if (def) draftStore.setState((f) => formFromAccount(def, {amountText: f.amountText, purpose: f.purpose}))
      }
      return
    }
    if (search.account) {
      const a = accountsStore.state.find((x) => x.id === search.account)
      if (a) {
        draftStore.setState((f) => formFromAccount(a, {amountText: f.amountText, purpose: f.purpose}))
        touchAccount(a.id)
      }
    } else {
      const bank = resolveBank(search.bank)
      const parsed = search.amount ? parseAmount(search.amount) : null
      const amountText = search.amount ? (parsed ? formatVnd(parsed) : search.amount) : undefined
      draftStore.setState((f) => {
        const fresh = Boolean(search.acc) // a complete payee → start from a clean form
        const base = fresh ? EMPTY_FORM : f
        const switchedBank = Boolean(bank && bank.bin !== f.bin && !fresh)
        let next: VietQrForm = {
          ...base,
          bin: bank?.bin ?? base.bin,
          accountNumber: search.acc ?? (switchedBank ? '' : base.accountNumber),
          accountName: search.name ?? (switchedBank ? '' : base.accountName),
          amountText: amountText ?? base.amountText,
          purpose: search.memo ?? base.purpose,
          service: search.card ? 'card' : fresh ? 'account' : base.service,
        }
        // Amount/memo-only links (e.g. split bill): use the default account as payee when none is set.
        if (!next.accountNumber && !search.bank) {
          const def = getDefaultAccount()
          if (def) next = formFromAccount(def, {amountText: next.amountText, purpose: next.purpose})
        }
        return next
      })
    }
    void navigate({search: {}, replace: true})
  }, [search, navigate])

  const derived = useDerivedVietQr(form, contentMode)
  const bank = getBankByBin(form.bin)
  const logo = resolveLogo(design, bank)
  const info = derived.payload
    ? buildTemplateInfo({
        bank,
        accountName: form.accountName,
        accountNumber: form.accountNumber,
        amount: derived.amount,
        purpose: derived.purposeAscii,
        design,
        locale,
        t,
      })
    : null
  const {scene, qrScene} = useQrScene(derived.payload, design.template, info, design.style, logo)
  const scanStatus = useScanCheck(qrScene, derived.payload)

  // Floating "view code" button on phones when the preview is off-screen.
  useEffect(() => {
    const el = previewRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setPreviewVisible(entry.isIntersecting), {threshold: 0.15})
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const filename = slugify(`qrviet-${bank?.shortName ?? ''}-${form.accountNumber}${derived.amount ? `-${derived.amount}` : ''}`)

  const onExported = (_kind: ExportKind) => {
    if (!derived.payload || !autoSave) return
    const entry = addHistory({
      kind: 'vietqr',
      thumb: Boolean(scene),
      payload: derived.payload,
      title: form.accountName || bank?.shortName || form.accountNumber,
      subtitle: [bank?.shortName, form.accountNumber, derived.amount ? formatVnd(derived.amount, true) : ''].filter(Boolean).join(' · '),
      meta: {
        bin: form.bin,
        accountNumber: form.accountNumber,
        accountName: form.accountName,
        amount: derived.amount ? String(derived.amount) : undefined,
        purpose: derived.purposeAscii,
      },
    })
    if (scene) void saveSceneThumb(entry.id, scene)
  }

  const saveCurrentAccount = () => {
    if (!form.bin || !form.accountNumber) return
    const dup = findDuplicate(form.bin, form.accountNumber)
    saveAccount({
      id: dup?.id,
      bin: form.bin,
      accountNumber: form.accountNumber,
      accountName: form.accountName,
      nickname: dup?.nickname ?? '',
      service: form.service,
    })
    showToast({body: dup ? t('common.saved') : t('gen.accountSaved'), uniqueID: 'acc-save'})
  }

  const copyPayLink = () => {
    if (!derived.payload) return
    const url = payLinkUrl({
      bin: form.bin,
      acc: form.accountNumber,
      name: form.accountName || undefined,
      amount: derived.amount ?? undefined,
      memo: derived.purposeAscii || undefined,
      card: form.service === 'card',
      accent: design.accent,
    })
    void copy(url, t('gen.linkCopied'))
    onExported('copy')
  }

  const showErrors = touched || Boolean(form.accountNumber)

  return (
    <>
      <PageHeader title={t('gen.title')} subtitle={t('gen.subtitle')} icon={<QrCode size={22} />} />
      <PageBody>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] items-start">
          {/* ---------------- Form ---------------- */}
          <div className="flex flex-col gap-5 min-w-0">
            <Panel
              actions={
                <>
                  <Button label={t('gen.saveAccount')} isIconOnly tooltip={t('gen.saveAccount')} icon={<BookmarkPlus size={18} />} variant="ghost" onClick={saveCurrentAccount} isDisabled={!derived.payload} />
                  <Button
                    label={t('gen.clearForm')}
                    isIconOnly
                    tooltip={t('gen.clearForm')}
                    icon={<Eraser size={18} />}
                    variant="ghost"
                    onClick={() => {
                      setTouched(false)
                      draftStore.setState(() => EMPTY_FORM)
                    }}
                  />
                </>
              }
              title={t('gen.formTitle')}
              icon={Landmark}>
              <div className="flex flex-col gap-5">
                <SavedAccountsStrip
                  activeKey={`${form.bin}:${form.accountNumber}`}
                  onPick={(a) => {
                    draftStore.setState((f) => formFromAccount(a, {amountText: f.amountText, purpose: f.purpose}))
                    touchAccount(a.id)
                  }}
                />
                <AccountFields form={form} onChange={patch} errors={derived.errors} showErrors={showErrors} />
                <AmountField value={form.amountText} onChange={(amountText) => patch({amountText})} error={derived.errors.amount ? t(derived.errors.amount) : undefined} />
                <PurposeField
                  value={form.purpose}
                  ascii={derived.purposeAscii}
                  onChange={(purpose) => patch({purpose})}
                  error={derived.errors.purpose}
                  warning={derived.warnings.purpose}
                />
                <Collapsible
                  defaultIsOpen={false}
                  trigger={
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <Settings2 size={16} aria-hidden /> {t('gen.advanced')}
                    </span>
                  }>
                  <div className="@container flex flex-col gap-4 pt-3">
                    {/* Two columns only when the panel itself (not the screen) leaves room for each label, "Tuỳ chọn" included, on one line. */}
                    <div className="grid gap-3 @lg:grid-cols-2">
                      <TextInput label={t('gen.billNumber')} value={form.billNumber} onChange={(billNumber) => patch({billNumber})} isOptional hasClear />
                      <TextInput label={t('gen.reference')} value={form.referenceLabel} onChange={(referenceLabel) => patch({referenceLabel})} isOptional hasClear />
                    </div>
                    {/* Each choice says what it does: the names alone ("static", "dynamic") are EMV terms. */}
                    <RadioList label={t('gen.initiation')} value={form.initiation} onChange={(v) => patch({initiation: v as VietQrForm['initiation']})} size="sm">
                      <RadioListItem align="first-line" value="auto" label={t('gen.initiationAuto')} description={t('gen.initiationAutoHint')} />
                      <RadioListItem align="first-line" value="static" label={t('gen.initiationStatic')} description={t('gen.initiationStaticHint')} />
                      <RadioListItem align="first-line" value="dynamic" label={t('gen.initiationDynamic')} description={t('gen.initiationDynamicHint')} />
                    </RadioList>
                    <Switch label={t('gen.merchantName')} value={form.includeName} onChange={(includeName) => patch({includeName})} />
                    {form.includeName && <TextInput label={t('gen.merchantCity')} value={form.merchantCity} onChange={(merchantCity) => patch({merchantCity})} isOptional hasClear />}
                  </div>
                </Collapsible>
              </div>
            </Panel>
          </div>

          {/* ---------------- Preview ---------------- */}
          <div className="flex flex-col gap-5 min-w-0 md:sticky md:top-20" ref={previewRef}>
            <Panel hue="violet">
              <div className="flex flex-col gap-4">
                <TemplatePicker value={design.template} onChange={(template) => updateDesign({template})} />
                <QrStage
                  scene={scene}
                  label={`VietQR ${bank?.shortName ?? ''} ${form.accountNumber}`}
                  checker={design.template === 'qr' && design.style.transparentBg}
                  empty={
                    <EmptyState
                      icon={<LogoMark size={56} />}
                      title={t('gen.emptyTitle')}
                      description={t('gen.emptyBody')}
                      isCompact
                    />
                  }
                />
                <ScanCheckBadge status={scanStatus} />
                <ExportActions
                  scene={scene}
                  filename={filename}
                  shareText={derived.amount ? `${t('tpl.transfer')} ${formatVnd(derived.amount, true)}` : t('tpl.transfer')}
                  onExported={onExported}
                  side={{label: t('gen.shareLink'), icon: <Link2 size={16} />, isDisabled: !derived.payload, onClick: copyPayLink}}
                  menuItems={[
                    {
                      id: 'payload',
                      label: t('gen.copyVietQr'),
                      icon: <Code2 size={16} />,
                      isDisabled: !derived.payload,
                      onClick: () => {
                        if (derived.payload) void copy(derived.payload)
                      },
                    },
                  ]}
                />
              </div>
            </Panel>

            <Panel title={t('gen.design')} icon={Palette} hue="pink">
              <div className="flex flex-col gap-4">
                <TabList value={designTab} onChange={setDesignTab} layout="fill" role="tablist">
                  <Tab value="template" label={t('gen.templates')} panelId="design-panel" />
                  <Tab value="style" label={t('gen.style')} panelId="design-panel" />
                </TabList>
                <div id="design-panel" role="tabpanel">
                {designTab === 'template' ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-semibold">{t('gen.accent')}</span>
                      <AccentPicker value={design.accent} onChange={(accent) => updateDesign({accent})} label={t('gen.accent')} />
                    </div>
                    {(design.template === 'card' || design.template === 'standee') && (
                      <TextInput
                        label={t('gen.title.custom')}
                        value={design.title}
                        onChange={(title) => updateDesign({title})}
                        placeholder={t('gen.title.customPlaceholder')}
                        isOptional
                        hasClear
                      />
                    )}
                    <Switch label={t('gen.maskAccount')} value={design.maskAccount} onChange={(maskAccount) => updateDesign({maskAccount})} />
                    <Switch label={t('gen.showBrand')} value={design.showBrand} onChange={(showBrand) => updateDesign({showBrand})} />
                  </div>
                ) : (
                  <StylePanel style={design.style} onStyle={updateQrStyle} design={design} onDesign={updateDesign} logo={logo} />
                )}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </PageBody>

      {!previewVisible && derived.payload && (
        <div className="qv-hide-when-typing md:hidden fixed inset-x-0 bottom-[calc(104px+env(safe-area-inset-bottom))] z-30 flex justify-center pointer-events-none animate-qv-rise">
          <span className="pointer-events-auto">
            <Button
              label={t('common.preview')}
              variant="primary"
              elevation="high"
              icon={<ArrowDown size={16} />}
              onClick={() => previewRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})}
            />
          </span>
        </div>
      )}
    </>
  )
}
