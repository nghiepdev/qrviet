import {type ReactNode} from 'react'
import {ChevronDown, Copy, Download, Printer, Share2} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {ButtonGroup} from '@astryxdesign/core/ButtonGroup'
import {
  DropdownMenu,
  type DropdownMenuItemData,
  type DropdownMenuOption,
} from '@astryxdesign/core/DropdownMenu'
import {useToast} from '@astryxdesign/core/Toast'
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
} from '#/lib/qr/export'
import {sheetUnlessAnchored} from '#/app/anchoring'
import {useT} from '#/i18n'

/** Exported images are PNG at 3× the scene size: sharp in print, still small enough to share. */
const EXPORT_SCALE = 3

export async function exportPng(scene: Scene): Promise<Blob> {
  return canvasToBlob(await renderSceneToCanvas(scene, EXPORT_SCALE), 'image/png')
}

export type ExportKind = 'download' | 'copy' | 'share' | 'print'

/** A page's own action shown beside the export button, such as the payment link. */
export interface SideAction {
  label: string
  icon: ReactNode
  onClick: () => void
  isDisabled?: boolean
}

interface Props {
  scene: Scene | null
  filename: string
  shareText?: string
  onExported?: (kind: ExportKind) => void
  side?: SideAction
  /** The page's other actions (copy the code, an embed snippet), listed in the menu after the exports. */
  menuItems?: DropdownMenuItemData[]
}

/**
 * A split button: downloading the PNG is the main action, and the chevron opens the other ways
 * out (copy, share, print, listing only those this browser supports), then the page's own items.
 *
 * Everything stays on one row, centred under the preview. A side action keeps its label where the
 * row has room for it and shows just its icon, with a tooltip, where it does not.
 */
export function ExportActions({scene, filename, shareText, onExported, side, menuItems}: Props) {
  const t = useT()
  const showToast = useToast()

  const download = async () => {
    if (!scene) return
    downloadBlob(await exportPng(scene), `${filename}.png`)
    showToast({body: t('gen.downloaded'), uniqueID: 'export'})
    onExported?.('download')
  }

  const copy = () => {
    if (!scene) return
    // Hand the clipboard a pending blob synchronously: Safari only allows writes inside the click,
    // and the menu runs a row's action within the click itself.
    copyImage(exportPng(scene)).then(
      () => {
        showToast({body: t('gen.imageCopied'), uniqueID: 'export'})
        onExported?.('copy')
      },
      () => showToast({body: t('common.copyFailed'), type: 'error', uniqueID: 'export'}),
    )
  }

  const share = async () => {
    if (!scene) return
    const file = new File([await exportPng(scene)], `${filename}.png`, {type: 'image/png'})
    const result = await shareFile(file, shareText, 'QRViet')
    if (result === 'shared') onExported?.('share')
  }

  const print = async () => {
    if (!scene) return
    await printSvgs([await sceneToStandaloneSvg(scene)], {
      page: 'A5',
      marginMm: 12,
      itemWidthMm: scene.width > scene.height ? 120 : 100,
    })
    onExported?.('print')
  }

  const more: DropdownMenuOption[] = [
    ...(canCopyImage()
      ? [{id: 'copy', label: t('gen.copyImage'), icon: <Copy size={16} />, onClick: copy}]
      : []),
    ...(canShareFiles()
      ? [
          {
            id: 'share',
            label: t('common.share'),
            icon: <Share2 size={16} />,
            onClick: () => void share(),
          },
        ]
      : []),
    {
      id: 'print',
      label: t('common.print'),
      icon: <Printer size={16} />,
      onClick: () => void print(),
    },
    ...(menuItems?.length ? [{type: 'divider' as const}, ...menuItems] : []),
  ]

  return (
    // The container query reads the row's own width (22.5rem fits both labels, in Vietnamese too).
    <div className="@container">
      <div className="flex items-center justify-center gap-2">
        <ButtonGroup label={t('gen.export')} isDisabled={!scene}>
          <Button
            label={`${t('common.download')} PNG`}
            variant="primary"
            icon={<Download size={16} />}
            clickAction={download}
          />
          <DropdownMenu
            button={{
              label: t('gen.moreExport'),
              variant: 'primary',
              isIconOnly: true,
              icon: <ChevronDown size={16} />,
            }}
            alignment="end"
            // An action sheet on a phone, and wherever the menu cannot be anchored (src/app/anchoring.ts).
            presentation={sheetUnlessAnchored('adaptive')}
            items={more}
          />
        </ButtonGroup>
        {side && (
          <>
            <Button
              label={side.label}
              icon={side.icon}
              isDisabled={side.isDisabled}
              onClick={side.onClick}
              className="@max-[22.5rem]:hidden"
            />
            <Button
              label={side.label}
              icon={side.icon}
              isIconOnly
              tooltip={side.label}
              isDisabled={side.isDisabled}
              onClick={side.onClick}
              className="@min-[22.5rem]:hidden"
            />
          </>
        )}
      </div>
    </div>
  )
}
