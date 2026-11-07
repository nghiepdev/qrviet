import {useRef, useState} from 'react'
import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {BookUser, Copy, Download, MoreHorizontal, Pencil, Plus, QrCode, Star, Trash2, Upload} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {DropdownMenu} from '@astryxdesign/core/DropdownMenu'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {TextInput} from '@astryxdesign/core/TextInput'
import {Badge} from '@astryxdesign/core/Badge'
import {useToast} from '@astryxdesign/core/Toast'
import {PageBody, PageHeader, Panel} from '#/components/common/page-header'
import {AdaptiveSheet} from '#/components/common/adaptive-sheet'
import {BankLogo} from '#/components/bank/bank-logo'
import {AccountFields} from '#/components/vietqr/account-fields'
import {EMPTY_FORM, type VietQrForm} from '#/components/vietqr/form'
import {getBankByBin} from '#/data/banks'
import {
  ACCOUNT_COLORS,
  findDuplicate,
  importAccounts,
  removeAccount,
  restoreAccount,
  saveAccount,
  setDefaultAccount,
  useAccounts,
  type SavedAccount,
} from '#/stores/accounts'
import {validateVietQr} from '#/lib/vietqr'
import {downloadText} from '#/lib/qr/export'
import {groupDigits} from '#/lib/text'
import {useCopy} from '#/hooks/use-copy'
import {useT} from '#/i18n'
import {pageHead} from '#/seo/head'
import {sheetUnlessAnchored} from '#/app/anchoring'

export const Route = createFileRoute('/accounts')({
  head: () => pageHead('accounts'),
  component: AccountsPage,
})

/** Imports an exported accounts file; the number added, or null when the file is not valid. */
async function importAccountsFile(file: File): Promise<number | null> {
  try {
    const data = JSON.parse(await file.text())
    return importAccounts(Array.isArray(data) ? data : data.accounts)
  } catch {
    return null
  }
}

interface Editing {
  id?: string
  form: VietQrForm
  nickname: string
  color: string
}

function AccountsPage() {
  const t = useT()
  const accounts = useAccounts()
  const navigate = useNavigate()
  const showToast = useToast()
  const copy = useCopy()
  // The editor stays mounted after it closes, so its sheet can animate out. Every open gets a new
  // key, which starts the editor's own form state from `value`.
  const [editing, setEditing] = useState<{key: number; value: Editing} | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const defaultId = accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id

  const startEditing = (value: Editing) => {
    setEditing((prev) => ({key: (prev?.key ?? 0) + 1, value}))
    setEditorOpen(true)
  }
  const openNew = () => startEditing({form: {...EMPTY_FORM}, nickname: '', color: ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length]})
  const openEdit = (a: SavedAccount) =>
    startEditing({id: a.id, form: {...EMPTY_FORM, bin: a.bin, accountNumber: a.accountNumber, accountName: a.accountName, service: a.service}, nickname: a.nickname, color: a.color})

  const remove = (a: SavedAccount) => {
    const removed = removeAccount(a.id)
    showToast({
      body: t('common.deleted'),
      uniqueID: `del-${a.id}`,
      endContent: removed ? <Button label={t('common.undo')} size="sm" variant="ghost" onClick={() => restoreAccount(removed)} /> : undefined,
    })
  }

  const exportFile = () => downloadText(JSON.stringify({app: 'qrviet', kind: 'accounts', version: 1, accounts}, null, 2), 'qrviet-accounts.json', 'application/json')

  const importFile = async (file: File | undefined) => {
    if (!file) return
    const count = await importAccountsFile(file)
    if (count === null) showToast({body: t('acc.importFailed'), type: 'error', uniqueID: 'import'})
    else showToast({body: t('acc.imported', {count}), uniqueID: 'import'})
  }

  return (
    <>
      <PageHeader
        title={t('acc.title')}
        subtitle={t('acc.subtitle')}
        icon={<BookUser size={22} />}
        actions={
          <>
            <Button label={t('acc.add')} icon={<Plus size={16} />} variant="primary" onClick={openNew} />
            <DropdownMenu
              button={{label: t('common.more'), isIconOnly: true, icon: <MoreHorizontal size={18} />, variant: 'secondary'}}
              hasChevron={false}
              presentation={sheetUnlessAnchored('popover')}
              items={[
                {label: t('acc.importJson'), icon: <Upload size={16} />, onClick: () => fileRef.current?.click()},
                {label: t('acc.exportJson'), icon: <Download size={16} />, onClick: exportFile, isDisabled: !accounts.length},
              ]}
            />
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void importFile(e.target.files?.[0])} />
          </>
        }
      />
      <PageBody>
        {accounts.length === 0 ? (
          <Panel hue="green">
            <EmptyState
              icon={<BookUser size={40} aria-hidden />}
              title={t('acc.empty')}
              description={t('acc.emptyBody')}
              actions={
                <>
                  <Button label={t('acc.add')} variant="primary" icon={<Plus size={16} />} onClick={openNew} />
                  <Button label={t('nav.scan')} href="/scan" />
                </>
              }
            />
          </Panel>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((a) => {
              const bank = getBankByBin(a.bin)
              return (
                <li key={a.id} className="animate-qv-rise">
                  <article className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
                    <div
                      className="h-24 px-4 pt-3 flex items-start justify-between text-white"
                      style={{background: `linear-gradient(135deg, ${a.color}, color-mix(in srgb, ${a.color} 55%, #000))`}}>
                      <div className="min-w-0">
                        <div className="text-xs opacity-85 truncate">{bank?.shortName ?? a.bin}</div>
                        <div className="font-bold text-lg truncate">{a.nickname || a.accountName || bank?.shortName}</div>
                      </div>
                      {a.id === defaultId && <Badge variant="yellow" label={t('acc.default')} icon={<Star size={11} />} />}
                    </div>
                    <div className="absolute right-4 top-14">
                      <BankLogo bank={bank} size={40} className="shadow-md" />
                    </div>
                    <div className="p-4 pt-3 flex flex-col gap-3">
                      <div>
                        <div className="qv-mono text-lg font-semibold tracking-wide">{groupDigits(a.accountNumber)}</div>
                        <div className="text-sm text-secondary truncate">{a.accountName || '—'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button label={t('acc.createQr')} icon={<QrCode size={16} />} variant="primary" size="sm" onClick={() => void navigate({to: '/', search: {account: a.id}})} />
                        <Button label={t('acc.copyAccount')} isIconOnly icon={<Copy size={16} />} size="sm" variant="ghost" tooltip={t('acc.copyAccount')} onClick={() => void copy(a.accountNumber)} />
                        <span className="ml-auto">
                          <DropdownMenu
                            button={{label: t('common.more'), isIconOnly: true, icon: <MoreHorizontal size={16} />, variant: 'ghost', size: 'sm'}}
                            hasChevron={false}
                            presentation={sheetUnlessAnchored('popover')}
                            items={[
                              {label: t('common.edit'), icon: <Pencil size={15} />, onClick: () => openEdit(a)},
                              ...(a.id !== defaultId ? [{label: t('acc.setDefault'), icon: <Star size={15} />, onClick: () => setDefaultAccount(a.id)}] : []),
                              {type: 'divider' as const},
                              {label: t('common.delete'), icon: <Trash2 size={15} />, variant: 'destructive' as const, onClick: () => remove(a)},
                            ]}
                          />
                        </span>
                      </div>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </PageBody>
      {editing && <AccountEditor key={editing.key} editing={editing.value} isOpen={editorOpen} onOpenChange={setEditorOpen} />}
    </>
  )
}

function AccountEditor({editing, isOpen, onOpenChange}: {editing: Editing; isOpen: boolean; onOpenChange: (open: boolean) => void}) {
  const t = useT()
  const showToast = useToast()
  const [state, setState] = useState(editing)
  const issues = validateVietQr({bin: state.form.bin, accountNumber: state.form.accountNumber}).filter((i) => i.severity === 'error')
  const errors = {
    bin: issues.some((i) => i.field === 'bin') ? ('gen.invalid.bin' as const) : undefined,
    accountNumber: issues.find((i) => i.field === 'accountNumber') ? ('gen.invalid.account' as const) : undefined,
  }
  const [tried, setTried] = useState(false)
  const close = () => onOpenChange(false)

  const submit = () => {
    setTried(true)
    if (issues.length) return
    const dup = findDuplicate(state.form.bin, state.form.accountNumber, state.id)
    if (dup) {
      showToast({body: t('acc.duplicate'), type: 'error', uniqueID: 'dup'})
      return
    }
    saveAccount({
      id: state.id,
      bin: state.form.bin,
      accountNumber: state.form.accountNumber,
      accountName: state.form.accountName,
      nickname: state.nickname.trim(),
      service: state.form.service,
      color: state.color,
    })
    showToast({body: t('common.saved'), uniqueID: 'acc-save'})
    close()
  }

  return (
    <AdaptiveSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={state.id ? t('acc.edit') : t('acc.add')}
      footer={
        <div className="flex justify-end gap-2">
          <Button label={t('common.cancel')} variant="ghost" onClick={close} />
          <Button label={t('common.save')} variant="primary" onClick={submit} />
        </div>
      }>
      <div className="flex flex-col gap-4">
        <AccountFields form={state.form} onChange={(p) => setState((s) => ({...s, form: {...s.form, ...p}}))} errors={errors} showErrors={tried} />
        <TextInput label={t('acc.nickname')} value={state.nickname} onChange={(nickname) => setState((s) => ({...s, nickname}))} placeholder={t('acc.nicknamePlaceholder')} isOptional hasClear />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{t('acc.color')}</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('acc.color')}>
            {ACCOUNT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={state.color === c}
                aria-label={c}
                onClick={() => setState((s) => ({...s, color: c}))}
                className="qv-tile size-9 rounded-full p-1">
                <span className="block size-full rounded-full" style={{background: c}} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </AdaptiveSheet>
  )
}
