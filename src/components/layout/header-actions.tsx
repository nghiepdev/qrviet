import {Download, Languages, Moon, Search, Sun, WifiOff} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {IconButton} from '@astryxdesign/core/IconButton'
import {Badge} from '@astryxdesign/core/Badge'
import {HStack} from '@astryxdesign/core/HStack'
import {Kbd} from '@astryxdesign/core/Kbd'
import {useTheme} from '@astryxdesign/core/theme'
import {useT} from '#/i18n'
import {cycleMode, updateSettings, useSettings} from '#/stores/settings'
import {promptInstall, useInstallState, useOnline} from '#/app/pwa'

export function HeaderActions({onOpenPalette}: {onOpenPalette: () => void}) {
  const t = useT()
  const locale = useSettings((s) => s.locale)
  const online = useOnline()
  const {canPrompt, installed} = useInstallState()
  const {mode} = useTheme()
  const isDark = mode === 'dark'

  return (
    <HStack gap={1} align="center">
      {!online && <Badge variant="warning" label={t('app.offline')} icon={<WifiOff size={12} />} />}
      <button
        type="button"
        onClick={onOpenPalette}
        className="hidden md:inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-md border border-border bg-surface text-secondary text-sm hover:border-strong transition-colors min-w-52"
        aria-label={t('app.search')}>
        <Search size={15} aria-hidden />
        <span className="flex-1 text-left">{t('app.search')}</span>
        <Kbd keys="mod+k" />
      </button>
      <span className="md:hidden">
        <IconButton label={t('app.search')} icon={<Search size={18} />} variant="ghost" onClick={onOpenPalette} />
      </span>
      <Button
        label={locale === 'vi' ? 'EN' : 'VI'}
        tooltip={locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
        variant="ghost"
        size="md"
        icon={<Languages size={16} />}
        onClick={() => updateSettings({locale: locale === 'vi' ? 'en' : 'vi'})}
      />
      <IconButton
        label={isDark ? t('common.light') : t('common.dark')}
        tooltip={`${isDark ? t('common.light') : t('common.dark')} (Shift+D)`}
        icon={isDark ? <Sun size={18} /> : <Moon size={18} />}
        variant="ghost"
        onClick={() => cycleMode()}
      />
      {canPrompt && !installed && (
        <span className="hidden sm:inline-flex">
          <Button label={t('app.install')} variant="primary" size="sm" icon={<Download size={15} />} clickAction={async () => void (await promptInstall())} />
        </span>
      )}
    </HStack>
  )
}
