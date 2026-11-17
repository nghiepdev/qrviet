import {useEffect, useState} from 'react'
import {layoutQr, makeQr, type Ecc, type QrLogo, type QrStyle} from '#/lib/qr/render'
import {buildTemplateScene, type TemplateId, type TemplateInfo} from '#/lib/qr/templates'
import type {Measure, Scene} from '#/lib/qr/scene'
import {createMeasure, ensureExportFonts} from '#/lib/qr/export'
import {bankIconUrl, type Bank} from '#/data/banks'
import type {QrDesign} from '#/stores/settings'

/** A fresh measurer per fonts version: its identity is what tells layouts to re-measure. */
function measureForFonts(_fontsVersion: number): Measure {
  return createMeasure()
}

/**
 * Text measurer for scene layout. Its identity changes once web fonts finish
 * loading, so every layout that takes it as an input re-measures with the real
 * font instead of the fallback.
 */
export function useTextMeasure(): Measure {
  const [fontsVersion, setFontsVersion] = useState(0)
  useEffect(() => {
    let alive = true
    const bump = () => alive && setFontsVersion((n) => n + 1)
    void ensureExportFonts().then(bump)
    document.fonts?.addEventListener?.('loadingdone', bump)
    return () => {
      alive = false
      document.fonts?.removeEventListener?.('loadingdone', bump)
    }
  }, [])
  return measureForFonts(fontsVersion)
}

export function resolveLogo(
  design: Pick<
    QrDesign,
    'logoMode' | 'customLogo' | 'logoSize' | 'logoPlate' | 'logoPlateColor' | 'logoTransparentBg'
  >,
  bank?: Bank | null,
): QrLogo | null {
  const base = {
    size: design.logoSize,
    plate: design.logoPlate,
    plateColor: design.logoTransparentBg ? 'transparent' : design.logoPlateColor,
    excavate: true,
  }
  switch (design.logoMode) {
    case 'bank': {
      const src = bankIconUrl(bank)
      return src ? {...base, src} : null
    }
    case 'brand':
      return {...base, src: `${import.meta.env.BASE_URL}logo.svg`}
    case 'custom':
      return design.customLogo ? {...base, src: design.customLogo} : null
    default:
      return null
  }
}

/** Error-correction levels, weakest first. */
export const ECC_LEVELS: readonly Ecc[] = ['L', 'M', 'Q', 'H']

/** The weakest level that still scans with this logo, which hides part of the code: Q, or H for a large one. */
export function minEcc(logo: Pick<QrLogo, 'size'> | null): Ecc {
  if (!logo) return 'L'
  return logo.size > 0.24 ? 'H' : 'Q'
}

/** Raise error correction automatically when a logo covers part of the code. */
export function effectiveStyle(style: QrStyle, logo: QrLogo | null): QrStyle {
  const min = minEcc(logo)
  return ECC_LEVELS.indexOf(style.ecc) >= ECC_LEVELS.indexOf(min) ? style : {...style, ecc: min}
}

export interface QrSceneResult {
  scene: Scene | null
  /** QR-only scene used for scannability checks. */
  qrScene: Scene | null
  version: number
  error: string | null
}

const NO_SCENE: QrSceneResult = {scene: null, qrScene: null, version: 0, error: null}

function buildQrScenes(
  payload: string | null,
  template: TemplateId,
  info: TemplateInfo | null,
  style: QrStyle,
  logo: QrLogo | null,
  measure: Measure,
): QrSceneResult {
  if (!payload || !info) return NO_SCENE
  try {
    const s = effectiveStyle(style, logo)
    const model = makeQr(payload, s.ecc)
    const geo = layoutQr(model, s, logo)
    const opts = {style: s, logo}
    const scene = buildTemplateScene(template, info, {geo, opts}, measure)
    const qrScene = buildTemplateScene('qr', info, {geo, opts}, measure)
    return {scene, qrScene, version: model.version, error: null}
  } catch (e) {
    return {...NO_SCENE, error: (e as Error).message}
  }
}

export function useQrScene(
  payload: string | null,
  template: TemplateId,
  info: TemplateInfo | null,
  style: QrStyle,
  logo: QrLogo | null,
): QrSceneResult {
  const measure = useTextMeasure()
  return buildQrScenes(payload, template, info, style, logo, measure)
}
