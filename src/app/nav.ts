import {
  BookUser,
  History,
  Info,
  Landmark,
  Layers,
  Link2,
  QrCode,
  ScanLine,
  Settings,
  Shapes,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type {MessageKey} from '#/i18n'

export type NavSection = 'tools' | 'data' | 'more'

export interface NavItemDef {
  to: string
  label: MessageKey
  short?: MessageKey
  icon: LucideIcon
  section: NavSection
  keywords?: string
}

export const NAV_ITEMS: NavItemDef[] = [
  {to: '/', label: 'nav.create', short: 'nav.createShort', icon: QrCode, section: 'tools', keywords: 'tao ma vietqr chuyen khoan create transfer'},
  {to: '/scan', label: 'nav.scan', icon: ScanLine, section: 'tools', keywords: 'quet giai ma camera anh scan decode'},
  {to: '/qr', label: 'nav.qr', short: 'nav.qrShort', icon: Shapes, section: 'tools', keywords: 'wifi vcard danh thiep link url email sms su kien'},
  {to: '/link', label: 'nav.link', icon: Link2, section: 'tools', keywords: 'link thanh toan payment page chia se'},
  {to: '/batch', label: 'nav.batch', icon: Layers, section: 'tools', keywords: 'hang loat csv excel zip in tem nhan batch labels'},
  {to: '/tools', label: 'nav.tools.page', icon: Wrench, section: 'tools', keywords: 'tien ich crc doc so tien bang chu chia tien bo dau'},
  {to: '/accounts', label: 'nav.accounts', short: 'nav.accountsShort', icon: BookUser, section: 'data', keywords: 'so tai khoan luu accounts'},
  {to: '/history', label: 'nav.history', icon: History, section: 'data', keywords: 'lich su history'},
  {to: '/banks', label: 'nav.banks', icon: Landmark, section: 'data', keywords: 'ngan hang bin swift banks'},
  {to: '/settings', label: 'nav.settings', icon: Settings, section: 'more', keywords: 'cai dat giao dien theme ngon ngu sao luu'},
  {to: '/about', label: 'nav.about', icon: Info, section: 'more', keywords: 'gioi thieu about quyen rieng tu'},
]

export const SECTION_LABEL: Record<NavSection, MessageKey> = {
  tools: 'nav.tools',
  data: 'nav.data',
  more: 'nav.more',
}

export function isActivePath(current: string, to: string): boolean {
  if (to === '/') return current === '/' || current === ''
  return current === to || current.startsWith(`${to}/`)
}
