import {createFileRoute, Link} from '@tanstack/react-router'
import {
  ArrowUpRight,
  Binary,
  Blocks,
  ChevronDown,
  CircleHelp,
  EyeOff,
  Info,
  Layers,
  Lock,
  MegaphoneOff,
  Palette,
  QrCode,
  ScanLine,
  ServerOff,
  SunMoon,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import {Text} from '@astryxdesign/core/Text'
import {Button} from '@astryxdesign/core/Button'
import {Heading} from '@astryxdesign/core/Heading'
import {PageBody, PageHeader, Panel} from '#/components/common/page-header'
import {IconBadge, HUES, type Hue} from '#/components/common/icon-badge'
import {LogoMark} from '#/components/brand/logo'
import {MarkedText, type MarkStyle} from '#/components/common/marked-text'
import {BANKS} from '#/data/banks'
import {useT, type MessageKey} from '#/i18n'
import {pageHead} from '#/seo/head'

export const Route = createFileRoute('/about')({
  head: () => pageHead('about'),
  component: AboutPage,
})

const REPO = 'nghiepdev/qrviet'

const CREDITS = [
  ['Astryx', 'https://github.com/meta/astryx', 'Design system (Meta)'],
  ['TanStack Start & Store', 'https://tanstack.com', 'Framework, routing, state'],
  ['uqr', 'https://github.com/unjs/uqr', 'QR encoder'],
  ['jsQR', 'https://github.com/cozmo/jsQR', 'QR decoder fallback'],
  ['Serwist', 'https://serwist.pages.dev', 'Service worker, offline'],
  ['Lucide', 'https://lucide.dev', 'Icons'],
  ['Be Vietnam Pro', 'https://fonts.google.com/specimen/Be+Vietnam+Pro', 'Typeface (OFL)'],
  ['VietQR bank list', 'https://api.vietqr.io/v2/banks', 'Bank directory data'],
] as const

/** The lead's selling points: an underline for open source, a marker over the privacy promise. */
const LEAD_MARKS: readonly MarkStyle[] = [
  {type: 'underline', multiline: true, strokeWidth: 2, padding: 2, iterations: 2, animationDuration: 600},
  {type: 'highlight', multiline: true, iterations: 1, animationDuration: 1000},
]

/** What QRViet does, each card linking to the page that does it. */
const FEATURES: ReadonlyArray<{title: MessageKey; body: MessageKey; icon: LucideIcon; hue: Hue; to: string}> = [
  {title: 'about.f1Title', body: 'about.f1', icon: QrCode, hue: 'red', to: '/'},
  {title: 'about.f2Title', body: 'about.f2', icon: ScanLine, hue: 'blue', to: '/scan'},
  {title: 'about.f3Title', body: 'about.f3', icon: Palette, hue: 'pink', to: '/qr'},
  {title: 'about.f4Title', body: 'about.f4', icon: Layers, hue: 'violet', to: '/batch'},
  {title: 'about.f5Title', body: 'about.f5', icon: WifiOff, hue: 'green', to: '/settings'},
  {title: 'about.f6Title', body: 'about.f6', icon: SunMoon, hue: 'amber', to: '/settings'},
]

const PROMISES: ReadonlyArray<{label: MessageKey; icon: LucideIcon}> = [
  {label: 'about.noServer', icon: ServerOff},
  {label: 'about.noTracking', icon: EyeOff},
  {label: 'about.noAds', icon: MegaphoneOff},
]

const SPEC: ReadonlyArray<readonly [MessageKey, string]> = [
  ['about.specStandard', 'EMVCo MPM · NAPAS VietQR'],
  ['about.specGuid', 'A000000727'],
  ['about.specService', 'QRIBFTTA · QRIBFTTC'],
  ['about.specCurrency', '704 (VND)'],
  ['about.specChecksum', 'CRC16-CCITT'],
]

const FAQ: ReadonlyArray<readonly [MessageKey, MessageKey]> = [
  ['faq.q1', 'faq.a1'],
  ['faq.q2', 'faq.a2'],
  ['faq.q3', 'faq.a3'],
  ['faq.q4', 'faq.a4'],
  ['faq.q5', 'faq.a5'],
  ['faq.q6', 'faq.a6'],
]

function AboutPage() {
  const t = useT()
  const withBankCount = (text: string) => text.replace('70+', `${BANKS.length}`)
  const stats: ReadonlyArray<readonly [string, MessageKey]> = [
    [`${BANKS.length}`, 'about.statBanks'],
    ['100%', 'about.statLocal'],
    ['0 ₫', 'about.statFree'],
  ]
  return (
    <>
      <PageHeader title={t('about.title')} subtitle={t('app.tagline')} icon={<Info size={22} />} />
      <PageBody>
        <div className="flex flex-col gap-5">
          <section className="qv-hero relative overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
              <LogoMark size={88} animated className="shrink-0" />
              <div className="flex min-w-0 flex-col gap-4">
                <p className="max-w-2xl">
                  <Text type="large">
                    <MarkedText text={t('about.lead')} marks={LEAD_MARKS} />
                  </Text>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button label={t('nav.create')} icon={<QrCode size={16} />} variant="primary" href="/" />
                  <Button label={t('nav.scan')} icon={<ScanLine size={16} />} href="/scan" />
                </div>
              </div>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={t('about.stats')}>
              {stats.map(([value, label]) => (
                <li key={label} className="rounded-lg border border-border bg-surface/80 px-4 py-3">
                  <span className="qv-num block text-2xl font-extrabold text-accent">{value}</span>
                  <span className="block text-sm text-secondary">{t(label)}</span>
                </li>
              ))}
              {/* The source: the same tile, opening the repository. */}
              <li>
                <a
                  href={`https://github.com/${REPO}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full flex-col rounded-lg border border-border bg-surface/80 px-4 py-3 transition-colors hover:border-[var(--color-border-emphasized)] hover:bg-surface">
                  <span className="flex items-center gap-2 text-2xl font-extrabold text-accent">
                    GitHub
                    {/* No room beside the name in a phone's two-column grid. */}
                    <ArrowUpRight size={18} className="ml-auto hidden shrink-0 text-secondary group-hover:text-accent sm:block" aria-hidden />
                  </span>{' '}
                  <span className="qv-mono block text-sm text-secondary">
                    {/* Breaks after the slash rather than mid-word when the tile is narrow. */}
                    {REPO.split('/')[0]}/<wbr />
                    {REPO.split('/')[1]}
                  </span>
                </a>
              </li>
            </ul>
          </section>

          <section aria-labelledby="about-features" className="flex flex-col gap-3">
            <Heading level={2} id="about-features">
              {t('about.features')}
            </Heading>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => {
                const Icon = f.icon
                return (
                  <li key={f.title}>
                    <Link
                      to={f.to}
                      className={`${HUES[f.hue]} qv-tint group flex h-full items-start gap-3 rounded-2xl border border-border p-4 shadow-sm transition hover:border-[color-mix(in_srgb,var(--qv-hue)_45%,transparent)] hover:shadow-md`}>
                      <IconBadge hue={f.hue}>
                        <Icon size={20} />
                      </IconBadge>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-semibold">{t(f.title)}</span>
                        <span className="text-sm text-secondary">{withBankCount(t(f.body))}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] items-start">
            <Panel title={t('about.privacy')} icon={Lock} hue="green">
              <ul className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {PROMISES.map(({label, icon: Icon}) => (
                  <li key={label} className="flex items-center gap-2.5 rounded-lg bg-success-muted/60 px-3 py-2.5 text-sm font-semibold">
                    <Icon size={18} className="shrink-0 text-success" aria-hidden />
                    {t(label)}
                  </li>
                ))}
              </ul>
              {/* Block-level Text keeps its own line height instead of the panel's 16px/24px strut. */}
              <Text type="body" display="block">
                {t('about.privacyBody')}
              </Text>
              <div className="mt-3">
                <Text type="supporting" color="secondary" display="block">
                  {t('about.disclaimer')}
                </Text>
              </div>
            </Panel>
            <Panel title={t('about.standard')} icon={Binary} hue="cyan">
              <dl className="flex flex-col divide-y divide-[var(--color-border)]">
                {SPEC.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-sm text-secondary">{t(label)}</dt>
                    <dd className="qv-mono rounded-md bg-muted px-2 py-0.5 text-right text-sm font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>

          <Panel title={t('faq.title')} icon={CircleHelp} hue="blue">
            {/* Native <details>: answers stay in the DOM (searchable, indexable) while collapsed. */}
            <div className="flex flex-col divide-y divide-[var(--color-border)]">
              {FAQ.map(([q, a], i) => (
                <details key={q} className="group py-1" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-2 [&::-webkit-details-marker]:hidden">
                    <h3 className="text-base font-semibold">{t(q)}</h3>
                    <ChevronDown size={18} className="shrink-0 text-secondary transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="pb-3">
                    <Text type="body" color="secondary">
                      {t(a)}
                    </Text>
                  </p>
                </details>
              ))}
            </div>
          </Panel>
          <Panel title={t('about.credits')} icon={Blocks} hue="violet">
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CREDITS.map(([name, href, note]) => (
                <li key={name}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:border-[var(--color-border-emphasized)] hover:bg-muted">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold group-hover:text-accent">{name}</span>
                      <span className="truncate text-xs text-secondary">{note}</span>
                    </span>
                    <ArrowUpRight size={16} className="shrink-0 text-secondary group-hover:text-accent" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </PageBody>
    </>
  )
}
