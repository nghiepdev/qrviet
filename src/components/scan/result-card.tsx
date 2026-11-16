import {useState} from 'react'
import {useNavigate} from '@tanstack/react-router'
import {
  BookmarkPlus,
  CalendarDays,
  ExternalLink,
  FileText,
  Link2,
  Mail,
  MapPin,
  MessageSquare,
  PencilLine,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  Wifi,
} from 'lucide-react'
import {Badge} from '@astryxdesign/core/Badge'
import {Button} from '@astryxdesign/core/Button'
import {Collapsible} from '@astryxdesign/core/Collapsible'
import {IconButton} from '@astryxdesign/core/IconButton'
import {useToast} from '@astryxdesign/core/Toast'
import {AdaptiveSheet} from '#/components/common/adaptive-sheet'
import {CopyField} from '#/components/common/copy-field'
import {BankLogo} from '#/components/bank/bank-logo'
import {BankAppLauncher} from '#/components/pay/bank-app-launcher'
import {TlvTable} from '#/components/vietqr/tlv-table'
import {classifyPayload, contactToVCard, type Classified} from '#/lib/payloads'
import type {ParsedVietQr} from '#/lib/vietqr'
import {amountToWords, formatVnd} from '#/lib/money'
import {downloadText} from '#/lib/qr/export'
import {getBankByBin} from '#/data/banks'
import {findDuplicate, saveAccount} from '#/stores/accounts'
import {useLocale, useT, type MessageKey} from '#/i18n'
import {useCopy} from '#/hooks/use-copy'

export interface ScanResult {
  id: string
  text: string
  at: number
  source: 'camera' | 'image' | 'text' | 'share'
}

const TYPE_ICON: Record<string, typeof Link2> = {
  url: Link2,
  wifi: Wifi,
  vcard: UserRound,
  email: Mail,
  phone: Phone,
  sms: MessageSquare,
  geo: MapPin,
  event: CalendarDays,
  text: FileText,
}

export function ResultCard({result, onRemove}: {result: ScanResult; onRemove?: () => void}) {
  const classified = classifyPayload(result.text)
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 animate-qv-rise">
      {classified.type === 'emv' && classified.emv.kind === 'vietqr' ? (
        <VietQrResult parsed={classified.emv} onRemove={onRemove} />
      ) : (
        <GenericResult classified={classified} raw={result.text} onRemove={onRemove} />
      )}
    </article>
  )
}

function CrcBadge({valid, present}: {valid: boolean; present: boolean}) {
  const t = useT()
  if (!present) return <Badge variant="neutral" label={t('scan.crcMissing')} />
  return valid ? (
    <Badge variant="success" label={t('scan.crcOk')} icon={<ShieldCheck size={12} />} />
  ) : (
    <Badge variant="error" label={t('scan.crcBad')} icon={<ShieldAlert size={12} />} />
  )
}

export function VietQrResult({
  parsed,
  onRemove,
  compact,
}: {
  parsed: ParsedVietQr
  onRemove?: () => void
  compact?: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const navigate = useNavigate()
  const showToast = useToast()
  const copy = useCopy()
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [launcherKey, setLauncherKey] = useState(0)
  const bank = getBankByBin(parsed.bin)
  const amount = parsed.amount ? Number(parsed.amount) : 0

  const reissue = () =>
    void navigate({
      to: '/',
      search: {
        bank: parsed.bin,
        acc: parsed.accountNumber,
        name: parsed.merchantName || undefined,
        amount: parsed.amount || undefined,
        memo: parsed.purpose || undefined,
        card: parsed.service === 'card' ? true : undefined,
      },
    })

  const save = () => {
    const dup = findDuplicate(parsed.bin, parsed.accountNumber)
    if (dup) {
      showToast({body: t('acc.duplicate'), uniqueID: 'scan-save'})
      return
    }
    saveAccount({
      bin: parsed.bin,
      accountNumber: parsed.accountNumber,
      accountName: parsed.merchantName,
      nickname: '',
      service: parsed.service === 'card' ? 'card' : 'account',
    })
    showToast({body: t('gen.accountSaved'), uniqueID: 'scan-save'})
  }

  const openLauncher = () => {
    setLauncherKey((k) => k + 1)
    setLauncherOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <BankLogo bank={bank} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold">{t('scan.vietqr')}</span>
            <Badge
              variant={parsed.initiation === 'dynamic' ? 'blue' : 'neutral'}
              label={parsed.initiation === 'dynamic' ? t('scan.dynamic') : t('scan.static')}
            />
            <CrcBadge valid={parsed.crc.valid} present={parsed.crc.present} />
          </div>
          <div className="text-sm text-secondary truncate">
            {bank ? `${bank.shortName} · ${bank.name}` : t('scan.unknownBank', {bin: parsed.bin})}
          </div>
        </div>
        {onRemove && (
          <IconButton
            label={t('common.delete')}
            icon={<Trash2 size={16} />}
            variant="ghost"
            size="sm"
            onClick={onRemove}
          />
        )}
      </div>
      <div>
        <CopyField
          label={parsed.service === 'card' ? t('gen.card') : t('gen.account')}
          value={parsed.accountNumber}
          mono
        />
        {parsed.merchantName && (
          <CopyField label={t('gen.accountName')} value={parsed.merchantName} />
        )}
        {amount > 0 && (
          <CopyField
            label={`${t('gen.amount')} · ${amountToWords(amount, locale)}`}
            value={parsed.amount}
            display={formatVnd(amount, true)}
            emphasize
          />
        )}
        {parsed.purpose && <CopyField label={t('gen.purpose')} value={parsed.purpose} />}
        {parsed.billNumber && <CopyField label={t('gen.billNumber')} value={parsed.billNumber} />}
        {parsed.referenceLabel && (
          <CopyField label={t('gen.reference')} value={parsed.referenceLabel} />
        )}
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-2">
          <Button
            label={t('scan.openBankApp')}
            icon={<Smartphone size={16} />}
            variant="primary"
            size="sm"
            onClick={openLauncher}
          />
          <Button
            label={t('scan.reissue')}
            icon={<PencilLine size={16} />}
            size="sm"
            onClick={reissue}
          />
          <Button
            label={t('scan.saveAccount')}
            icon={<BookmarkPlus size={16} />}
            size="sm"
            onClick={save}
          />
          <Button
            label={t('gen.copyPayload')}
            size="sm"
            variant="ghost"
            onClick={() => void copy(parsed.raw)}
          />
        </div>
      )}
      <Collapsible trigger={<span className="text-sm font-semibold">{t('scan.rawFields')}</span>}>
        <div className="pt-2">
          <TlvTable fields={parsed.fields} />
        </div>
      </Collapsible>
      {!compact && launcherKey > 0 && (
        <AdaptiveSheet
          key={launcherKey}
          isOpen={launcherOpen}
          onOpenChange={setLauncherOpen}
          title={t('pay.openAppTitle')}
          subtitle={t('pay.openAppSubtitle')}
          width={520}
        >
          <BankAppLauncher
            framed={false}
            payment={{
              bin: parsed.bin,
              accountNumber: parsed.accountNumber,
              accountName: parsed.merchantName || undefined,
              amount: parsed.amount || undefined,
              purpose: parsed.purpose || undefined,
              service: parsed.service,
              rawPayload: parsed.raw,
            }}
          />
        </AdaptiveSheet>
      )}
    </div>
  )
}

function GenericResult({
  classified,
  raw,
  onRemove,
}: {
  classified: Classified
  raw: string
  onRemove?: () => void
}) {
  const t = useT()
  const copy = useCopy()
  const type =
    classified.type === 'emv' || classified.type === 'emv-invalid' ? 'text' : classified.type
  const Icon = TYPE_ICON[type] ?? FileText
  const title: string =
    classified.type === 'emv'
      ? t('scan.emv')
      : classified.type === 'emv-invalid'
        ? t('scan.emvInvalid')
        : t(`scan.type.${classified.type}` as MessageKey)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          className="grid place-items-center size-10 rounded-lg bg-accent-muted text-accent shrink-0"
          aria-hidden
        >
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">{title}</div>
          {classified.type === 'emv' && (
            <CrcBadge valid={classified.emv.crc.valid} present={classified.emv.crc.present} />
          )}
        </div>
        {onRemove && (
          <IconButton
            label={t('common.delete')}
            icon={<Trash2 size={16} />}
            variant="ghost"
            size="sm"
            onClick={onRemove}
          />
        )}
      </div>

      {classified.type === 'url' && (
        <>
          <CopyField label={t('scan.type.url')} value={classified.url} />
          <p className="text-xs text-secondary flex items-center gap-1.5">
            <ShieldAlert size={13} aria-hidden /> {t('scan.unsafeLink')}
          </p>
          <div>
            <Button
              label={t('scan.openLink')}
              icon={<ExternalLink size={16} />}
              variant="primary"
              size="sm"
              href={classified.url}
              target="_blank"
              rel="noopener noreferrer"
            />
          </div>
        </>
      )}
      {classified.type === 'wifi' && (
        <div>
          <CopyField label={t('scan.network')} value={classified.wifi.ssid} />
          <CopyField label={t('scan.password')} value={classified.wifi.password} mono />
          <CopyField
            label={t('scan.security')}
            value={
              classified.wifi.security === 'nopass' ? t('qr.wifi.none') : classified.wifi.security
            }
          />
          {classified.wifi.hidden && <Badge variant="neutral" label={t('scan.hidden')} />}
        </div>
      )}
      {classified.type === 'vcard' && (
        <>
          <div>
            {classified.fields.map(([k, v], i) => (
              <CopyField
                key={`${k}-${i}`}
                label={t(
                  `qr.vcard.${k === 'name' ? 'firstName' : k === 'phone' ? 'mobile' : k}` as MessageKey,
                )}
                value={v}
              />
            ))}
          </div>
          <div>
            <Button
              label={t('scan.downloadContact')}
              icon={<UserRound size={16} />}
              size="sm"
              variant="primary"
              onClick={() =>
                downloadText(
                  /^BEGIN:VCARD/i.test(raw.trim())
                    ? raw
                    : contactToVCard(classified.fields, classified.name),
                  `${classified.name || 'contact'}.vcf`,
                  'text/vcard;charset=utf-8',
                )
              }
            />
          </div>
        </>
      )}
      {classified.type === 'email' && (
        <>
          <CopyField label={t('qr.email.to')} value={classified.to} />
          <CopyField label={t('qr.email.subject')} value={classified.subject} />
          <CopyField label={t('qr.email.body')} value={classified.body} />
          <div>
            <Button
              label={t('scan.sendEmail')}
              icon={<Mail size={16} />}
              size="sm"
              variant="primary"
              href={`mailto:${classified.to}?subject=${encodeURIComponent(classified.subject)}&body=${encodeURIComponent(classified.body)}`}
            />
          </div>
        </>
      )}
      {classified.type === 'phone' && (
        <>
          <CopyField label={t('qr.phone')} value={classified.phone} mono />
          <div>
            <Button
              label={t('scan.call')}
              icon={<Phone size={16} />}
              size="sm"
              variant="primary"
              href={`tel:${classified.phone}`}
            />
          </div>
        </>
      )}
      {classified.type === 'sms' && (
        <>
          <CopyField label={t('qr.sms.phone')} value={classified.phone} mono />
          <CopyField label={t('qr.sms.message')} value={classified.message} />
          <div>
            <Button
              label={t('scan.sendSms')}
              icon={<MessageSquare size={16} />}
              size="sm"
              variant="primary"
              href={`sms:${classified.phone}?body=${encodeURIComponent(classified.message)}`}
            />
          </div>
        </>
      )}
      {classified.type === 'geo' && (
        <>
          <CopyField
            label={`${t('qr.geo.lat')}, ${t('qr.geo.lng')}`}
            value={`${classified.lat},${classified.lng}`}
            mono
          />
          {classified.query && <CopyField label={t('qr.geo.label')} value={classified.query} />}
          <div>
            <Button
              label={t('scan.openMap')}
              icon={<MapPin size={16} />}
              size="sm"
              variant="primary"
              href={`https://www.google.com/maps/search/?api=1&query=${classified.lat},${classified.lng}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          </div>
        </>
      )}
      {classified.type === 'event' && (
        <div>
          {classified.title && <CopyField label={t('qr.event.title')} value={classified.title} />}
          {classified.fields.map(([k, v], i) => (
            <CopyField
              key={`${k}-${i}`}
              label={t(
                k === 'start'
                  ? 'qr.event.start'
                  : k === 'end'
                    ? 'qr.event.end'
                    : k === 'location'
                      ? 'qr.event.location'
                      : 'qr.event.description',
              )}
              value={v}
            />
          ))}
        </div>
      )}
      {classified.type === 'emv' && (
        <>
          {classified.emv.kind === 'emv' && classified.emv.schemes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {classified.emv.schemes.map((s) => (
                <Badge key={s} variant="neutral" label={s} />
              ))}
            </div>
          )}
          <TlvTable fields={classified.emv.fields} />
        </>
      )}
      {(classified.type === 'text' || classified.type === 'emv-invalid') && (
        <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap wrap-break-word max-h-64 overflow-auto">
          {raw}
        </div>
      )}
      {classified.type === 'emv-invalid' && (
        <p className="text-xs text-error">{classified.error}</p>
      )}
      <div>
        <Button label={t('common.copy')} size="sm" variant="ghost" onClick={() => void copy(raw)} />
      </div>
    </div>
  )
}
