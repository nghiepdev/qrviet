import {useEffect, useRef, useState} from 'react'
import {createFileRoute} from '@tanstack/react-router'
import {Check, Database, Download, HardDrive, Keyboard, Laptop, Moon, Paintbrush, Palette, QrCode, RefreshCw, Settings as SettingsIcon, Share, Smartphone, Sun, Trash2, Upload} from 'lucide-react'
import {AlertDialog} from '@astryxdesign/core/AlertDialog'
import {Badge} from '@astryxdesign/core/Badge'
import {Button} from '@astryxdesign/core/Button'
import {Kbd} from '@astryxdesign/core/Kbd'
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl'
import {Switch} from '@astryxdesign/core/Switch'
import {Banner} from '@astryxdesign/core/Banner'
import {useToast} from '@astryxdesign/core/Toast'
import {PageBody, PageHeader, Panel} from '#/components/common/page-header'
import {ThemeBuilder} from '#/components/settings/theme-builder'
import {PRESETS, type ThemeRecipe} from '#/theme/presets'
import {FONTS, FONT_IDS} from '#/theme/fonts'
import {updateSettings, useSettings, type ColorMode} from '#/stores/settings'
import {listAppKeys} from '#/lib/persist'
import {clearThumbs} from '#/lib/thumbs'
import {useMasonry} from '#/hooks/use-masonry'
import {downloadText} from '#/lib/qr/export'
import {openIosInstallGuide, promptInstall, useInstallState, useOnline} from '#/app/pwa'
import {useLocale, useT} from '#/i18n'
import {pageHead} from '#/seo/head'

export const Route = createFileRoute('/settings')({
  head: () => pageHead('settings'),
  component: SettingsPage,
})

function ThemeCard({recipe, selected, onSelect}: {recipe: ThemeRecipe; selected: boolean; onSelect: () => void}) {
  const locale = useLocale()
  const [a, b, c] = recipe.swatches
  return (
    // items-stretch: Safari gives buttons align-items: flex-start, which shrank the preview (only absolutely placed shapes) to nothing.
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className="qv-tile p-2 flex flex-col items-stretch gap-2 text-left">
      <span className="relative block h-16 rounded-md overflow-hidden" style={{background: c}} aria-hidden>
        <span className="absolute left-2 top-2 h-3 w-14 rounded-full" style={{background: a}} />
        <span className="absolute left-2 top-7 h-2 w-20 rounded-full opacity-40" style={{background: a}} />
        <span className="absolute right-2 bottom-2 size-7 rounded-lg" style={{background: b}} />
        <span className="absolute left-2 bottom-2 h-5 w-10 rounded-md" style={{background: a}} />
        {recipe.forcedMode === 'dark' && <span className="absolute right-2 top-2"><Moon size={12} color="#fff" /></span>}
      </span>
      <span className="flex items-center gap-1 text-sm font-semibold">
        <span className="truncate">{recipe.name[locale]}</span>
        {selected && <Check size={14} className="text-accent shrink-0" aria-hidden />}
      </span>
    </button>
  )
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Writes a QRViet backup file back into localStorage; false when the file is not a backup. */
async function restoreBackup(file: File): Promise<boolean> {
  try {
    const json = JSON.parse(await file.text())
    if (json?.app !== 'qrviet' || typeof json.data !== 'object') return false
    for (const [k, v] of Object.entries(json.data as Record<string, unknown>)) if (k.startsWith('qrviet:')) localStorage.setItem(k, JSON.stringify(v))
    return true
  } catch {
    return false
  }
}

function SettingsPage() {
  const t = useT()
  const masonry = useMasonry<HTMLDivElement>()
  const locale = useLocale()
  const showToast = useToast()
  const mode = useSettings((s) => s.mode)
  const themeId = useSettings((s) => s.themeId)
  const customThemes = useSettings((s) => s.customThemes)
  const font = useSettings((s) => s.font)
  const contentMode = useSettings((s) => s.contentMode)
  const autoSave = useSettings((s) => s.autoSaveHistory)
  const {canPrompt, installed, ios} = useInstallState()
  const online = useOnline()
  const [storage, setStorage] = useState<string | null>(null)
  const [swReady, setSwReady] = useState(false)
  const [wipeOpen, setWipeOpen] = useState(false)
  const restoreRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Load every typeface so the font tiles preview their real glyphs.
    FONT_IDS.forEach((id) => void FONTS[id].load())
    void navigator.storage?.estimate?.().then((e) => setStorage(formatBytes(e.usage ?? 0)))
    void navigator.serviceWorker?.getRegistration().then((r) => setSwReady(Boolean(r?.active)))
  }, [])

  const backup = () => {
    const data: Record<string, unknown> = {}
    for (const k of listAppKeys()) data[k] = JSON.parse(localStorage.getItem(k) ?? 'null')
    downloadText(JSON.stringify({app: 'qrviet', kind: 'backup', version: 1, createdAt: new Date().toISOString(), data}, null, 2), `qrviet-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
  }

  const restore = async (file?: File) => {
    if (!file) return
    if (!(await restoreBackup(file))) return showToast({body: t('acc.importFailed'), type: 'error', uniqueID: 'restore'})
    showToast({body: t('set.restored'), uniqueID: 'restore'})
    setTimeout(() => location.reload(), 600)
  }

  const wipe = () => {
    for (const k of listAppKeys()) localStorage.removeItem(k)
    void clearThumbs().finally(() => location.reload())
  }

  const checkUpdate = async () => {
    const reg = await navigator.serviceWorker?.getRegistration()
    await reg?.update()
    if (!reg?.waiting) showToast({body: t('set.upToDate'), uniqueID: 'upd'})
  }

  const groups: Array<[string, ThemeRecipe[]]> = [
    [t('set.themesQrviet'), PRESETS.filter((p) => p.group === 'qrviet')],
    [t('set.themesAstryx'), PRESETS.filter((p) => p.group === 'astryx')],
    [t('set.themesCustom'), customThemes],
  ]

  return (
    <>
      <PageHeader title={t('set.title')} subtitle={t('set.subtitle')} icon={<SettingsIcon size={22} />} />
      <PageBody>
        <div className="flex flex-col gap-5">
          <Panel title={t('set.appearance')} icon={Palette} hue="pink">
            {/* Colour mode and language side by side only where "Hệ thống" still fits its segment. */}
            <div className="@container flex flex-col gap-6">
              <div className="grid gap-4 @3xl:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold">{t('set.mode')}</span>
                  <SegmentedControl label={t('set.mode')} value={mode} onChange={(v) => updateSettings({mode: v as ColorMode})} layout="fill">
                    <SegmentedControlItem value="light" label={t('common.light')} icon={<Sun size={15} />} />
                    <SegmentedControlItem value="dark" label={t('common.dark')} icon={<Moon size={15} />} />
                    <SegmentedControlItem value="system" label={t('common.system')} icon={<Laptop size={15} />} />
                  </SegmentedControl>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold">{t('set.language')}</span>
                  <SegmentedControl label={t('set.language')} value={locale} onChange={(v) => updateSettings({locale: v as 'vi' | 'en'})} layout="fill">
                    <SegmentedControlItem value="vi" label="Tiếng Việt" />
                    <SegmentedControlItem value="en" label="English" />
                  </SegmentedControl>
                </div>
              </div>

              {groups.map(([title, list]) =>
                list.length ? (
                  <div key={title} className="flex flex-col gap-2">
                    <span className="text-sm font-semibold">{title}</span>
                    <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-7 gap-2" role="radiogroup" aria-label={title}>
                      {list.map((r) => (
                        <ThemeCard key={r.id} recipe={r} selected={r.id === themeId} onSelect={() => updateSettings({themeId: r.id})} />
                      ))}
                    </div>
                  </div>
                ) : null,
              )}

              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">{t('set.font')}</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2" role="radiogroup" aria-label={t('set.font')}>
                  {FONT_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={font === id}
                      onClick={() => {
                        void FONTS[id].load()
                        updateSettings({font: id})
                      }}
                      onPointerEnter={() => void FONTS[id].load()}
                      className="qv-tile p-3 text-left">
                      <span className="block text-lg font-semibold truncate" style={{fontFamily: FONTS[id].stack}}>
                        {FONTS[id].sample}
                      </span>
                      <span className="block text-xs text-secondary">{FONTS[id].label}</span>
                    </button>
                  ))}
                </div>
                <span className="text-xs text-secondary">{t('set.fontHint')}</span>
              </div>
            </div>
          </Panel>

          <Panel title={t('set.builder')} description={t('set.builderBody')} icon={Paintbrush} hue="violet">
            <ThemeBuilder />
          </Panel>

          {/* Masonry: each card rises under the one above it rather than below the row's tallest. */}
          <div ref={masonry} className="grid grid-cols-1 gap-5 md:grid-cols-2 items-start">
            <Panel title={t('set.qrDefaults')} icon={QrCode}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold">{t('set.contentMode')}</span>
                  <SegmentedControl label={t('set.contentMode')} value={contentMode} onChange={(v) => updateSettings({contentMode: v as 'strict' | 'relaxed'})} layout="fill">
                    <SegmentedControlItem value="relaxed" label={t('set.contentRelaxed')} />
                    <SegmentedControlItem value="strict" label={t('set.contentStrict')} />
                  </SegmentedControl>
                </div>
                <Switch label={t('his.autoSave')} value={autoSave} onChange={(autoSaveHistory) => updateSettings({autoSaveHistory})} />
              </div>
            </Panel>

            <Panel title={t('set.app')} icon={Smartphone} hue="green">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {installed ? (
                    <Badge variant="success" label={t('app.installed')} icon={<Check size={12} />} />
                  ) : canPrompt ? (
                    <Button label={t('app.install')} variant="primary" icon={<Download size={16} />} clickAction={async () => void (await promptInstall())} />
                  ) : null}
                  <Badge variant={swReady ? 'success' : 'neutral'} label={swReady ? t('set.offlineReady') : t('set.offlineNotReady')} />
                  {!online && <Badge variant="warning" label={t('app.offline')} />}
                </div>
                {ios && !installed && (
                  <div className="flex flex-col gap-2">
                    <Banner status="info" title={t('app.installIosTitle')} description={t('app.installIosBody')} icon={<Share size={16} />} />
                    <div>
                      <Button label={t('app.installIosGuideAction')} icon={<Smartphone size={15} />} size="sm" variant="primary" clickAction={() => openIosInstallGuide()} />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-secondary">
                  <HardDrive size={15} aria-hidden /> {storage ? t('set.storage', {used: storage}) : '—'}
                </div>
                <div className="flex items-center gap-2 text-sm text-secondary">
                  <Smartphone size={15} aria-hidden /> {t('set.version', {version: `${__APP_VERSION__} · ${__BUILD_DATE__}`})}
                </div>
                <div>
                  <Button label={t('set.checkUpdate')} icon={<RefreshCw size={15} />} size="sm" clickAction={checkUpdate} isDisabled={!online} />
                </div>
              </div>
            </Panel>

            <Panel title={t('set.data')} description={t('set.dataBody')} icon={Database} hue="blue">
              <div className="flex flex-wrap gap-2">
                <Button label={t('set.backup')} icon={<Database size={16} />} onClick={backup} />
                <Button label={t('set.restore')} icon={<Upload size={16} />} onClick={() => restoreRef.current?.click()} />
                <input ref={restoreRef} type="file" accept="application/json,.json" hidden onChange={(e) => void restore(e.target.files?.[0])} />
                <Button label={t('set.wipe')} icon={<Trash2 size={16} />} variant="destructive" onClick={() => setWipeOpen(true)} />
              </div>
            </Panel>

            <Panel title={t('set.shortcuts')} icon={Keyboard} hue="amber">
              <ul className="flex flex-col gap-2 text-sm">
                {(
                  [
                    ['mod+k', 'set.shortcut.search'],
                    ['shift+s', 'set.shortcut.scan'],
                    ['shift+d', 'set.shortcut.theme'],
                  ] as const
                ).map(([keys, label]) => (
                  <li key={keys} className="flex items-center justify-between gap-3">
                    <span>{t(label)}</span>
                    <Kbd keys={keys} />
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </PageBody>
      <AlertDialog
        isOpen={wipeOpen}
        onOpenChange={setWipeOpen}
        title={t('set.wipeConfirm')}
        description={t('set.wipeBody')}
        actionLabel={t('set.wipe')}
        cancelLabel={t('common.cancel')}
        onAction={wipe}
      />
    </>
  )
}
