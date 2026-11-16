import {useEffect, useState, type ReactNode} from 'react'
import {Link as RouterLink, useRouter} from '@tanstack/react-router'
import {Theme} from '@astryxdesign/core/theme'
import {LinkProvider} from '@astryxdesign/core/Link'
import {InternationalizationProvider} from '@astryxdesign/core/i18n'
import {LayerProvider} from '@astryxdesign/core/Layer'
import {useMediaQuery} from '@astryxdesign/core/hooks'
import viVN from '@astryxdesign/core/locales/vi-VN.generated.js'
import {useSettings} from '#/stores/settings'
import {setHeadLocale} from '#/seo/head'
import {buildTheme, findRecipe, loadBase, useLoadedBase, type ThemeRecipe} from '#/theme/presets'
import {FONTS} from '#/theme/fonts'
import {neutralTheme} from '@astryxdesign/theme-neutral/built'

type AnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href?: string
  ref?: React.Ref<HTMLAnchorElement>
}

/** Bridges Astryx links (href) to TanStack Router (to/search/hash) for SPA navigation. */
function AppLink({href = '', children, ...rest}: AnchorProps) {
  const external =
    /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href) ||
    rest.target === '_blank' ||
    rest.download !== undefined
  if (external || href.startsWith('#'))
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  const [pathAndSearch, hash] = href.split('#')
  const [path, query] = pathAndSearch.split('?')
  const search = query ? Object.fromEntries(new URLSearchParams(query)) : undefined
  return (
    <RouterLink to={path as never} search={search as never} hash={hash} {...(rest as object)}>
      {children}
    </RouterLink>
  )
}

/** The selected theme recipe (preset or custom). */
function useActiveRecipe(): ThemeRecipe {
  const themeId = useSettings((s) => s.themeId)
  const customThemes = useSettings((s) => s.customThemes)
  return findRecipe(themeId, customThemes)
}

function AppTheme({children}: {children: ReactNode}) {
  const recipe = useActiveRecipe()
  const font = useSettings((s) => s.font)
  const mode = useSettings((s) => s.mode)
  const base = useLoadedBase(recipe.base)
  const fontId = recipe.font ?? font
  const effectiveMode = recipe.forcedMode ?? mode
  // buildTheme caches per input, so `next` keeps its identity until the theme really changes.
  const next = buildTheme(recipe, base ?? neutralTheme, font)
  // Keep showing the previous theme while a lazily-loaded base downloads.
  const [current, setCurrent] = useState(next)
  if (base && next !== current) setCurrent(next)

  useEffect(() => {
    if (!base) void loadBase(recipe.base)
  }, [base, recipe.base])

  useEffect(() => {
    void FONTS[fontId]?.load()
  }, [fontId])

  // Browser chrome colour follows the page background.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const bg = getComputedStyle(document.body).backgroundColor
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((m) => m.setAttribute('content', bg))
    })
    return () => cancelAnimationFrame(id)
  }, [current, effectiveMode])

  return (
    <Theme theme={current} mode={effectiveMode}>
      {children}
    </Theme>
  )
}

/** Matches AppShell's `md` mobile breakpoint, where the bottom tab bar is shown. */
const TAB_BAR_QUERY = '(max-width: 767.98px)'

export function AppProviders({children}: {children: ReactNode}) {
  const locale = useSettings((s) => s.locale)
  const hasTabBar = useMediaQuery(TAB_BAR_QUERY)
  const router = useRouter()
  useEffect(() => {
    document.documentElement.lang = locale
    // Route heads read their locale when they run (src/seo/head.ts): re-run them so the title follows.
    if (setHeadLocale(locale)) void router.invalidate()
  }, [locale, router])
  return (
    <AppTheme>
      <InternationalizationProvider
        locale={locale === 'vi' ? 'vi-VN' : 'en'}
        messages={{'vi-VN': viVN}}
      >
        {/* Keep toasts and anchored layers clear of the bottom tab bar (and its raised scan button) on phones. */}
        <LayerProvider
          inset={
            hasTabBar
              ? {
                  blockEnd:
                    'calc(92px + env(safe-area-inset-bottom) + var(--qv-toolbar-overlap, 0px))',
                }
              : undefined
          }
        >
          <LinkProvider component={AppLink}>{children}</LinkProvider>
        </LayerProvider>
      </InternationalizationProvider>
    </AppTheme>
  )
}
