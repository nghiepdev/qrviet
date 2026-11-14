import {useEffect, useEffectEvent, useState, type ReactNode} from 'react'
import {useLocation} from '@tanstack/react-router'
import {AppShell, useAppShellMobile} from '@astryxdesign/core/AppShell'
import {TopNav, TopNavHeading, useTopNavRenderMode} from '@astryxdesign/core/TopNav'
import {SideNav, SideNavItem, SideNavSection, useSideNavRenderMode} from '@astryxdesign/core/SideNav'
import {useHotkeys, useMediaQuery} from '@astryxdesign/core/hooks'
import {useNavigate} from '@tanstack/react-router'
import {LogoMark} from '#/components/brand/logo'
import {NAV_ITEMS, SECTION_LABEL, isActivePath, type NavSection} from '#/app/nav'
import {useT} from '#/i18n'
import {cycleMode} from '#/stores/settings'
import {HeaderActions} from './header-actions'
import {BottomTabs} from './bottom-tabs'
import {CommandMenu} from './command-menu'
import {IosInstallGuide} from './ios-install-guide'
import {PwaManager} from './pwa-manager'
import {SideNavFooter} from './side-nav-footer'

const SECTIONS: NavSection[] = ['tools', 'data', 'more']

function NavSections({pathname}: {pathname: string}) {
  const t = useT()
  // In the phone drawer the first section's title is the drawer's own heading (see AppTopNav), so
  // it is not repeated above the items; screen readers still get it.
  const renderMode = useSideNavRenderMode()
  const inDrawer = renderMode === 'drawer' || renderMode === 'drawer-content'
  return (
    <>
      {SECTIONS.map((section, index) => (
        <SideNavSection key={section} title={t(SECTION_LABEL[section])} isHeaderHidden={inDrawer && index === 0}>
          {NAV_ITEMS.filter((i) => i.section === section).map((item) => (
            <SideNavItem
              key={item.to}
              label={t(item.label)}
              href={item.to}
              icon={item.icon}
              isSelected={isActivePath(pathname, item.to)}
            />
          ))}
        </SideNavSection>
      ))}
    </>
  )
}

/**
 * Closes the mobile drawer when the route changes (e.g. browser back).
 * `closeMobileNav` gets a new identity every time the drawer opens, so it must
 * not be an effect dependency — otherwise opening the drawer closes it again.
 */
function CloseDrawerOnNavigate({pathname}: {pathname: string}) {
  const {closeMobileNav} = useAppShellMobile()
  const close = useEffectEvent(() => closeMobileNav())
  useEffect(() => {
    close()
  }, [pathname])
  return null
}

/**
 * The sidebar by width: phones get the drawer and the bottom tab bar (below md, see AppShell's
 * `mobileNav`), tablets and small windows an icon rail (md to lg), wider screens the full sidebar.
 * The rail can still be expanded, or the sidebar collapsed; that choice lasts until the width
 * crosses into the other range.
 */
function useRail() {
  const isRailWidth = useMediaQuery('(768px <= width < 1024px)')
  const [choice, setChoice] = useState<{isRailWidth: boolean; isCollapsed: boolean} | null>(null)
  const isCollapsed = choice?.isRailWidth === isRailWidth ? choice.isCollapsed : isRailWidth
  return {isCollapsed, onCollapsedChange: (collapsed: boolean) => setChoice({isRailWidth, isCollapsed: collapsed})}
}

function MobileExtras() {
  const {isMobile} = useAppShellMobile()
  return isMobile ? <BottomTabs /> : null
}

/**
 * The top bar. On phones AppShell renders it a second time as the drawer, which takes the heading
 * for its own header. The drawer opens beside the bar's brand, so instead of repeating it the
 * drawer is headed by its first section's title (which NavSections then hides).
 */
function AppTopNav({isRailCollapsed, onOpenPalette}: {isRailCollapsed: boolean; onOpenPalette: () => void}) {
  const t = useT()
  const inDrawer = useTopNavRenderMode() === 'drawer'
  return (
    <TopNav
      label={t('nav.main')}
      // From md the sidebar's icons start 16px from the edge, centred at 24px. The mark lines up with
      // their left edge (and the section titles) beside the full sidebar, and centres over them
      // (-6px) above the icon rail.
      heading={inDrawer ? t(SECTION_LABEL[SECTIONS[0]]) : <TopNavHeading heading="QRViet" headingHref="/" logo={<LogoMark size={28} />} className={isRailCollapsed ? 'md:-ml-1.5' : undefined} />}
      endContent={<HeaderActions onOpenPalette={onOpenPalette} />}
    />
  )
}

export function AppLayout({children}: {children: ReactNode}) {
  const pathname = useLocation({select: (l) => l.pathname})
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const rail = useRail()

  useHotkeys([
    {keys: 'mod+k', onPress: () => setPaletteOpen((o) => !o), allowInInputs: true},
    {keys: 'shift+d', onPress: () => cycleMode()},
    {keys: 'shift+s', onPress: () => void navigate({to: '/scan'})},
  ])

  // Fade out the static boot splash once the shell is on screen.
  useEffect(() => {
    const boot = document.getElementById('boot')
    if (!boot) return
    boot.classList.add('qv-boot-done')
    const id = window.setTimeout(() => boot.remove(), 400)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <>
      <AppShell
        height="auto"
        variant="wash"
        contentPadding={0}
        // No hamburger in the top bar: on phones the bottom tab bar's Menu tab opens the drawer.
        mobileNav={{breakpoint: 'md', hasToggle: false}}
        topNav={<AppTopNav isRailCollapsed={rail.isCollapsed} onOpenPalette={() => setPaletteOpen(true)} />}
        sideNav={
          <SideNav footer={<SideNavFooter />} collapsible={rail}>
            <NavSections pathname={pathname} />
          </SideNav>
        }>
        <CloseDrawerOnNavigate pathname={pathname} />
        {/*
          Safe-area insets: status bar, home indicator and, in landscape, the notch side (installed iOS
          app). On phones the bottom pads exactly the tab bar (70px, plus the home indicator and any
          Safari toolbar it is lifted over); PageBody's own 32px is the gap left above it, which still
          clears the raised scan button.
        */}
        <div className="min-h-[calc(100dvh-64px-env(safe-area-inset-top))] pb-[calc(70px+env(safe-area-inset-bottom)+var(--qv-toolbar-overlap,0px))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:pb-10">
          {children}
        </div>
        <MobileExtras />
      </AppShell>
      <CommandMenu isOpen={paletteOpen} onOpenChange={setPaletteOpen} />
      <IosInstallGuide />
      <PwaManager />
    </>
  )
}
