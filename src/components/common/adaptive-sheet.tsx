import type {ReactNode} from 'react'
import {BottomSheet} from '@astryxdesign/core/BottomSheet'
import {Dialog, DialogHeader, type DialogPurpose} from '@astryxdesign/core/Dialog'
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout'
import {Heading} from '@astryxdesign/core/Heading'
import {useMediaQuery} from '@astryxdesign/core/hooks'

const TOUCH_QUERY = '(max-width: 1023px) and (pointer: coarse)'

export function useIsTouchSheet(): boolean {
  return useMediaQuery(TOUCH_QUERY)
}

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  purpose?: DialogPurpose
  width?: number
  sheetHeight?: 'hug' | 'capped' | 'tall'
}

/**
 * Dialog on desktop, bottom sheet on phones/tablets with touch. Keep it mounted and toggle `isOpen`
 * (do not render it conditionally): closing then plays the exit animation and returns focus.
 */
export function AdaptiveSheet({isOpen, onOpenChange, title, subtitle, children, footer, purpose = 'info', width = 520, sheetHeight = 'tall'}: Props) {
  const touch = useIsTouchSheet()
  if (touch) {
    return (
      <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange} label={title} purpose={purpose} height={sheetHeight} padding={4}>
        {/* Fills the sheet, so the footer (.qv-sheet-footer) rests on its bottom edge. */}
        <div className="flex min-h-full flex-col gap-4">
          <Heading level={3}>{title}</Heading>
          {children}
          {footer && <div className="qv-sheet-footer">{footer}</div>}
        </div>
      </BottomSheet>
    )
  }
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose={purpose} width={width} maxHeight="85dvh">
      <Layout
        header={<DialogHeader title={title} subtitle={subtitle} onOpenChange={onOpenChange} />}
        content={<LayoutContent>{children}</LayoutContent>}
        footer={footer ? <LayoutFooter>{footer}</LayoutFooter> : undefined}
      />
    </Dialog>
  )
}
