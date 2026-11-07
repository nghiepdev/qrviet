import type {ReactNode} from 'react'
import {BottomSheet} from '@astryxdesign/core/BottomSheet'
import {Dialog, DialogHeader, type DialogPurpose} from '@astryxdesign/core/Dialog'
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout'
import {Heading} from '@astryxdesign/core/Heading'
import {VStack} from '@astryxdesign/core/VStack'
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

/** Dialog on desktop, bottom sheet on phones/tablets with touch. */
export function AdaptiveSheet({isOpen, onOpenChange, title, subtitle, children, footer, purpose = 'info', width = 520, sheetHeight = 'tall'}: Props) {
  const touch = useIsTouchSheet()
  if (touch) {
    return (
      <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange} label={title} purpose={purpose} height={sheetHeight} padding={4}>
        <VStack gap={4}>
          <Heading level={3}>{title}</Heading>
          {children}
          {footer}
        </VStack>
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
