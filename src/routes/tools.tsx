import {useMemo, useState} from 'react'
import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {Calculator, Copy, Eraser, FileSearch, Hash, QrCode, Users, Wrench} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {NumberInput} from '@astryxdesign/core/NumberInput'
import {Switch} from '@astryxdesign/core/Switch'
import {TextArea} from '@astryxdesign/core/TextArea'
import {TextInput} from '@astryxdesign/core/TextInput'
import {Badge} from '@astryxdesign/core/Badge'
import {PageBody, PageHeader, Panel} from '#/components/common/PageHeader'
import {VietQrResult} from '#/components/scan/ResultCard'
import {TlvTable} from '#/components/vietqr/TlvTable'
import {checkCrc, crc16ccitt, repairCrc} from '#/lib/emv'
import {looksLikeEmv, parseEmvQr} from '#/lib/vietqr'
import {amountToEnglishWords, amountToVietnameseWords, formatVnd, parseAmount} from '#/lib/money'
import {sanitizeTransferContent} from '#/lib/text'
import {useCopy} from '#/hooks/useCopy'
import {useT} from '#/i18n'

export const Route = createFileRoute('/tools')({component: ToolsPage})

function ToolsPage() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('tools.title')} subtitle={t('tools.subtitle')} icon={<Wrench size={22} />} />
      <PageBody>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
          <div className="lg:col-span-2">
            <InspectTool />
          </div>
          <WordsTool />
          <SplitTool />
          <CleanTool />
          <CrcTool />
        </div>
      </PageBody>
    </>
  )
}

function InspectTool() {
  const t = useT()
  const copy = useCopy()
  const [input, setInput] = useState('')
  const raw = input.trim()
  const result = useMemo(() => {
    if (!raw || !looksLikeEmv(raw)) return null
    try {
      return {parsed: parseEmvQr(raw), error: null}
    } catch (e) {
      return {parsed: null, error: (e as Error).message}
    }
  }, [raw])
  const crc = raw ? checkCrc(raw) : null
  const fixCrc = () => {
    const fixed = repairCrc(raw)
    if (fixed) setInput(fixed)
  }
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><FileSearch size={18} aria-hidden />{t('tools.inspect')}</span>} description={t('tools.inspectBody')}>
      <div className="flex flex-col gap-4">
        <TextArea label={t('tools.input')} isLabelHidden value={input} onChange={setInput} rows={3} placeholder="00020101021238…6304XXXX" hasSpellCheck={false} />
        {raw && !looksLikeEmv(raw) && <p className="text-sm text-warning">{t('scan.emvInvalid')}</p>}
        {crc && looksLikeEmv(raw) && (
          <div className="flex flex-wrap items-center gap-2">
            {crc.present && crc.valid ? (
              <Badge variant="success" label={`${t('scan.crcOk')} · ${crc.actual}`} />
            ) : (
              <>
                <Badge variant="error" label={crc.present ? `${t('scan.crcBad')} (${crc.actual} ≠ ${crc.expected})` : t('scan.crcMissing')} />
                <Button label={t('tools.fixCrc')} size="sm" onClick={fixCrc} />
              </>
            )}
            <Button label={t('common.copy')} size="sm" variant="ghost" icon={<Copy size={14} />} onClick={() => void copy(raw)} />
          </div>
        )}
        {result?.error && <p className="text-sm text-error">{result.error}</p>}
        {result?.parsed?.kind === 'vietqr' && <VietQrResult parsed={result.parsed} />}
        {result?.parsed?.kind === 'emv' && <TlvTable fields={result.parsed.fields} />}
      </div>
    </Panel>
  )
}

function WordsTool() {
  const t = useT()
  const copy = useCopy()
  const [value, setValue] = useState('1.250.000')
  const amount = parseAmount(value)
  const vi = amount !== null ? amountToVietnameseWords(amount) : ''
  const en = amount !== null ? amountToEnglishWords(amount) : ''
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><Calculator size={18} aria-hidden />{t('tools.words')}</span>} description={t('tools.wordsBody')}>
      <div className="flex flex-col gap-3">
        <TextInput label={t('gen.amount')} value={value} onChange={setValue} placeholder={t('gen.amountPlaceholder')} hasClear />
        {amount !== null && (
          <>
            <div className="text-2xl font-extrabold text-accent qv-num">{formatVnd(amount, true)}</div>
            {[vi, en].map((w) => (
              <div key={w} className="flex items-start gap-2 rounded-md bg-muted px-3 py-2">
                <span className="flex-1">{w}</span>
                <Button label={t('common.copy')} isIconOnly icon={<Copy size={14} />} size="sm" variant="ghost" onClick={() => void copy(w)} />
              </div>
            ))}
          </>
        )}
      </div>
    </Panel>
  )
}

function CleanTool() {
  const t = useT()
  const copy = useCopy()
  const [value, setValue] = useState('Chuyển tiền ăn trưa #12 (team Đà Nẵng)!')
  const [strict, setStrict] = useState(false)
  const out = sanitizeTransferContent(value, strict ? 'strict' : 'relaxed').trim()
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><Eraser size={18} aria-hidden />{t('tools.clean')}</span>} description={t('tools.cleanBody')}>
      <div className="flex flex-col gap-3">
        <TextArea label={t('tools.input')} value={value} onChange={setValue} rows={2} />
        <Switch label={t('tools.strict')} value={strict} onChange={setStrict} size="sm" />
        <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2">
          <span className="flex-1 qv-mono text-sm break-all">{out || '—'}</span>
          <span className="text-xs text-secondary qv-num shrink-0">{out.length}</span>
          <Button label={t('common.copy')} isIconOnly icon={<Copy size={14} />} size="sm" variant="ghost" onClick={() => void copy(out)} />
        </div>
      </div>
    </Panel>
  )
}

function SplitTool() {
  const t = useT()
  const navigate = useNavigate()
  const [total, setTotal] = useState('1.200.000')
  const [people, setPeople] = useState(4)
  const [tip, setTip] = useState(0)
  const amount = parseAmount(total) ?? 0
  const withTip = amount * (1 + tip / 100)
  const each = people > 0 ? Math.ceil(withTip / people / 1000) * 1000 : 0
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><Users size={18} aria-hidden />{t('tools.split')}</span>} description={t('tools.splitBody')}>
      <div className="flex flex-col gap-3">
        <TextInput label={t('tools.splitTotal')} value={total} onChange={setTotal} hasClear />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label={t('tools.splitPeople')} value={people} onChange={(v) => setPeople(Math.max(1, Math.min(100, v || 1)))} min={1} max={100} isIntegerOnly hasNumberSteppers />
          <NumberInput label={t('tools.splitTip')} value={tip} onChange={(v) => setTip(Math.max(0, Math.min(50, v || 0)))} min={0} max={50} units="%" hasNumberSteppers />
        </div>
        <div className="rounded-lg bg-accent-muted/50 px-4 py-3">
          <div className="text-sm text-secondary">{t('tools.splitEach')}</div>
          <div className="text-2xl font-extrabold text-accent qv-num">{formatVnd(each, true)}</div>
        </div>
        <div>
          <Button
            label={t('tools.splitCreate')}
            icon={<QrCode size={16} />}
            variant="primary"
            isDisabled={!each}
            onClick={() => void navigate({to: '/', search: {amount: String(each), memo: 'Chia tien'}})}
          />
        </div>
      </div>
    </Panel>
  )
}

function CrcTool() {
  const t = useT()
  const copy = useCopy()
  const [value, setValue] = useState('123456789')
  const crc = crc16ccitt(value)
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><Hash size={18} aria-hidden />{t('tools.crc')}</span>} description="CRC-16/CCITT-FALSE (0x1021, init 0xFFFF)">
      <div className="flex flex-col gap-3">
        <TextArea label={t('tools.input')} value={value} onChange={setValue} rows={2} hasSpellCheck={false} />
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
          <span className="flex-1 qv-mono text-lg font-bold">{crc}</span>
          <Button label={t('common.copy')} isIconOnly icon={<Copy size={14} />} size="sm" variant="ghost" onClick={() => void copy(crc)} />
        </div>
      </div>
    </Panel>
  )
}
