import {useMemo, useState} from 'react'
import {createFileRoute} from '@tanstack/react-router'
import {CircleAlert, CircleCheck, FileArchive, Layers, Printer, Wand2} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {TextArea} from '@astryxdesign/core/TextArea'
import {TextInput} from '@astryxdesign/core/TextInput'
import {NumberInput} from '@astryxdesign/core/NumberInput'
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl'
import {ProgressBar} from '@astryxdesign/core/ProgressBar'
import {useToast} from '@astryxdesign/core/Toast'
import {PageBody, PageHeader, Panel} from '#/components/common/PageHeader'
import {AccountFields} from '#/components/vietqr/AccountFields'
import {SavedAccountsStrip} from '#/components/vietqr/SavedAccountsStrip'
import {EMPTY_FORM, draftStore, formFromAccount, type VietQrForm} from '#/components/vietqr/form'
import {buildTemplateInfo} from '#/components/vietqr/templateInfo'
import {TemplatePicker} from '#/components/qr/TemplatePicker'
import {effectiveStyle, resolveLogo, useFontsTick} from '#/components/qr/useQrScene'
import {exportScene} from '#/components/qr/ExportActions'
import {buildVietQr, toQrAscii, validateVietQr} from '#/lib/vietqr'
import {formatVnd, parseAmount} from '#/lib/money'
import {sanitizeTransferContent, slugify} from '#/lib/text'
import {layoutQr, makeQr} from '#/lib/qr/render'
import {buildTemplateScene, type TemplateId} from '#/lib/qr/templates'
import {sceneToSvg, type Scene} from '#/lib/qr/scene'
import {createMeasure, downloadBlob, printSvgs, sceneToStandaloneSvg} from '#/lib/qr/export'
import {createZip} from '#/lib/zip'
import {getBankByBin} from '#/data/banks'
import {useSettings} from '#/stores/settings'
import {useLocale, useT} from '#/i18n'

export const Route = createFileRoute('/batch')({component: BatchPage})

const MAX_ROWS = 200
const SAMPLE = `So tien\tNoi dung\tNhan\n150000\tPhong 101 T11\tPhòng 101\n150000\tPhong 102 T11\tPhòng 102\n1tr2\tDH 2024\tĐơn #2024\n50k\tAn trua\tBàn 5`

const LAYOUTS = [
  {id: '2x3', cols: 2, label: '2 × 3'},
  {id: '3x4', cols: 3, label: '3 × 4'},
  {id: '4x5', cols: 4, label: '4 × 5'},
] as const

interface Row {
  n: number
  amountText: string
  amount: number | null
  purpose: string
  label: string
  payload: string | null
  error: string | null
}

function detectSeparator(text: string): RegExp {
  if (text.includes('\t')) return /\t/
  if (text.includes(';')) return /;/
  return /,(?=(?:[^"]*"[^"]*")*[^"]*$)/
}

function parseRows(text: string, form: VietQrForm, contentMode: 'strict' | 'relaxed'): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const sep = detectSeparator(text)
  const rows: Row[] = []
  lines.forEach((line, i) => {
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
    const [amountText = '', purposeRaw = '', label = ''] = cells
    if (i === 0 && amountText && parseAmount(amountText) === null && !/^\d/.test(amountText)) return // header
    const amount = amountText ? parseAmount(amountText) : null
    const purpose = toQrAscii(sanitizeTransferContent(purposeRaw, contentMode))
    let payload: string | null = null
    let error: string | null = null
    if (amountText && amount === null) error = 'amount'
    else {
      const issues = validateVietQr({bin: form.bin, accountNumber: form.accountNumber, amount: amount ?? undefined, purpose}).filter((x) => x.severity === 'error')
      if (issues.length) error = issues[0].code
      else {
        payload = buildVietQr({bin: form.bin, accountNumber: form.accountNumber, service: form.service, amount: amount ?? undefined, purpose})
      }
    }
    rows.push({n: rows.length + 1, amountText, amount, purpose, label: label || purposeRaw || (amount ? formatVnd(amount, true) : ''), payload, error})
  })
  return rows.slice(0, MAX_ROWS)
}

function BatchPage() {
  const t = useT()
  const locale = useLocale()
  const showToast = useToast()
  const design = useSettings((s) => s.design)
  const contentMode = useSettings((s) => s.contentMode)
  const fontsTick = useFontsTick()
  const [form, setForm] = useState<VietQrForm>(() => ({...EMPTY_FORM, bin: draftStore.state.bin, accountNumber: draftStore.state.accountNumber, accountName: draftStore.state.accountName, service: draftStore.state.service}))
  const [mode, setMode] = useState<'paste' | 'sequence'>('paste')
  const [text, setText] = useState('')
  const [seq, setSeq] = useState({prefix: 'Phong ', from: 101, to: 110, amount: '150.000'})
  const [template, setTemplate] = useState<TemplateId>('minimal')
  const [layout, setLayout] = useState<(typeof LAYOUTS)[number]['id']>('3x4')
  const [progress, setProgress] = useState<{done: number; total: number} | null>(null)

  const accountOk = validateVietQr({bin: form.bin, accountNumber: form.accountNumber}).every((i) => i.severity !== 'error')
  const rows = useMemo(() => (accountOk ? parseRows(text, form, contentMode) : []), [text, form, contentMode, accountOk])
  const valid = rows.filter((r) => r.payload)
  const bank = getBankByBin(form.bin)

  // Built from the current rows (not a payload key) so row numbers, labels and images never drift apart.
  const scenes = useMemo(() => {
    const logo = resolveLogo(design, bank)
    const style = effectiveStyle(design.style, logo)
    const measure = createMeasure()
    return rows
      .filter((r) => r.payload)
      .map((r) => {
        const info = buildTemplateInfo({
          bank,
          accountName: form.accountName,
          accountNumber: form.accountNumber,
          amount: r.amount,
          purpose: r.purpose,
          design: {...design, title: r.label},
          locale,
          t,
        })
        const geo = layoutQr(makeQr(r.payload!, style.ecc), style, logo)
        return {row: r, scene: buildTemplateScene(template, {...info, title: r.label || info.title}, {geo, opts: {style, logo}}, measure)}
      })
    // fontsTick re-measures text once web fonts are ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, template, design, bank, form.accountName, form.accountNumber, locale, t, fontsTick])

  const generateSequence = () => {
    const lines: string[] = []
    const from = Math.min(seq.from, seq.to)
    const to = Math.min(Math.max(seq.from, seq.to), from + MAX_ROWS - 1)
    for (let n = from; n <= to; n++) lines.push(`${seq.amount}\t${seq.prefix}${n}\t${seq.prefix}${n}`)
    setText(lines.join('\n'))
    setMode('paste')
  }

  const downloadZip = async () => {
    setProgress({done: 0, total: scenes.length})
    const entries: Array<{name: string; data: Blob}> = []
    for (let i = 0; i < scenes.length; i++) {
      const {row, scene} = scenes[i]
      const {blob, ext} = await exportScene(scene, 'png', 3)
      entries.push({name: `${String(row.n).padStart(3, '0')}-${slugify(row.label || row.purpose || String(row.amount ?? ''))}.${ext}`, data: blob})
      setProgress({done: i + 1, total: scenes.length})
    }
    const csv = ['#,amount,purpose,label,payload', ...valid.map((r) => [r.n, r.amount ?? '', r.purpose, r.label, r.payload].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const zip = await createZip([...entries, {name: 'qrviet-batch.csv', data: `﻿${csv}`}])
    downloadBlob(zip, `qrviet-batch-${bank?.code.toLowerCase() ?? 'vietqr'}-${scenes.length}.zip`)
    setProgress(null)
    showToast({body: t('gen.downloaded'), uniqueID: 'zip'})
  }

  const print = async () => {
    const cols = LAYOUTS.find((l) => l.id === layout)?.cols ?? 3
    await printSvgs(
      await Promise.all(scenes.map(({scene}) => sceneToStandaloneSvg(scene))),
      {page: 'A4', columns: cols, gapMm: 5, marginMm: 8, title: 'QRViet labels'},
    )
  }

  return (
    <>
      <PageHeader title={t('batch.title')} subtitle={t('batch.subtitle')} icon={<Layers size={22} />} />
      <PageBody>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
          <div className="flex flex-col gap-5 min-w-0">
            <Panel title={t('batch.account')}>
              <div className="flex flex-col gap-4">
                <SavedAccountsStrip activeKey={`${form.bin}:${form.accountNumber}`} onPick={(a) => setForm(formFromAccount(a))} />
                <AccountFields form={form} onChange={(p) => setForm((f) => ({...f, ...p}))} showErrors={Boolean(form.accountNumber)} errors={{}} />
              </div>
            </Panel>
            <Panel>
              <div className="flex flex-col gap-4">
                <SegmentedControl label={t('batch.input')} value={mode} onChange={(v) => setMode(v as typeof mode)} layout="fill">
                  <SegmentedControlItem value="paste" label={t('batch.input').split('(')[0].trim()} />
                  <SegmentedControlItem value="sequence" label={t('batch.sequence')} />
                </SegmentedControl>
                {mode === 'paste' ? (
                  <>
                    <TextArea label={t('batch.input')} value={text} onChange={setText} rows={8} description={t('batch.inputHint')} hasSpellCheck={false} placeholder={'150000\tPhong 101\tPhòng 101'} />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button label={t('batch.sample')} size="sm" variant="ghost" icon={<Wand2 size={15} />} onClick={() => setText(SAMPLE)} />
                      <span className="text-xs text-secondary">{t('batch.limit', {max: MAX_ROWS})}</span>
                    </div>
                  </>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <TextInput label={t('batch.seqPrefix')} value={seq.prefix} onChange={(prefix) => setSeq((s) => ({...s, prefix}))} />
                    <TextInput label={t('batch.seqAmount')} value={seq.amount} onChange={(amount) => setSeq((s) => ({...s, amount}))} />
                    <NumberInput label={t('batch.seqFrom')} value={seq.from} onChange={(from) => setSeq((s) => ({...s, from}))} isIntegerOnly />
                    <NumberInput label={t('batch.seqTo')} value={seq.to} onChange={(to) => setSeq((s) => ({...s, to}))} isIntegerOnly />
                    <div className="sm:col-span-2">
                      <Button label={t('batch.generate')} variant="primary" icon={<Wand2 size={16} />} onClick={generateSequence} />
                    </div>
                  </div>
                )}
                {!accountOk && <p className="text-sm text-warning">{t('batch.noAccount')}</p>}
              </div>
            </Panel>
          </div>

          <div className="flex flex-col gap-5 min-w-0">
            <Panel>
              <div className="flex flex-col gap-4">
                <TemplatePicker value={template} onChange={setTemplate} />
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 text-success font-semibold">
                    <CircleCheck size={15} aria-hidden /> {t('batch.valid', {count: valid.length})}
                  </span>
                  {rows.length - valid.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-error font-semibold">
                      <CircleAlert size={15} aria-hidden /> {t('batch.invalid', {count: rows.length - valid.length})}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button label={t('batch.downloadZip', {count: scenes.length})} variant="primary" icon={<FileArchive size={16} />} isDisabled={!scenes.length || Boolean(progress)} clickAction={downloadZip} />
                  <SegmentedControl label={t('batch.layout')} value={layout} onChange={(v) => setLayout(v as typeof layout)} size="sm">
                    {LAYOUTS.map((l) => (
                      <SegmentedControlItem key={l.id} value={l.id} label={l.label} />
                    ))}
                  </SegmentedControl>
                  <Button label={t('batch.printLabels')} icon={<Printer size={16} />} isDisabled={!scenes.length} clickAction={print} />
                </div>
                {progress && <ProgressBar label={t('batch.zipping', {done: progress.done, total: progress.total})} value={progress.done} max={progress.total} />}
              </div>
            </Panel>
            {rows.length > 0 && (
              <Panel>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {rows.map((r) => {
                    const sc = scenes.find((s) => s.row.n === r.n)
                    return (
                      <li key={r.n} className={`rounded-lg border p-2 ${r.error ? 'border-error bg-error-muted/30' : 'border-border'}`}>
                        {sc ? <SceneThumb scene={sc.scene} /> : <div className="aspect-square grid place-items-center text-xs text-error p-2 text-center">{t('gen.invalid.amount')}</div>}
                        <div className="mt-1.5 text-xs">
                          <div className="font-semibold truncate">{r.label || t('batch.row', {n: r.n})}</div>
                          <div className="text-secondary truncate">{r.amount ? formatVnd(r.amount, true) : '—'}</div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      </PageBody>
    </>
  )
}

function SceneThumb({scene}: {scene: Scene}) {
  const svg = useMemo(() => sceneToSvg(scene, {idPrefix: `t${Math.random().toString(36).slice(2, 7)}`}), [scene])
  return <div className="qv-preview [&_svg]:!filter-none" aria-hidden dangerouslySetInnerHTML={{__html: svg}} />
}
