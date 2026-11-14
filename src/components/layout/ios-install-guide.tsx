import {Button} from '@astryxdesign/core/Button'
import {Text} from '@astryxdesign/core/Text'
import {useIosInstallGuide} from '#/app/pwa'
import {AdaptiveSheet} from '#/components/common/adaptive-sheet'
import {useT} from '#/i18n'

const BASE = import.meta.env.BASE_URL

/**
 * Safari "Add to Home Screen" walkthrough modal (BottomSheet on phones, Dialog on desktop),
 * playing the lightweight autoplay MP4 guide.
 */
export function IosInstallGuide() {
  const t = useT()
  const {isOpen, setOpen} = useIosInstallGuide()

  return (
    <AdaptiveSheet
      isOpen={isOpen}
      onOpenChange={setOpen}
      title={t('app.installIosGuideTitle')}
      subtitle={t('app.installIosGuideSubtitle')}
      width={440}
      sheetHeight="tall"
      footer={<Button label={t('app.installIosGotIt')} variant="primary" width="100%" onClick={() => setOpen(false)} />}>
      <div className="flex flex-col gap-3">
        <Text type="supporting" className="md:hidden">
          {t('app.installIosGuideSubtitle')}
        </Text>
        <div className="flex items-center justify-center overflow-hidden rounded-2xl bg-black p-2">
          {isOpen ? (
            <video
              src={`${BASE}guides/safari-install.mp4`}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="max-h-[54dvh] w-auto rounded-xl object-contain"
            />
          ) : null}
        </div>
        <Text type="supporting" className="text-center text-xs">
          {t('app.installIosBody')}
        </Text>
      </div>
    </AdaptiveSheet>
  )
}
