import {useEffect, useRef, useState} from 'react'
import {Copy, Download, Palette, Plus, Save, Trash2, Upload} from 'lucide-react'
import {Theme} from '@astryxdesign/core/theme'
import {Badge} from '@astryxdesign/core/Badge'
import {Button} from '@astryxdesign/core/Button'
import {Card} from '@astryxdesign/core/Card'
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl'
import {Selector} from '@astryxdesign/core/Selector'
import {Slider} from '@astryxdesign/core/Slider'
import {Spinner} from '@astryxdesign/core/Spinner'
import {Switch} from '@astryxdesign/core/Switch'
import {TextInput} from '@astryxdesign/core/TextInput'
import {Heading} from '@astryxdesign/core/Heading'
import {Text} from '@astryxdesign/core/Text'
import {useTheme} from '@astryxdesign/core/theme'
import {useToast} from '@astryxdesign/core/Toast'
import {
  ACCENT_CHOICES,
  BASE_IDS,
  buildTheme,
  darkPartner,
  loadBase,
  useLoadedBase,
  type BaseId,
  type NeutralStyle,
  type ThemeRecipe,
} from '#/theme/presets'
import {updateSettings, useSettings} from '#/stores/settings'
import {downloadText} from '#/lib/qr/export'
import {uid} from '#/lib/text'
import {useLocale, useT} from '#/i18n'
import {LogoMark} from '#/components/brand/logo'
import {sheetUnlessAnchored} from '#/app/anchoring'

function newRecipe(name: string): ThemeRecipe {
  return {
    id: `custom-${uid().slice(0, 8)}`,
    name: {vi: name, en: name},
    group: 'custom',
    base: 'neutral',
    accent: ['#0B7F66', '#4FD1B0'],
    neutral: 'warm',
    contrast: 'standard',
    radius: 1.5,
    textSize: 14,
    swatches: ['#0B7F66', '#4FD1B0', '#F4F1EC'],
  }
}

function PreviewSample() {
  const t = useT()
  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl"
      style={{background: 'var(--color-background-body)', color: 'var(--color-text-primary)'}}
    >
      <div className="flex items-center gap-2">
        <LogoMark size={26} />
        <Heading level={3}>QRViet</Heading>
        <span className="ml-auto">
          <Badge variant="success" label={t('bank.napas')} />
        </span>
      </div>
      <Card padding={3}>
        <div className="flex flex-col gap-3">
          <TextInput label={t('gen.amount')} value="150.000" onChange={() => undefined} />
          <Text type="supporting" color="secondary">
            {t('tpl.scanHint')}
          </Text>
          <div className="flex flex-wrap gap-2">
            <Button label={t('common.download')} variant="primary" />
            <Button label={t('common.share')} />
            <Button label={t('common.cancel')} variant="ghost" />
          </div>
        </div>
      </Card>
    </div>
  )
}

/** A theme exported from the builder, or null when the file is not one. */
async function readThemeFile(file: File): Promise<ThemeRecipe | null> {
  try {
    const data = JSON.parse(await file.text()) as ThemeRecipe
    return data.base && BASE_IDS.includes(data.base) ? data : null
  } catch {
    return null
  }
}

export function ThemeBuilder() {
  const t = useT()
  const locale = useLocale()
  const showToast = useToast()
  const customThemes = useSettings((s) => s.customThemes)
  const themeId = useSettings((s) => s.themeId)
  const font = useSettings((s) => s.font)
  const {mode} = useTheme()
  const modeSetting = useSettings((s) => s.mode)
  const editingExisting = customThemes.find((c) => c.id === themeId)
  const [draft, setDraft] = useState<ThemeRecipe>(
    () => editingExisting ?? newRecipe(locale === 'vi' ? 'Chủ đề của tôi' : 'My theme'),
  )
  const base = useLoadedBase(draft.base)
  const fileRef = useRef<HTMLInputElement>(null)
  const isSaved = customThemes.some((c) => c.id === draft.id)

  useEffect(() => {
    void loadBase(draft.base)
  }, [draft.base])

  const preview = base ? buildTheme(draft, base, font) : null
  const patch = (p: Partial<ThemeRecipe>) => setDraft((d) => ({...d, ...p}))
  const setAccent = (light: string, dark?: string) =>
    patch({
      accent: [light, dark ?? darkPartner(light)],
      swatches: [light, dark ?? darkPartner(light), d3(draft)],
    })

  const save = () => {
    const recipe = {
      ...draft,
      swatches: [draft.accent?.[0] ?? '#000', draft.accent?.[1] ?? '#fff', d3(draft)],
    }
    updateSettings((s) => ({
      customThemes: s.customThemes.some((c) => c.id === recipe.id)
        ? s.customThemes.map((c) => (c.id === recipe.id ? recipe : c))
        : [...s.customThemes, recipe],
      themeId: recipe.id,
    }))
    showToast({body: t('common.saved'), uniqueID: 'theme'})
  }

  const remove = () => {
    updateSettings((s) => ({
      customThemes: s.customThemes.filter((c) => c.id !== draft.id),
      themeId: s.themeId === draft.id ? 'son' : s.themeId,
    }))
    setDraft(newRecipe(locale === 'vi' ? 'Chủ đề của tôi' : 'My theme'))
  }

  const importJson = async (file?: File) => {
    if (!file) return
    const data = await readThemeFile(file)
    if (!data)
      return showToast({body: t('acc.importFailed'), type: 'error', uniqueID: 'theme-import'})
    setDraft({
      ...newRecipe(data.name?.vi ?? 'Imported'),
      ...data,
      id: `custom-${uid().slice(0, 8)}`,
      group: 'custom',
    })
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] items-start">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <TextInput
              label={t('set.builderName')}
              value={draft.name.vi}
              onChange={(v) => patch({name: {vi: v, en: v}})}
            />
          </div>
          <Button
            label={t('set.builderNew')}
            icon={<Plus size={15} />}
            variant="ghost"
            size="sm"
            onClick={() => setDraft(newRecipe(locale === 'vi' ? 'Chủ đề mới' : 'New theme'))}
          />
          {isSaved && (
            <Button
              label={t('set.builderDuplicate')}
              icon={<Copy size={15} />}
              variant="ghost"
              size="sm"
              onClick={() =>
                setDraft({
                  ...draft,
                  id: `custom-${uid().slice(0, 8)}`,
                  name: {vi: `${draft.name.vi} 2`, en: `${draft.name.en} 2`},
                })
              }
            />
          )}
        </div>
        <Selector
          label={t('set.builderBase')}
          value={draft.base}
          onChange={(v) => patch({base: v as BaseId})}
          options={BASE_IDS.map((b) => ({value: b, label: b[0].toUpperCase() + b.slice(1)}))}
          width="100%"
          presentation={sheetUnlessAnchored('popover')}
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{t('set.builderAccent')}</span>
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label={t('set.builderAccent')}
          >
            {ACCENT_CHOICES.map(([l, d]) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={draft.accent?.[0] === l}
                aria-label={l}
                onClick={() => setAccent(l, d)}
                className="qv-tile size-9 rounded-full p-1"
              >
                <span
                  className="block size-full rounded-full"
                  style={{background: `linear-gradient(135deg, ${l} 55%, ${d} 55%)`}}
                />
              </button>
            ))}
            <label
              className="qv-tile size-9 rounded-full p-1 cursor-pointer relative overflow-hidden"
              title={t('common.custom')}
            >
              <span
                className="block size-full rounded-full"
                style={{background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)'}}
              />
              <input
                type="color"
                value={draft.accent?.[0] ?? '#d7263d'}
                onChange={(e) => setAccent(e.target.value.toUpperCase())}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label={t('common.custom')}
              />
            </label>
            <Switch
              label={t('common.default')}
              value={!draft.accent}
              onChange={(useBase) =>
                patch(
                  useBase
                    ? {accent: undefined, onAccent: undefined}
                    : {accent: ['#0B7F66', '#4FD1B0']},
                )
              }
              size="sm"
            />
          </div>
        </div>
        {draft.accent && (
          <SegmentedControl
            label={t('set.builderNeutral')}
            value={draft.neutral ?? 'neutral'}
            onChange={(v) => patch({neutral: v as NeutralStyle})}
            layout="fill"
          >
            <SegmentedControlItem value="warm" label={t('set.neutral.warm')} />
            <SegmentedControlItem value="neutral" label={t('set.neutral.neutral')} />
            <SegmentedControlItem value="cool" label={t('set.neutral.cool')} />
          </SegmentedControl>
        )}
        {draft.accent && (
          <Switch
            label={t('set.builderContrast')}
            value={draft.contrast === 'high'}
            onChange={(on) => patch({contrast: on ? 'high' : 'standard'})}
          />
        )}
        <Slider
          label={t('set.builderRadius')}
          value={draft.radius ?? 1}
          min={0}
          max={2.5}
          step={0.25}
          onChange={(radius: number) => patch({radius})}
          formatValue={(v) => `${Math.round(v * 8)}px`}
          marks={[{value: 0}, {value: 1}, {value: 2}]}
        />
        <Slider
          label={t('set.builderText')}
          value={draft.textSize ?? 14}
          min={13}
          max={17}
          step={1}
          onChange={(textSize: number) => patch({textSize})}
          formatValue={(v) => `${v}px`}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            label={isSaved ? t('set.builderUpdate') : t('set.builderSave')}
            variant="primary"
            icon={<Save size={16} />}
            onClick={save}
          />
          <Button
            label={t('set.themeExport')}
            icon={<Download size={15} />}
            variant="ghost"
            onClick={() =>
              downloadText(
                JSON.stringify(draft, null, 2),
                `qrviet-theme-${draft.id}.json`,
                'application/json',
              )
            }
          />
          <Button
            label={t('set.themeImport')}
            icon={<Upload size={15} />}
            variant="ghost"
            onClick={() => fileRef.current?.click()}
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void importJson(e.target.files?.[0])}
          />
          {isSaved && (
            <Button
              label={t('common.delete')}
              icon={<Trash2 size={15} />}
              variant="destructive"
              onClick={remove}
            />
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Palette size={15} aria-hidden /> {t('common.preview')}
        </span>
        <div className="rounded-xl border border-border overflow-hidden min-h-64 grid">
          {preview ? (
            <Theme
              theme={preview}
              mode={draft.forcedMode ?? (modeSetting === 'system' ? mode : modeSetting)}
            >
              <PreviewSample />
            </Theme>
          ) : (
            <div className="grid place-items-center p-8">
              <Spinner />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function d3(r: ThemeRecipe): string {
  return r.neutral === 'cool' ? '#EEF2FA' : r.neutral === 'warm' ? '#FBF3EE' : '#F2F2F2'
}
