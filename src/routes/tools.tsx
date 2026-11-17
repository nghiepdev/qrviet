import {parseToolsSearch, type ToolId, rawLocationHash} from '#/lib/route-search'
import {useEffect, useState, type ReactNode} from 'react'
import {createFileRoute, useNavigate, useLocation} from '@tanstack/react-router'
import {
  Calculator,
  Copy,
  Eraser,
  FileSearch,
  Hash,
  QrCode,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {NumberInput} from '@astryxdesign/core/NumberInput'
import {Switch} from '@astryxdesign/core/Switch'
import {TextArea} from '@astryxdesign/core/TextArea'
import {TextInput} from '@astryxdesign/core/TextInput'
import {Badge} from '@astryxdesign/core/Badge'
import {PageBody, PageHeader, Panel} from '#/components/common/page-header'
import type {Hue} from '#/components/common/icon-badge'
import {VietQrResult} from '#/components/scan/result-card'
import {TlvTable} from '#/components/vietqr/tlv-table'
import {checkCrc, crc16ccitt, repairCrc} from '#/lib/emv'
import {buildVietQr, looksLikeEmv, parseEmvQr} from '#/lib/vietqr'
import {amountToEnglishWords, amountToVietnameseWords, formatVnd, parseAmount} from '#/lib/money'
import {sanitizeTransferContent} from '#/lib/text'
import {useCopy} from '#/hooks/use-copy'
import {useMasonry} from '#/hooks/use-masonry'
import {useT, type MessageKey} from '#/i18n'
import {pageHead} from '#/seo/head'

export const Route = createFileRoute('/tools')({
  head: () => pageHead('tools'),
  validateSearch: parseToolsSearch,
  component: ToolsPage,
})

const TOOLS: ReadonlyArray<{
  id: ToolId
  icon: LucideIcon
  hue: Hue
  title: MessageKey
  body: MessageKey
}> = [
  {id: 'inspect', icon: FileSearch, hue: 'blue', title: 'tools.inspect', body: 'tools.inspectBody'},
  {id: 'words', icon: Calculator, hue: 'green', title: 'tools.words', body: 'tools.wordsBody'},
  {id: 'split', icon: Users, hue: 'violet', title: 'tools.split', body: 'tools.splitBody'},
  {id: 'clean', icon: Eraser, hue: 'amber', title: 'tools.clean', body: 'tools.cleanBody'},
  {id: 'crc', icon: Hash, hue: 'cyan', title: 'tools.crc', body: 'tools.crcBody'},
]

const toolById = (id: ToolId) => TOOLS.find((tool) => tool.id === id)!

function ToolsPage() {
  const t = useT()
  const masonry = useMasonry<HTMLDivElement>()
  const hash = useLocation({select: rawLocationHash})
  const search = parseToolsSearch(Route.useSearch(), hash)

  useEffect(() => {
    if (!search.tool) return
    requestAnimationFrame(() => {
      document.getElementById(search.tool!)?.scrollIntoView({behavior: 'smooth', block: 'start'})
    })
  }, [search.tool])

  return (
    <>
      <PageHeader
        title={t('tools.title')}
        subtitle={t('tools.subtitle')}
        icon={<Wrench size={22} />}
      />
      <PageBody>
        {/* Masonry: each card rises under the one above it rather than below the row's tallest. */}
        <div ref={masonry} className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <InspectTool
              seed={search.tool === 'inspect' || !search.tool ? search.input : undefined}
            />
          </div>
          <WordsTool seed={search.amount ?? (search.tool === 'words' ? search.input : undefined)} />
          <SplitTool seedTotal={search.total} seedPeople={search.people} seedTip={search.tip} />
          <CleanTool seed={search.tool === 'clean' ? search.input : undefined} />
          <CrcTool seed={search.tool === 'crc' ? search.input : undefined} />
        </div>
      </PageBody>
    </>
  )
}

/** A tool's card: the shared Panel in the tool's icon and hue, with its name and what it does. */
function ToolPanel({id, children}: {id: ToolId; children: ReactNode}) {
  const t = useT()
  const tool = toolById(id)
  return (
    <Panel id={id} icon={tool.icon} hue={tool.hue} title={t(tool.title)} description={t(tool.body)}>
      {children}
    </Panel>
  )
}

/** A valid code to try the inspector with. */
const SAMPLE_PAYLOAD = buildVietQr({
  bin: '970436',
  accountNumber: '0071000888999',
  amount: 45000,
  purpose: 'Ca phe sua da',
})

/** Parse result for the inspector; null for empty or non-EMV input. */
function inspectEmv(raw: string) {
  if (!raw || !looksLikeEmv(raw)) return null
  try {
    return {parsed: parseEmvQr(raw), error: null}
  } catch (e) {
    return {parsed: null, error: (e as Error).message}
  }
}

function InspectTool({seed}: {seed?: string}) {
  const t = useT()
  const copy = useCopy()
  const [input, setInput] = useState(seed ?? '')
  useEffect(() => {
    if (seed !== undefined) setInput(seed)
  }, [seed])
  const raw = input.trim()
  const result = inspectEmv(raw)
  const crc = raw ? checkCrc(raw) : null
  const fixCrc = () => {
    const fixed = repairCrc(raw)
    if (fixed) setInput(fixed)
  }
  return (
    <ToolPanel id="inspect">
      <div className="flex flex-col gap-4">
        <TextArea
          label={t('tools.input')}
          isLabelHidden
          value={input}
          onChange={setInput}
          rows={3}
          placeholder="00020101021238…6304XXXX"
          hasSpellCheck={false}
        />
        {!raw && (
          <div className="-mt-2 -ml-3">
            <Button
              label={t('tools.sample')}
              size="sm"
              variant="ghost"
              onClick={() => setInput(SAMPLE_PAYLOAD)}
            />
          </div>
        )}
        {raw && !looksLikeEmv(raw) && (
          <p className="text-sm text-warning">{t('scan.emvInvalid')}</p>
        )}
        {crc && looksLikeEmv(raw) && (
          <div className="flex flex-wrap items-center gap-2">
            {crc.present && crc.valid ? (
              <Badge variant="success" label={`${t('scan.crcOk')} · ${crc.actual}`} />
            ) : (
              <>
                <Badge
                  variant="error"
                  label={
                    crc.present
                      ? `${t('scan.crcBad')} (${crc.actual} ≠ ${crc.expected})`
                      : t('scan.crcMissing')
                  }
                />
                <Button label={t('tools.fixCrc')} size="sm" onClick={fixCrc} />
              </>
            )}
            <Button
              label={t('common.copy')}
              size="sm"
              variant="ghost"
              icon={<Copy size={14} />}
              onClick={() => void copy(raw)}
            />
          </div>
        )}
        {result?.error && <p className="text-sm text-error">{result.error}</p>}
        {result?.parsed?.kind === 'vietqr' && <VietQrResult parsed={result.parsed} />}
        {result?.parsed?.kind === 'emv' && <TlvTable fields={result.parsed.fields} />}
      </div>
    </ToolPanel>
  )
}

function WordsTool({seed}: {seed?: string}) {
  const t = useT()
  const copy = useCopy()
  const [value, setValue] = useState(seed ?? '1.250.000')
  useEffect(() => {
    if (seed !== undefined) setValue(seed)
  }, [seed])
  const amount = parseAmount(value)
  const vi = amount !== null ? amountToVietnameseWords(amount) : ''
  const en = amount !== null ? amountToEnglishWords(amount) : ''
  return (
    <ToolPanel id="words">
      <div className="flex flex-col gap-3">
        <TextInput
          label={t('gen.amount')}
          value={value}
          onChange={setValue}
          placeholder={t('gen.amountPlaceholder')}
          hasClear
        />
        {amount !== null && (
          <>
            <div className="qv-num text-2xl font-extrabold text-accent">
              {formatVnd(amount, true)}
            </div>
            {[vi, en].map((w) => (
              <div key={w} className="flex items-start gap-2 rounded-md bg-muted px-3 py-2">
                <span className="flex-1">{w}</span>
                <Button
                  label={t('common.copy')}
                  isIconOnly
                  icon={<Copy size={14} />}
                  size="sm"
                  variant="ghost"
                  onClick={() => void copy(w)}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </ToolPanel>
  )
}

function CleanTool({seed}: {seed?: string}) {
  const t = useT()
  const copy = useCopy()
  const [value, setValue] = useState(seed ?? 'Chuyển tiền ăn trưa #12 (team Đà Nẵng)!')
  useEffect(() => {
    if (seed !== undefined) setValue(seed)
  }, [seed])
  const [strict, setStrict] = useState(false)
  const out = sanitizeTransferContent(value, strict ? 'strict' : 'relaxed').trim()
  return (
    <ToolPanel id="clean">
      <div className="flex flex-col gap-3">
        <TextArea label={t('tools.input')} value={value} onChange={setValue} rows={2} />
        <Switch label={t('tools.strict')} value={strict} onChange={setStrict} size="sm" />
        <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2">
          <span className="qv-mono flex-1 text-sm break-all">{out || '—'}</span>
          <span className="qv-num shrink-0 text-xs text-secondary">{out.length}</span>
          <Button
            label={t('common.copy')}
            isIconOnly
            icon={<Copy size={14} />}
            size="sm"
            variant="ghost"
            onClick={() => void copy(out)}
          />
        </div>
      </div>
    </ToolPanel>
  )
}

function SplitTool({
  seedTotal,
  seedPeople,
  seedTip,
}: {
  seedTotal?: string
  seedPeople?: number
  seedTip?: number
}) {
  const t = useT()
  const navigate = useNavigate()
  const [total, setTotal] = useState(seedTotal ?? '1.200.000')
  const [people, setPeople] = useState(
    seedPeople !== undefined ? Math.max(1, Math.min(100, Math.round(seedPeople))) : 4,
  )
  const [tip, setTip] = useState(
    seedTip !== undefined ? Math.max(0, Math.min(50, Math.round(seedTip))) : 0,
  )
  useEffect(() => {
    if (seedTotal !== undefined) setTotal(seedTotal)
  }, [seedTotal])
  useEffect(() => {
    if (seedPeople !== undefined) setPeople(Math.max(1, Math.min(100, Math.round(seedPeople))))
  }, [seedPeople])
  useEffect(() => {
    if (seedTip !== undefined) setTip(Math.max(0, Math.min(50, Math.round(seedTip))))
  }, [seedTip])
  const amount = parseAmount(total) ?? 0
  const withTip = amount * (1 + tip / 100)
  const each = people > 0 ? Math.ceil(withTip / people / 1000) * 1000 : 0
  return (
    <ToolPanel id="split">
      <div className="flex flex-col gap-3">
        <TextInput label={t('tools.splitTotal')} value={total} onChange={setTotal} hasClear />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label={t('tools.splitPeople')}
            value={people}
            onChange={(v) => setPeople(Math.max(1, Math.min(100, v || 1)))}
            min={1}
            max={100}
            isIntegerOnly
            hasNumberSteppers
          />
          <NumberInput
            label={t('tools.splitTip')}
            value={tip}
            onChange={(v) => setTip(Math.max(0, Math.min(50, v || 0)))}
            min={0}
            max={50}
            units="%"
            hasNumberSteppers
          />
        </div>
        <div className="rounded-lg bg-accent-muted/50 px-4 py-3">
          <div className="text-sm text-secondary">{t('tools.splitEach')}</div>
          <div className="qv-num text-2xl font-extrabold text-accent">{formatVnd(each, true)}</div>
        </div>
        <div>
          <Button
            label={t('tools.splitCreate')}
            icon={<QrCode size={16} />}
            variant="primary"
            isDisabled={!each}
            onClick={() =>
              void navigate({to: '/', search: {amount: String(each), memo: 'Chia tien'}})
            }
          />
        </div>
      </div>
    </ToolPanel>
  )
}

function CrcTool({seed}: {seed?: string}) {
  const t = useT()
  const copy = useCopy()
  const [value, setValue] = useState(seed ?? '123456789')
  useEffect(() => {
    if (seed !== undefined) setValue(seed)
  }, [seed])
  const crc = crc16ccitt(value)
  return (
    <ToolPanel id="crc">
      <div className="flex flex-col gap-3">
        <TextArea
          label={t('tools.input')}
          value={value}
          onChange={setValue}
          rows={2}
          hasSpellCheck={false}
        />
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
          <span className="qv-mono flex-1 text-lg font-bold">{crc}</span>
          <Button
            label={t('common.copy')}
            isIconOnly
            icon={<Copy size={14} />}
            size="sm"
            variant="ghost"
            onClick={() => void copy(crc)}
          />
        </div>
      </div>
    </ToolPanel>
  )
}
