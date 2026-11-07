import {Link, useLocation} from '@tanstack/react-router'
import {BookUser, Menu, QrCode, ScanLine, Shapes} from 'lucide-react'
import {useAppShellMobile} from '@astryxdesign/core/AppShell'
import {useT, type MessageKey} from '#/i18n'
import {isActivePath} from '#/app/nav'

const TABS: Array<{to: string; label: MessageKey; icon: typeof QrCode; fab?: boolean}> = [
  {to: '/', label: 'nav.createShort', icon: QrCode},
  {to: '/qr', label: 'nav.qrShort', icon: Shapes},
  {to: '/scan', label: 'nav.scan', icon: ScanLine, fab: true},
  {to: '/accounts', label: 'nav.accountsShort', icon: BookUser},
]

/** App-style bottom navigation for phones and installed PWAs. */
export function BottomTabs() {
  const t = useT()
  const pathname = useLocation({select: (l) => l.pathname})
  const {openMobileNav, isMobileNavOpen} = useAppShellMobile()
  return (
    <nav className="qv-tabbar qv-no-print" aria-label={t('nav.main')}>
      <ul className="grid grid-cols-5 max-w-lg mx-auto">
        {TABS.map((tab) => {
          const active = isActivePath(pathname, tab.to)
          const Icon = tab.icon
          return (
            <li key={tab.to}>
              <Link to={tab.to as never} className={`qv-tab${tab.fab ? ' qv-tab-fab' : ''}`} aria-current={active ? 'page' : undefined}>
                <span className="qv-tab-icon">
                  <Icon size={tab.fab ? 22 : 20} strokeWidth={active || tab.fab ? 2.4 : 2} aria-hidden />
                </span>
                <span>{t(tab.label)}</span>
              </Link>
            </li>
          )
        })}
        <li>
          <button type="button" className="qv-tab w-full" onClick={openMobileNav} aria-expanded={isMobileNavOpen}>
            <span className="qv-tab-icon">
              <Menu size={20} aria-hidden />
            </span>
            <span>{t('nav.menu')}</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
