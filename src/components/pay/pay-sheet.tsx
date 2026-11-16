import {useEffect, useState} from 'react'
import {useLocation, useNavigate} from '@tanstack/react-router'
import {Check, Copy, Lock, Share} from 'lucide-react'
import {BottomSheet} from '@astryxdesign/core/BottomSheet'
import {Dialog} from '@astryxdesign/core/Dialog'
import {Layout, LayoutContent, LayoutHeader} from '@astryxdesign/core/Layout'
import {isStandalone} from '#/app/pwa'
import {useIsTouchSheet} from '#/components/common/adaptive-sheet'
import {PayView} from '#/components/pay/pay-view'
import {getBankByBin, resolveBank, type Bank} from '#/data/banks'
import {useCopy} from '#/hooks/use-copy'
import {useT} from '#/i18n'
import {decodePayLink, type PayLinkData} from '#/lib/paylink'
import {shareLink} from '#/lib/qr/export'

/**
 * In a regular browser tab, the payment page opens in one named tab so opening it again updates
 * that tab instead of adding tabs. No `noopener`, since browsers ignore a target name given with
 * it; the page is our own, so the opener reference is harmless.
 *
 * Inside an installed standalone PWA, `window.open` to a same-scope URL replaces the app window on
 * mobile without a back button, so `usePaySheet` opens a Safari-style sheet instead.
 */
const PAY_TAB = 'qrviet-pay'

interface ParsedPayUrl {
  data: PayLinkData | null
  bank: Bank | undefined
  host: string
  isSecure: boolean
}

function parsePayUrl(url: string | null): ParsedPayUrl {
  const fallbackHost = typeof location !== 'undefined' ? location.host : 'qrviet.app'
  const fallbackSecure = typeof location !== 'undefined' ? location.protocol === 'https:' : true
  if (!url) return {data: null, bank: undefined, host: fallbackHost, isSecure: fallbackSecure}
  try {
    const parsed = new URL(
      url,
      typeof location !== 'undefined' ? location.origin : 'https://qrviet.app',
    )
    const data = decodePayLink(parsed.hash, parsed.search)
    return {
      data,
      bank: data ? (getBankByBin(data.bin) ?? resolveBank(data.bin)) : undefined,
      host: parsed.host || fallbackHost,
      isSecure: parsed.protocol === 'https:',
    }
  } catch {
    return {data: null, bank: undefined, host: fallbackHost, isSecure: fallbackSecure}
  }
}

export function usePaySheet() {
  const [url, setUrl] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const open = (targetUrl: string) => {
    if (!targetUrl) return
    if (isStandalone()) {
      setUrl(targetUrl)
      setIsOpen(true)
      return
    }
    window.open(targetUrl, PAY_TAB)?.focus()
  }

  return {
    open,
    sheetProps: {
      url,
      isOpen,
      onOpenChange: setIsOpen,
    },
  }
}

interface SafariBarProps {
  host: string
  isSecure: boolean
  url: string | null
  onDone: () => void
}

/** SFSafariViewController-inspired chrome bar: Done on the left, 🔒 domain centered, actions on the right. */
function SafariSheetBar({host, isSecure, url, onDone}: SafariBarProps) {
  const t = useT()
  const copy = useCopy()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(id)
  }, [copied])

  const handleCopy = async () => {
    if (!url) return
    const ok = await copy(url, t('gen.linkCopied'))
    if (ok) setCopied(true)
  }

  const handleShare = async () => {
    if (!url) return
    const r = await shareLink(url, t('pay.title'), 'QRViet')
    if (r === 'unsupported') await handleCopy()
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <button
        type="button"
        onClick={onDone}
        className="inline-flex min-h-11 cursor-pointer items-center justify-self-start rounded-lg px-2.5 text-[17px] font-medium tracking-[-0.01em] text-[#007aff] transition-opacity active:opacity-50 dark:text-[#0a84ff]"
      >
        {t('pay.done')}
      </button>

      <div className="flex max-w-full min-w-0 items-center justify-center gap-1.5 justify-self-center px-1 text-[15px] font-semibold tracking-[-0.01em] text-primary">
        {isSecure && (
          <Lock size={12} strokeWidth={2.5} className="shrink-0 text-primary/80" aria-hidden />
        )}
        <span className="truncate">{host}</span>
      </div>

      <div className="flex items-center justify-self-end">
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={!url}
          aria-label={t('common.copy')}
          title={t('common.copy')}
          className="grid size-11 cursor-pointer place-items-center rounded-lg text-[#007aff] transition-opacity active:opacity-50 disabled:opacity-40 dark:text-[#0a84ff]"
        >
          {copied ? (
            <Check size={19} strokeWidth={2.1} aria-hidden />
          ) : (
            <Copy size={19} strokeWidth={1.9} aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={!url}
          aria-label={t('common.share')}
          title={t('common.share')}
          className="grid size-11 cursor-pointer place-items-center rounded-lg text-[#007aff] transition-opacity active:opacity-50 disabled:opacity-40 dark:text-[#0a84ff]"
        >
          <Share size={19} strokeWidth={1.9} aria-hidden />
        </button>
      </div>
    </div>
  )
}

interface PaySheetProps {
  url: string | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onMakeOwn?: () => void
}

/**
 * Safari-like modal sheet (`SFSafariViewController` feel) that opens `/pay` links inside
 * standalone PWAs without replacing the app. Keep mounted and toggle `isOpen`.
 */
export function PaySheet({url, isOpen, onOpenChange, onMakeOwn}: PaySheetProps) {
  const t = useT()
  const touch = useIsTouchSheet()
  const navigate = useNavigate()
  const pathname = useLocation({select: (s) => s.pathname})
  const {data, bank, host, isSecure} = parsePayUrl(url)

  const handleMakeOwn = () => {
    onOpenChange(false)
    if (onMakeOwn) {
      onMakeOwn()
      return
    }
    if (pathname !== '/link') {
      void navigate({to: '/link'})
    }
  }

  const bar = (
    <SafariSheetBar host={host} isSecure={isSecure} url={url} onDone={() => onOpenChange(false)} />
  )
  const body = url ? (
    <PayView key={url} data={data} bank={bank} shareUrl={url} onMakeOwn={handleMakeOwn} />
  ) : null

  if (touch) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        label={host || t('pay.title')}
        purpose="info"
        height="calc(100dvh - max(10px, env(safe-area-inset-top, 0px)))"
        padding={0}
      >
        <div className="sticky top-0 z-10 -mt-6 border-b border-border/70 bg-surface/85 px-2 pt-5 pb-1 backdrop-blur-md">
          {bar}
        </div>
        <div className="mx-auto max-w-5xl px-4 py-5 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
          {body}
        </div>
      </BottomSheet>
    )
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      variant="fullscreen"
      padding={0}
      purpose="info"
      aria-label={host || t('pay.title')}
    >
      <Layout
        contentWidth={1024}
        header={
          <LayoutHeader
            padding={0}
            hasDivider
            className="bg-surface/90 px-3 pt-[max(4px,env(safe-area-inset-top,0px))] pb-1 backdrop-blur-md"
          >
            {bar}
          </LayoutHeader>
        }
        content={
          <LayoutContent padding={4}>
            <div className="py-2 pb-[env(safe-area-inset-bottom,0px)]">{body}</div>
          </LayoutContent>
        }
      />
    </Dialog>
  )
}
