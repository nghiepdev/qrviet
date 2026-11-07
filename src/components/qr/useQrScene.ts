import {useEffect, useMemo, useState} from 'react'
import {layoutQr, makeQr, type QrLogo, type QrStyle} from '#/lib/qr/render'
import {buildTemplateScene, type TemplateId, type TemplateInfo} from '#/lib/qr/templates'
import type {Scene} from '#/lib/qr/scene'
import {createMeasure, ensureExportFonts} from '#/lib/qr/export'
import {bankLogoUrl, type Bank} from '#/data/banks'
import type {QrDesign} from '#/stores/settings'

/** Re-render once web fonts finish loading so text measurement is exact. */
export function useFontsTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    const bump = () => alive && setTick((n) => n + 1)
    void ensureExportFonts().then(bump)
    document.fonts?.addEventListener?.('loadingdone', bump)
    return () => {
      alive = false
      document.fonts?.removeEventListener?.('loadingdone', bump)
    }
  }, [])
  return tick
}

export function resolveLogo(design: Pick<QrDesign, 'logoMode' | 'customLogo' | 'logoSize' | 'logoPlate'>, bank?: Bank | null): QrLogo | null {
  const base = {size: design.logoSize, plate: design.logoPlate, plateColor: '#ffffff', excavate: true}
  switch (design.logoMode) {
    case 'bank': {
      const src = bankLogoUrl(bank)
      return src ? {...base, src, plate: design.logoPlate === 'none' ? 'rounded' : design.logoPlate} : null
    }
    case 'brand':
      return {...base, src: `${import.meta.env.BASE_URL}logo.svg`, plate: design.logoPlate}
    case 'custom':
      return design.customLogo ? {...base, src: design.customLogo} : null
    default:
      return null
  }
}

/** Raise error correction automatically when a logo covers part of the code. */
export function effectiveStyle(style: QrStyle, logo: QrLogo | null): QrStyle {
  if (!logo) return style
  const rank = {L: 0, M: 1, Q: 2, H: 3} as const
  const min = logo.size > 0.24 ? 'H' : 'Q'
  return rank[style.ecc] >= rank[min] ? style : {...style, ecc: min}
}

export interface QrSceneResult {
  scene: Scene | null
  /** QR-only scene used for scannability checks. */
  qrScene: Scene | null
  version: number
  error: string | null
}

export function useQrScene(payload: string | null, template: TemplateId, info: TemplateInfo | null, style: QrStyle, logo: QrLogo | null): QrSceneResult {
  const fontsTick = useFontsTick()
  return useMemo(() => {
    if (!payload || !info) return {scene: null, qrScene: null, version: 0, error: null}
    try {
      const s = effectiveStyle(style, logo)
      const model = makeQr(payload, s.ecc)
      const geo = layoutQr(model, s, logo)
      const opts = {style: s, logo}
      const measure = createMeasure()
      const scene = buildTemplateScene(template, info, {geo, opts}, measure)
      const qrScene = buildTemplateScene('qr', info, {geo, opts}, measure)
      return {scene, qrScene, version: model.version, error: null}
    } catch (e) {
      return {scene: null, qrScene: null, version: 0, error: (e as Error).message}
    }
    // fontsTick forces a re-measure once fonts are ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, template, info, style, logo, fontsTick])
}
