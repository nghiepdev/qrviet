import {Download} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {Text} from '@astryxdesign/core/Text'
import {VStack} from '@astryxdesign/core/VStack'
import {useSideNavCollapse} from '@astryxdesign/core/SideNav'
import {useT} from '#/i18n'
import {promptInstall, useInstallState} from '#/app/pwa'

/**
 * The install card, while the browser offers to install the app. The icon rail (tablet widths) has
 * no room for it; the install button in the top bar stands in there.
 */
export function SideNavFooter() {
  const t = useT()
  const {canPrompt, installed} = useInstallState()
  const {isCollapsed} = useSideNavCollapse()
  if (isCollapsed || !canPrompt || installed) return null
  return (
    // `qv-sidenav-footer`: styles.css pins it to the bottom of the mobile drawer.
    <VStack gap={2} padding={2} className="qv-sidenav-footer">
      <div className="rounded-lg p-3 qv-hero border border-border">
        <VStack gap={2}>
          <Text type="supporting">{t('app.tagline')}</Text>
          <Button label={t('app.install')} variant="primary" size="sm" width="100%" icon={<Download size={15} />} clickAction={async () => void (await promptInstall())} />
        </VStack>
      </div>
    </VStack>
  )
}
