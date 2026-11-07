import {useEffect, useState, type ReactNode} from 'react'
import {useLocation} from '@tanstack/react-router'
import {AppShell, useAppShellMobile} from '@astryxdesign/core/AppShell'
import {TopNav, TopNavHeading} from '@astryxdesign/core/TopNav'
import {SideNav, SideNavItem, SideNavSection} from '@astryxdesign/core/SideNav'
import {useHotkeys} from '@astryxdesign/core/hooks'
import {useNavigate} from '@tanstack/react-router'
import {LogoMark} from '#/components/brand/Logo'
import {NAV_ITEMS, SECTION_LABEL, isActivePath, type NavSection} from '#/app/nav'
import {useT} from '#/i18n'
import {cycleMode} from '#/stores/settings'
import {HeaderActions} from './HeaderActions'
import {BottomTabs} from './BottomTabs'
import {CommandMenu} from './CommandMenu'
import {PwaManager} from './PwaManager'
import {SideNavFooter} from './SideNavFooter'

function NavSections({pathname}: {pathname: string}) {
  const t = useT()
  const sections: NavSection[] = ['tools', 'data', 'more']
  return (
    <>
      {sections.map((section) => (
        <SideNavSection key={section} title={t(SECTION_LABEL[section])}>
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

/** Closes the mobile drawer whenever the route changes. */
function CloseDrawerOnNavigate({pathname}: {pathname: string}) {
  const {closeMobileNav} = useAppShellMobile()
  useEffect(() => {
    closeMobileNav()
  }, [pathname, closeMobileNav])
  return null
}

function MobileExtras() {
  const {isMobile} = useAppShellMobile()
  return isMobile ? <BottomTabs /> : null
}

export function AppLayout({children}: {children: ReactNode}) {
  const t = useT()
  const pathname = useLocation({select: (l) => l.pathname})
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)

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
        mobileNav={{breakpoint: 'lg'}}
        topNav={
          <TopNav
            label={t('nav.main')}
            heading={<TopNavHeading heading="QRViet" headingHref="/" logo={<LogoMark size={28} />} />}
            endContent={<HeaderActions onOpenPalette={() => setPaletteOpen(true)} />}
          />
        }
        sideNav={
          <SideNav footer={<SideNavFooter />}>
            <NavSections pathname={pathname} />
          </SideNav>
        }>
        <CloseDrawerOnNavigate pathname={pathname} />
        <div className="min-h-[calc(100dvh-64px)] pb-[calc(84px+env(safe-area-inset-bottom))] lg:pb-10">{children}</div>
        <MobileExtras />
      </AppShell>
      <CommandMenu isOpen={paletteOpen} onOpenChange={setPaletteOpen} />
      <PwaManager />
    </>
  )
}
