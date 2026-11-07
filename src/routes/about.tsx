import {createFileRoute} from '@tanstack/react-router'
import {BadgeCheck, Info, Lock, Sparkles} from 'lucide-react'
import {Heading} from '@astryxdesign/core/Heading'
import {Text} from '@astryxdesign/core/Text'
import {Button} from '@astryxdesign/core/Button'
import {PageBody, PageHeader, Panel} from '#/components/common/PageHeader'
import {Logo, LogoMark} from '#/components/brand/Logo'
import {BANKS} from '#/data/banks'
import {useT} from '#/i18n'

export const Route = createFileRoute('/about')({component: AboutPage})

const CREDITS = [
  ['Astryx', 'https://github.com/meta/astryx', 'Design system (Meta)'],
  ['TanStack Router & Store', 'https://tanstack.com', 'Routing, state'],
  ['uqr', 'https://github.com/unjs/uqr', 'QR encoder'],
  ['jsQR', 'https://github.com/cozmo/jsQR', 'QR decoder fallback'],
  ['Vite PWA', 'https://vite-pwa-org.netlify.app', 'Offline & install'],
  ['Lucide', 'https://lucide.dev', 'Icons'],
  ['Be Vietnam Pro', 'https://fonts.google.com/specimen/Be+Vietnam+Pro', 'Typeface (OFL)'],
  ['VietQR bank list', 'https://api.vietqr.io/v2/banks', 'Bank directory data'],
] as const

function AboutPage() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('about.title')} subtitle={t('app.tagline')} icon={<Info size={22} />} />
      <PageBody>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] items-start">
          <div className="flex flex-col gap-5">
            <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm qv-hero">
              <div className="flex items-center gap-4">
                <LogoMark size={72} animated />
                <div>
                  <Logo size={34} />
                  <p className="mt-2 max-w-xl">
                    <Text type="large">{t('about.lead')}</Text>
                  </p>
                </div>
              </div>
            </section>
            <Panel title={<span className="inline-flex items-center gap-2"><Sparkles size={18} aria-hidden />{t('about.features')}</span>}>
              <ul className="grid sm:grid-cols-2 gap-3">
                {(['about.f1', 'about.f2', 'about.f3', 'about.f4', 'about.f5', 'about.f6'] as const).map((k) => (
                  <li key={k} className="flex items-start gap-2">
                    <BadgeCheck size={18} className="text-accent shrink-0 mt-0.5" aria-hidden />
                    <span>{t(k).replace('70+', `${BANKS.length}`)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button label={t('nav.create')} variant="primary" href="/" />
                <Button label={t('nav.scan')} href="/scan" />
              </div>
            </Panel>
            <Panel title={t('about.standard')}>
              <Text type="body">{t('about.standardBody')}</Text>
            </Panel>
          </div>
          <div className="flex flex-col gap-5">
            <Panel title={<span className="inline-flex items-center gap-2"><Lock size={18} aria-hidden />{t('about.privacy')}</span>}>
              <Text type="body">{t('about.privacyBody')}</Text>
              <div className="mt-3">
                <Text type="supporting" color="secondary">
                  {t('about.disclaimer')}
                </Text>
              </div>
            </Panel>
            <Panel title={t('about.credits')}>
              <ul className="flex flex-col divide-y divide-[var(--color-border)]">
                {CREDITS.map(([name, href, note]) => (
                  <li key={name} className="py-2 flex items-center justify-between gap-3">
                    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-accent">
                      {name}
                    </a>
                    <span className="text-xs text-secondary text-right">{note}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <div className="text-center">
              <Heading level={4}>QRViet v{__APP_VERSION__}</Heading>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  )
}
