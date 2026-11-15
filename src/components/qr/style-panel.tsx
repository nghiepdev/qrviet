import {useEffect, useRef, useState, type ReactNode} from 'react'
import {ImagePlus, RotateCcw, TriangleAlert} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl'
import {Slider} from '@astryxdesign/core/Slider'
import {Switch} from '@astryxdesign/core/Switch'
import {Text} from '@astryxdesign/core/Text'
import {
  DEFAULT_QR_STYLE,
  contrastRatio,
  layoutQr,
  makeQr,
  qrToSvg,
  type DotShape,
  type Ecc,
  type EyeBallShape,
  type EyeFrameShape,
  type LogoPlate,
  type QrLogo,
  type QrStyle,
} from '#/lib/qr/render'
import type {LogoMode, QrDesign} from '#/stores/settings'
import {ECC_LEVELS, effectiveStyle, minEcc} from './use-qr-scene'
import {useT, type MessageKey} from '#/i18n'

const DOTS: DotShape[] = ['square', 'rounded', 'dots', 'fluid', 'classy', 'diamond', 'bars-v', 'bars-h']
const FRAMES: EyeFrameShape[] = ['square', 'rounded', 'cushion', 'circle', 'leaf']
const BALLS: EyeBallShape[] = ['square', 'rounded', 'circle', 'diamond', 'leaf']
const PLATES: LogoPlate[] = ['none', 'square', 'rounded', 'circle']

export const COLOR_PRESETS: Array<{id: string; fg: string; fg2: string; gradient: QrStyle['gradient']; bg: string; eye?: string}> = [
  {id: 'ink', fg: '#111111', fg2: '#111111', gradient: 'none', bg: '#ffffff'},
  {id: 'son', fg: '#b3132b', fg2: '#b3132b', gradient: 'none', bg: '#ffffff'},
  {id: 'son-gold', fg: '#c81d34', fg2: '#7a0b1c', gradient: 'linear', bg: '#fffaf0', eye: '#d4a017'},
  {id: 'ocean', fg: '#0b4fd1', fg2: '#0aa2c0', gradient: 'linear', bg: '#ffffff'},
  {id: 'jade', fg: '#0b6b56', fg2: '#14a37f', gradient: 'radial', bg: '#f3fbf8'},
  {id: 'violet', fg: '#5b21b6', fg2: '#db2777', gradient: 'linear', bg: '#ffffff'},
  {id: 'sunset', fg: '#c2410c', fg2: '#be185d', gradient: 'linear', bg: '#fff7ed'},
  {id: 'night', fg: '#f8fafc', fg2: '#f8fafc', gradient: 'none', bg: '#0f172a'},
]

const SAMPLE = makeQr('QRViet', 'L')

function Preview({style}: {style: QrStyle}) {
  const svg = qrToSvg(layoutQr(SAMPLE, {...style, margin: 1}), 64, {style: {...style, margin: 1}})
  return <span className="block size-14 [&>svg]:size-full [&>svg]:block" aria-hidden dangerouslySetInnerHTML={{__html: svg}} />
}

function Tiles<T extends string>({
  label,
  options,
  value,
  onChange,
  render,
  labelKey,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
  render: (v: T) => ReactNode
  labelKey: (v: T) => MessageKey
}) {
  const t = useT()
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold mb-2">{label}</legend>
      {/* Auto-fill tiles at least 4.5rem wide so 4 fit per row on mobile while keeping uniform widths. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={o === value}
            onClick={() => onChange(o)}
            className="qv-tile flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium text-secondary"
            title={t(labelKey(o))}>
            {render(o)}
            <span className="truncate max-w-full">{t(labelKey(o))}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

const HEX_INPUT = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** "#abc" → "#aabbcc" (the native colour picker only accepts 6-digit hex). */
function toHex6(value: string): string {
  const h = value.replace('#', '')
  return `#${(h.length === 3 ? h.split('').map((c) => c + c).join('') : h).toLowerCase()}`
}

function ColorInput({label, value, onChange}: {label: string; value: string; onChange: (v: string) => void}) {
  // Local text so half-typed values never reach the renderer; only valid hex is committed.
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const valid = HEX_INPUT.test(text.trim())
  return (
    <label className={`flex items-center gap-2 rounded-md border bg-surface pl-1.5 pr-2 py-1.5 min-w-0 ${valid ? 'border-border' : 'border-error'}`}>
      <input
        type="color"
        value={HEX_INPUT.test(value) ? toHex6(value) : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="size-8 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
        aria-label={label}
      />
      <span className="flex flex-col min-w-0">
        <span className="text-[11px] text-secondary leading-tight">{label}</span>
        <input
          value={text}
          onChange={(e) => {
            const v = e.target.value.trim()
            setText(v)
            if (HEX_INPUT.test(v)) onChange(toHex6(v))
          }}
          onBlur={() => !HEX_INPUT.test(text.trim()) && setText(value)}
          className={`qv-mono text-sm bg-transparent outline-none w-20 ${valid ? '' : 'text-error'}`}
          spellCheck={false}
          maxLength={7}
          aria-invalid={!valid}
          aria-label={`${label} (hex)`}
        />
      </span>
    </label>
  )
}

interface Props {
  style: QrStyle
  onStyle: (patch: Partial<QrStyle>) => void
  design?: Pick<QrDesign, 'logoMode' | 'customLogo' | 'logoSize' | 'logoPlate'>
  onDesign?: (patch: Partial<QrDesign>) => void
  allowBankLogo?: boolean
  /** The logo the code is drawn with: it sets a minimum error-correction level. */
  logo?: QrLogo | null
}

export function StylePanel({style, onStyle, design, onDesign, allowBankLogo = true, logo = null}: Props) {
  const t = useT()
  // The level the code really uses, and the weakest one the logo allows.
  const ecc = effectiveStyle(style, logo).ecc
  const lowest = ECC_LEVELS.indexOf(minEcc(logo))
  const fileRef = useRef<HTMLInputElement>(null)
  const contrast = style.transparentBg ? 21 : contrastRatio(style.fg, style.bg)
  const inverted = !style.transparentBg && contrastRatio(style.bg, '#000000') < contrastRatio(style.fg, '#000000')

  const onLogoFile = async (file: File | undefined) => {
    if (!file || !onDesign) return
    const dataUrl = await downscaleImage(file, 256)
    onDesign({customLogo: dataUrl, logoMode: 'custom'})
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t('style.presets')}</span>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((p) => {
            const active = style.fg === p.fg && style.bg === p.bg && style.gradient === p.gradient
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                aria-label={p.id}
                onClick={() =>
                  onStyle({fg: p.fg, fg2: p.fg2, gradient: p.gradient, bg: p.bg, transparentBg: false, eyeFrameColor: p.eye ?? null, eyeBallColor: p.eye ?? null})
                }
                className="qv-tile size-10 p-1 rounded-full">
                <span
                  className="block size-full rounded-full border border-black/10"
                  style={{background: p.gradient === 'none' ? `linear-gradient(135deg, ${p.fg} 50%, ${p.bg} 50%)` : `linear-gradient(135deg, ${p.fg}, ${p.fg2} 60%, ${p.bg} 60%)`}}
                />
              </button>
            )
          })}
        </div>
      </div>

      <Tiles label={t('style.dots')} options={DOTS} value={style.dots} onChange={(dots) => onStyle({dots})} labelKey={(v) => `dots.${v}` as MessageKey} render={(dots) => <Preview style={{...DEFAULT_QR_STYLE, dots}} />} />
      <div className="grid gap-6">
        <Tiles
          label={t('style.eyeFrame')}
          options={FRAMES}
          value={style.eyeFrame}
          onChange={(eyeFrame) => onStyle({eyeFrame})}
          labelKey={(v) => `eye.${v}` as MessageKey}
          render={(eyeFrame) => <Preview style={{...DEFAULT_QR_STYLE, dots: 'dots', eyeFrame, eyeBall: 'square'}} />}
        />
        <Tiles
          label={t('style.eyeBall')}
          options={BALLS}
          value={style.eyeBall}
          onChange={(eyeBall) => onStyle({eyeBall})}
          labelKey={(v) => `eye.${v}` as MessageKey}
          render={(eyeBall) => <Preview style={{...DEFAULT_QR_STYLE, dots: 'dots', eyeFrame: 'rounded', eyeBall}} />}
        />
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold">{t('style.colors')}</span>
        <SegmentedControl label={t('style.gradient')} value={style.gradient} onChange={(v) => onStyle({gradient: v as QrStyle['gradient']})} layout="fill">
          <SegmentedControlItem value="none" label={t('style.gradient.none')} />
          <SegmentedControlItem value="linear" label={t('style.gradient.linear')} />
          <SegmentedControlItem value="radial" label={t('style.gradient.radial')} />
        </SegmentedControl>
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label={t('style.fg')} value={style.fg} onChange={(fg) => onStyle({fg})} />
          {style.gradient !== 'none' ? (
            <ColorInput label={t('style.fg2')} value={style.fg2} onChange={(fg2) => onStyle({fg2})} />
          ) : (
            <ColorInput label={t('style.bg')} value={style.bg} onChange={(bg) => onStyle({bg})} />
          )}
          {style.gradient !== 'none' && <ColorInput label={t('style.bg')} value={style.bg} onChange={(bg) => onStyle({bg})} />}
          {(style.eyeFrameColor || style.eyeBallColor) && (
            <ColorInput label={t('style.eyeColor')} value={style.eyeFrameColor ?? style.fg} onChange={(c) => onStyle({eyeFrameColor: c, eyeBallColor: c})} />
          )}
        </div>
        {style.gradient === 'linear' && (
          <Slider label="°" value={style.gradientRotation} min={0} max={360} step={15} onChange={(v: number) => onStyle({gradientRotation: v})} formatValue={(v) => `${v}°`} />
        )}
        <div className="flex flex-col gap-2">
          <Switch label={t('style.transparent')} value={style.transparentBg} onChange={(transparentBg) => onStyle({transparentBg})} size="sm" />
          <Switch
            label={t('style.eyeColor')}
            value={Boolean(style.eyeFrameColor)}
            onChange={(on) => onStyle(on ? {eyeFrameColor: '#d7263d', eyeBallColor: '#d7263d'} : {eyeFrameColor: null, eyeBallColor: null})}
            size="sm"
          />
        </div>
        {(contrast < 3 || inverted) && (
          <div className="flex items-start gap-2 rounded-md p-2.5 bg-warning-muted text-on-warning-muted text-sm">
            <TriangleAlert size={16} className="shrink-0 mt-0.5" aria-hidden />
            <span>{t('gen.lowContrast')}</span>
          </div>
        )}
      </div>

      {design && onDesign && (
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold">{t('style.logo')}</span>
          <SegmentedControl label={t('style.logo')} value={design.logoMode} onChange={(v) => onDesign({logoMode: v as LogoMode})} layout="fill">
            <SegmentedControlItem value="none" label={t('style.logo.none')} />
            {allowBankLogo && <SegmentedControlItem value="bank" label={t('style.logo.bank')} />}
            <SegmentedControlItem value="brand" label="QRViet" />
            <SegmentedControlItem value="custom" label={t('style.logo.custom')} />
          </SegmentedControl>
          {design.logoMode === 'custom' && (
            <div className="flex items-center gap-3">
              {design.customLogo && <img src={design.customLogo} alt="" className="size-12 rounded-md border border-border object-contain bg-white" />}
              <Button label={t('style.logo.upload')} icon={<ImagePlus size={16} />} size="sm" onClick={() => fileRef.current?.click()} />
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onLogoFile(e.target.files?.[0])} />
            </div>
          )}
          {design.logoMode !== 'none' && (
            <>
              <Slider
                label={t('style.logoSize')}
                value={Math.round(design.logoSize * 100)}
                min={12}
                max={30}
                step={1}
                onChange={(v: number) => onDesign({logoSize: v / 100})}
                formatValue={(v) => `${v}%`}
              />
              <SegmentedControl label={t('style.logoPlate')} value={design.logoPlate} onChange={(v) => onDesign({logoPlate: v as LogoPlate})} layout="fill">
                {PLATES.map((p) => (
                  <SegmentedControlItem key={p} value={p} label={t(`plate.${p}` as MessageKey)} />
                ))}
              </SegmentedControl>
            </>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 items-center">
        <SegmentedControl label={t('style.ecc')} value={ecc} onChange={(v) => onStyle({ecc: v as Ecc})} layout="fill">
          {ECC_LEVELS.map((e, i) => (
            <SegmentedControlItem key={e} value={e} label={e} isDisabled={i < lowest} />
          ))}
        </SegmentedControl>
        <div className="sm:order-3 sm:col-span-2">
          <Text type="supporting" color="secondary">
            {lowest > 0 ? t('style.ecc.logo', {level: ECC_LEVELS[lowest]}) : `${t('style.ecc')}: ${t('style.ecc.hint')}`}
          </Text>
        </div>
        <div className="pt-2 sm:pt-0 sm:order-2">
          <Slider label={t('style.margin')} value={style.margin} min={0} max={6} step={1} onChange={(v: number) => onStyle({margin: v})} valueDisplay="text" />
        </div>
      </div>

      <div>
        <Button
          label={t('style.reset')}
          icon={<RotateCcw size={15} />}
          variant="ghost"
          size="sm"
          onClick={() => {
            onStyle({...DEFAULT_QR_STYLE})
            onDesign?.({logoMode: allowBankLogo ? 'bank' : 'none', logoSize: 0.22, logoPlate: 'rounded'})
          }}
        />
      </div>
    </div>
  )
}

/** Resize an uploaded logo so it stays small in localStorage. */
async function downscaleImage(file: File, max: number): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/png')
}
