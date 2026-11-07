import {useEffect, useMemo, useState, type ReactNode} from 'react'
import {Link as RouterLink} from '@tanstack/react-router'
import {Theme} from '@astryxdesign/core/theme'
import {LinkProvider} from '@astryxdesign/core/Link'
import {InternationalizationProvider} from '@astryxdesign/core/i18n'
import {LayerProvider} from '@astryxdesign/core/Layer'
import {useMediaQuery} from '@astryxdesign/core/hooks'
import viVN from '@astryxdesign/core/locales/vi-VN.generated.js'
import {useSettings} from '#/stores/settings'
import {buildTheme, findRecipe, getLoadedBase, loadBase} from '#/theme/presets'
import {FONTS} from '#/theme/fonts'
import {neutralTheme} from '@astryxdesign/theme-neutral/built'

type AnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {href?: string; ref?: React.Ref<HTMLAnchorElement>}

/** Bridges Astryx links (href) to TanStack Router (to/search/hash) for SPA navigation. */
function AppLink({href = '', ...rest}: AnchorProps) {
  const external = /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href) || rest.target === '_blank' || rest.download !== undefined
  if (external || href.startsWith('#')) return <a href={href} {...rest} />
  const [pathAndSearch, hash] = href.split('#')
  const [path, query] = pathAndSearch.split('?')
  const search = query ? Object.fromEntries(new URLSearchParams(query)) : undefined
  return <RouterLink to={path as never} search={search as never} hash={hash} {...(rest as object)} />
}

function AppTheme({children}: {children: ReactNode}) {
  const themeId = useSettings((s) => s.themeId)
  const customThemes = useSettings((s) => s.customThemes)
  const font = useSettings((s) => s.font)
  const mode = useSettings((s) => s.mode)
  const recipe = useMemo(() => findRecipe(themeId, customThemes), [themeId, customThemes])
  const [, setLoadedTick] = useState(0)
  const base = getLoadedBase(recipe.base)

  useEffect(() => {
    if (!base) loadBase(recipe.base).then(() => setLoadedTick((n) => n + 1))
  }, [base, recipe.base])

  const fontId = recipe.font ?? font
  useEffect(() => {
    void FONTS[fontId]?.load()
  }, [fontId])

  // Keep showing the previous theme while a lazily-loaded base downloads.
  const [current, setCurrent] = useState(() => buildTheme(recipe, base ?? neutralTheme, font))
  const next = useMemo(() => (base ? buildTheme(recipe, base, font) : null), [recipe, base, font])
  if (next && next !== current) setCurrent(next)

  const effectiveMode = recipe.forcedMode ?? mode

  // Browser chrome colour follows the page background.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const bg = getComputedStyle(document.body).backgroundColor
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg))
    })
    return () => cancelAnimationFrame(id)
  }, [current, effectiveMode])

  return (
    <Theme theme={current} mode={effectiveMode}>
      {children}
    </Theme>
  )
}

/** Matches AppShell's `lg` mobile breakpoint, where the bottom tab bar is shown. */
const TAB_BAR_QUERY = '(max-width: 1023.98px)'

export function AppProviders({children}: {children: ReactNode}) {
  const locale = useSettings((s) => s.locale)
  const hasTabBar = useMediaQuery(TAB_BAR_QUERY)
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return (
    <AppTheme>
      <InternationalizationProvider locale={locale === 'vi' ? 'vi-VN' : 'en'} messages={{'vi-VN': viVN}}>
        {/* Keep toasts and anchored layers clear of the bottom tab bar on phones. */}
        <LayerProvider inset={hasTabBar ? {blockEnd: 'calc(70px + env(safe-area-inset-bottom))'} : undefined}>
          <LinkProvider component={AppLink}>{children}</LinkProvider>
        </LayerProvider>
      </InternationalizationProvider>
    </AppTheme>
  )
}
