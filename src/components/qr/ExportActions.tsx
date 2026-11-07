import {useCallback, useMemo, type ReactNode} from 'react'
import {Copy, Download, FileImage, Printer, Share2} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {DropdownMenu} from '@astryxdesign/core/DropdownMenu'
import {useToast} from '@astryxdesign/core/Toast'
import {useHotkeys} from '@astryxdesign/core/hooks'
import type {Scene} from '#/lib/qr/scene'
import {
  canCopyImage,
  canShareFiles,
  canvasToBlob,
  copyImage,
  downloadBlob,
  printSvgs,
  renderSceneToCanvas,
  sceneToStandaloneSvg,
  shareFile,
  type RasterType,
} from '#/lib/qr/export'
import {updateSettings, useSettings, type ExportFormat} from '#/stores/settings'
import {useT} from '#/i18n'

const MIME: Record<Exclude<ExportFormat, 'svg'>, RasterType> = {png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp'}

export async function exportScene(scene: Scene, format: ExportFormat, scale: number): Promise<{blob: Blob; ext: string}> {
  if (format === 'svg') {
    const svg = await sceneToStandaloneSvg(scene)
    return {blob: new Blob([svg], {type: 'image/svg+xml'}), ext: 'svg'}
  }
  const canvas = await renderSceneToCanvas(scene, scale)
  return {blob: await canvasToBlob(canvas, MIME[format]), ext: format === 'jpeg' ? 'jpg' : format}
}

export type ExportKind = 'download' | 'copy' | 'share' | 'print'

interface Props {
  scene: Scene | null
  filename: string
  shareText?: string
  onExported?: (kind: ExportKind) => void
  extra?: ReactNode
  hotkeys?: boolean
}

export function ExportActions({scene, filename, shareText, onExported, extra, hotkeys = true}: Props) {
  const t = useT()
  const showToast = useToast()
  const format = useSettings((s) => s.exportFormat)
  const scale = useSettings((s) => s.exportScale)
  const shareable = useMemo(() => canShareFiles(), [])
  const copyable = useMemo(() => canCopyImage(), [])

  const download = useCallback(async () => {
    if (!scene) return
    const {blob, ext} = await exportScene(scene, format, scale)
    downloadBlob(blob, `${filename}.${ext}`)
    showToast({body: t('gen.downloaded'), uniqueID: 'export'})
    onExported?.('download')
  }, [scene, format, scale, filename, showToast, t, onExported])

  const copy = useCallback(async () => {
    if (!scene) return
    try {
      await copyImage(exportScene(scene, 'png', Math.min(scale, 3)).then((r) => r.blob))
      showToast({body: t('gen.imageCopied'), uniqueID: 'export'})
      onExported?.('copy')
    } catch {
      showToast({body: t('common.copyFailed'), type: 'error', uniqueID: 'export'})
    }
  }, [scene, scale, showToast, t, onExported])

  const share = useCallback(async () => {
    if (!scene) return
    const {blob} = await exportScene(scene, 'png', Math.min(scale, 3))
    const file = new File([blob], `${filename}.png`, {type: 'image/png'})
    const result = await shareFile(file, shareText, 'QRViet')
    if (result === 'shared') onExported?.('share')
  }, [scene, scale, filename, shareText, onExported])

  const print = useCallback(async () => {
    if (!scene) return
    await printSvgs([await sceneToStandaloneSvg(scene)], {page: 'A5', marginMm: 12, itemWidthMm: scene.width > scene.height ? 120 : 100})
    onExported?.('print')
  }, [scene, onExported])

  useHotkeys([{keys: 'mod+s', onPress: () => void download(), allowInInputs: true, isDisabled: !hotkeys || !scene}])

  const disabled = !scene
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex">
        <Button
          label={`${t('common.download')} ${format.toUpperCase()}`}
          variant="primary"
          icon={<Download size={16} />}
          isDisabled={disabled}
          clickAction={download}
          tooltip={t('gen.shortcut')}
        />
        <DropdownMenu
          button={{label: t('gen.format'), isIconOnly: true, icon: <FileImage size={16} />, variant: 'secondary', isDisabled: disabled}}
          hasChevron={false}
          menuWidth={220}
          items={[
            {
              type: 'section',
              title: t('gen.format'),
              items: (['png', 'jpeg', 'webp', 'svg'] as ExportFormat[]).map((f) => ({
                id: f,
                label: `${f.toUpperCase()}${f === format ? '  ✓' : ''}`,
                description: f === 'svg' ? 'Vector' : f === 'png' ? 'Lossless' : undefined,
                onClick: () => updateSettings({exportFormat: f}),
              })),
            },
            {
              type: 'section',
              title: t('gen.quality'),
              items: [2, 3, 4].map((s) => ({
                id: `x${s}`,
                label: `${s}× ${s === scale ? '  ✓' : ''}`,
                onClick: () => updateSettings({exportScale: s}),
              })),
            },
          ]}
        />
      </div>
      {copyable && <Button label={t('gen.copyImage')} icon={<Copy size={16} />} isDisabled={disabled} clickAction={copy} />}
      {shareable && <Button label={t('common.share')} icon={<Share2 size={16} />} isDisabled={disabled} clickAction={share} />}
      <Button label={t('common.print')} icon={<Printer size={16} />} variant="ghost" isDisabled={disabled} clickAction={print} />
      {extra}
    </div>
  )
}
