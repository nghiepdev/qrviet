import {CheckCircle2, Download, WifiOff} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {Text} from '@astryxdesign/core/Text'
import {VStack} from '@astryxdesign/core/VStack'
import {useT} from '#/i18n'
import {promptInstall, useInstallState, useOnline} from '#/app/pwa'

export function SideNavFooter() {
  const t = useT()
  const online = useOnline()
  const {canPrompt, installed} = useInstallState()
  return (
    <VStack gap={2} padding={2}>
      {canPrompt && !installed && (
        <div className="rounded-lg p-3 qv-hero border border-border">
          <VStack gap={2}>
            <Text type="supporting">{t('app.tagline')}</Text>
            <Button label={t('app.install')} variant="primary" size="sm" width="100%" icon={<Download size={15} />} clickAction={async () => void (await promptInstall())} />
          </VStack>
        </div>
      )}
      <div className="flex items-center gap-2 px-1 text-xs text-secondary">
        {online ? <CheckCircle2 size={14} className="text-success" aria-hidden /> : <WifiOff size={14} className="text-warning" aria-hidden />}
        <span>{online ? t('set.offlineReady') : t('app.offlineHint')}</span>
      </div>
      <Text type="supporting" color="secondary">
        QRViet · v{__APP_VERSION__}
      </Text>
    </VStack>
  )
}
