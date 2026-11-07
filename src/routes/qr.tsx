import {useCallback, useEffect, useMemo, useState} from 'react'
import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {useSelector} from '@tanstack/react-store'
import {
  AtSign,
  CalendarDays,
  Code2,
  FileText,
  Link2,
  LocateFixed,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Shapes,
  UserRound,
  Wifi,
} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {TextInput} from '@astryxdesign/core/TextInput'
import {TextArea} from '@astryxdesign/core/TextArea'
import {Switch} from '@astryxdesign/core/Switch'
import {Selector} from '@astryxdesign/core/Selector'
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {PageBody, PageHeader, Panel} from '#/components/common/PageHeader'
import {QrStage} from '#/components/qr/QrStage'
import {ExportActions} from '#/components/qr/ExportActions'
import {StylePanel} from '#/components/qr/StylePanel'
import {AccentPicker} from '#/components/qr/TemplatePicker'
import {effectiveStyle, resolveLogo, useFontsTick} from '#/components/qr/useQrScene'
import {ScanCheckBadge, useScanCheck} from '#/components/vietqr/ScanCheck'
import {LogoMark} from '#/components/brand/Logo'
import {
  buildEmail,
  buildEvent,
  buildGeo,
  buildPhone,
  buildSms,
  buildSocial,
  buildVCard,
  buildWifi,
  normalizeUrl,
  SOCIAL_PREFIX,
  type QrKind,
  type SocialPlatform,
} from '#/lib/payloads'
import {layoutQr, makeQr} from '#/lib/qr/render'
import {buildCaptionScene, buildTemplateScene} from '#/lib/qr/templates'
import {templateLabels} from '#/components/vietqr/templateInfo'
import {createMeasure, sceneToStandaloneSvg, svgToDataUrl} from '#/lib/qr/export'
import {slugify} from '#/lib/text'
import {patchStudio, studioStore, type StudioState} from '#/stores/studio'
import {addHistory} from '#/stores/history'
import {useSettings} from '#/stores/settings'
import {useCopy} from '#/hooks/useCopy'
import {useT, type MessageKey} from '#/i18n'

const TYPES: Array<{id: QrKind; icon: typeof Link2}> = [
  {id: 'url', icon: Link2},
  {id: 'text', icon: FileText},
  {id: 'wifi', icon: Wifi},
  {id: 'vcard', icon: UserRound},
  {id: 'social', icon: AtSign},
  {id: 'email', icon: Mail},
  {id: 'sms', icon: MessageSquare},
  {id: 'phone', icon: Phone},
  {id: 'geo', icon: MapPin},
  {id: 'event', icon: CalendarDays},
]

const PLATFORMS: Array<{value: SocialPlatform; label: string}> = [
  {value: 'zalo', label: 'Zalo'},
  {value: 'facebook', label: 'Facebook'},
  {value: 'messenger', label: 'Messenger'},
  {value: 'tiktok', label: 'TikTok'},
  {value: 'instagram', label: 'Instagram'},
  {value: 'youtube', label: 'YouTube'},
  {value: 'telegram', label: 'Telegram'},
  {value: 'x', label: 'X (Twitter)'},
  {value: 'shopee', label: 'Shopee'},
]

export const Route = createFileRoute('/qr')({
  validateSearch: (s: Record<string, unknown>): {type?: QrKind} => ({
    type: TYPES.some((x) => x.id === s.type) ? (s.type as QrKind) : undefined,
  }),
  component: StudioPage,
})

function payloadFor(s: StudioState): string {
  switch (s.type) {
    case 'url':
      return normalizeUrl(s.url)
    case 'text':
      return s.text
    case 'wifi':
      return s.wifi.ssid ? buildWifi(s.wifi) : ''
    case 'vcard':
      return s.vcard.firstName || s.vcard.lastName || s.vcard.org || s.vcard.mobile ? buildVCard(s.vcard) : ''
    case 'email':
      return s.email.to ? buildEmail(s.email) : ''
    case 'sms':
      return s.sms.phone ? buildSms(s.sms) : ''
    case 'phone':
      return s.phone.trim() ? buildPhone(s.phone) : ''
    case 'geo':
      return s.geo.lat && s.geo.lng ? buildGeo(s.geo) : ''
    case 'event':
      return s.event.title ? buildEvent(s.event) : ''
    case 'social':
      return s.social.handle.trim() ? buildSocial(s.social) : ''
  }
}

function StudioPage() {
  const t = useT()
  const copy = useCopy()
  const navigate = useNavigate({from: '/qr'})
  const search = Route.useSearch()
  const state = useSelector(studioStore, (s) => s)
  const autoSave = useSettings((s) => s.autoSaveHistory)
  const type = search.type ?? state.type
  const s = useMemo(() => ({...state, type}), [state, type])
  const [tab, setTab] = useState<'content' | 'style'>('content')
  const [mapInput, setMapInput] = useState('')
  const fontsTick = useFontsTick()

  const setType = (next: QrKind) => {
    patchStudio({type: next})
    void navigate({search: {type: next}, replace: true})
  }

  const payload = payloadFor(s)
  const logo = useMemo(() => resolveLogo(s), [s])
  const {scene, qrScene, version, error} = useMemo(() => {
    if (!payload) return {scene: null, qrScene: null, version: 0, error: null}
    try {
      const style = effectiveStyle(s.style, logo)
      const model = makeQr(payload, style.ecc)
      const geo = layoutQr(model, style, logo)
      const measure = createMeasure()
      const qr = {geo, opts: {style, logo}}
      const labels = templateLabels(t)
      return {
        scene: buildCaptionScene(qr, s.caption, s.captionColor, measure),
        qrScene: buildTemplateScene('qr', {labels, accent: s.captionColor, showBrand: false}, qr, measure),
        version: model.version,
        error: null,
      }
    } catch (e) {
      return {scene: null, qrScene: null, version: 0, error: (e as Error).message}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, s.style, logo, s.caption, s.captionColor, t, fontsTick])
  const scanStatus = useScanCheck(qrScene, payload || null)

  const onExported = useCallback(() => {
    if (!payload || !autoSave) return
    addHistory({kind: 'qr', payload, title: payload.slice(0, 60), subtitle: t(`qr.type.${s.type}` as MessageKey), meta: {qrType: s.type}})
  }, [payload, autoSave, s.type, t])

  // Self-contained (images inlined) snippet, prepared ahead so copying stays inside the click gesture.
  const [embedHtml, setEmbedHtml] = useState('')
  useEffect(() => {
    let alive = true
    setEmbedHtml('')
    if (scene) {
      void sceneToStandaloneSvg(scene).then((svg) => {
        if (alive) setEmbedHtml(`<img src="${svgToDataUrl(svg)}" alt="QR code" width="${scene.width / 2}" height="${scene.height / 2}" />`)
      })
    }
    return () => {
      alive = false
    }
  }, [scene])
  const copyEmbed = () => {
    if (embedHtml) void copy(embedHtml, t('qr.embedCopied'))
  }

  const locate = () => {
    navigator.geolocation?.getCurrentPosition((pos) =>
      patchStudio({geo: {...s.geo, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6)}}),
    )
  }

  const pasteMap = (value: string) => {
    setMapInput(value)
    const m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(value) ?? /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/.exec(value)
    if (m) patchStudio({geo: {...s.geo, lat: m[1], lng: m[2]}})
  }

  return (
    <>
      <PageHeader title={t('qr.title')} subtitle={t('qr.subtitle')} icon={<Shapes size={22} />} />
      <PageBody>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] items-start">
          <Panel>
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t('qr.type')}>
                {TYPES.map(({id, icon: Icon}) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={id === type}
                    onClick={() => setType(id)}
                    className="qv-tile flex flex-col items-center gap-1 py-2.5 px-1 text-[11px] sm:text-xs font-semibold text-secondary aria-checked:text-accent">
                    <Icon size={19} aria-hidden />
                    <span className="truncate max-w-full">{t(`qr.type.${id}` as MessageKey)}</span>
                  </button>
                ))}
              </div>

              <SegmentedControl label={t('gen.design')} value={tab} onChange={(v) => setTab(v as 'content' | 'style')} layout="fill">
                <SegmentedControlItem value="content" label={t('qr.text')} />
                <SegmentedControlItem value="style" label={t('gen.style')} />
              </SegmentedControl>

              {tab === 'content' ? (
                <div className="flex flex-col gap-4">
                  {type === 'url' && (
                    <TextInput label={t('qr.url')} type="url" value={s.url} onChange={(url) => patchStudio({url})} placeholder="https://" hasClear inputMode="url" autoCapitalize="off" hasAutoFocus />
                  )}
                  {type === 'text' && <TextArea label={t('qr.text')} value={s.text} onChange={(text) => patchStudio({text})} rows={5} maxLength={900} />}
                  {type === 'wifi' && (
                    <>
                      <TextInput label={t('qr.wifi.ssid')} value={s.wifi.ssid} onChange={(ssid) => patchStudio({wifi: {...s.wifi, ssid}})} hasClear autoCapitalize="off" />
                      <SegmentedControl label={t('qr.wifi.security')} value={s.wifi.security} onChange={(v) => patchStudio({wifi: {...s.wifi, security: v as typeof s.wifi.security}})} layout="fill" size="sm">
                        <SegmentedControlItem value="WPA" label="WPA/WPA2/WPA3" />
                        <SegmentedControlItem value="WEP" label="WEP" />
                        <SegmentedControlItem value="nopass" label={t('qr.wifi.none')} />
                      </SegmentedControl>
                      {s.wifi.security !== 'nopass' && (
                        <TextInput label={t('qr.wifi.password')} type="password" value={s.wifi.password} onChange={(password) => patchStudio({wifi: {...s.wifi, password}})} autoComplete="off" />
                      )}
                      <Switch label={t('qr.wifi.hidden')} value={s.wifi.hidden} onChange={(hidden) => patchStudio({wifi: {...s.wifi, hidden}})} />
                    </>
                  )}
                  {type === 'vcard' && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {(['lastName', 'firstName', 'mobile', 'phone', 'email', 'org', 'title', 'website'] as const).map((k) => (
                        <TextInput
                          key={k}
                          label={t(`qr.vcard.${k}` as MessageKey)}
                          value={s.vcard[k]}
                          onChange={(v) => patchStudio({vcard: {...s.vcard, [k]: v}})}
                          type={k === 'email' ? 'email' : k === 'mobile' || k === 'phone' ? 'tel' : k === 'website' ? 'url' : 'text'}
                          hasClear
                        />
                      ))}
                      <div className="sm:col-span-2">
                        <TextInput label={t('qr.vcard.address')} value={s.vcard.address} onChange={(address) => patchStudio({vcard: {...s.vcard, address}})} hasClear />
                      </div>
                      <div className="sm:col-span-2">
                        <TextArea label={t('qr.vcard.note')} value={s.vcard.note} onChange={(note) => patchStudio({vcard: {...s.vcard, note}})} rows={2} />
                      </div>
                    </div>
                  )}
                  {type === 'email' && (
                    <>
                      <TextInput label={t('qr.email.to')} type="email" value={s.email.to} onChange={(to) => patchStudio({email: {...s.email, to}})} hasClear />
                      <TextInput label={t('qr.email.subject')} value={s.email.subject} onChange={(subject) => patchStudio({email: {...s.email, subject}})} hasClear />
                      <TextArea label={t('qr.email.body')} value={s.email.body} onChange={(body) => patchStudio({email: {...s.email, body}})} rows={4} />
                    </>
                  )}
                  {type === 'sms' && (
                    <>
                      <TextInput label={t('qr.sms.phone')} type="tel" value={s.sms.phone} onChange={(phone) => patchStudio({sms: {...s.sms, phone}})} hasClear />
                      <TextArea label={t('qr.sms.message')} value={s.sms.message} onChange={(message) => patchStudio({sms: {...s.sms, message}})} rows={3} maxLength={160} />
                    </>
                  )}
                  {type === 'phone' && <TextInput label={t('qr.phone')} type="tel" value={s.phone} onChange={(phone) => patchStudio({phone})} hasClear />}
                  {type === 'geo' && (
                    <>
                      <TextInput label={t('qr.geo.paste')} value={mapInput} onChange={pasteMap} hasClear placeholder="https://maps.google.com/…@10.7769,106.7009" />
                      <div className="grid grid-cols-2 gap-3">
                        <TextInput label={t('qr.geo.lat')} value={s.geo.lat} onChange={(lat) => patchStudio({geo: {...s.geo, lat}})} inputMode="decimal" />
                        <TextInput label={t('qr.geo.lng')} value={s.geo.lng} onChange={(lng) => patchStudio({geo: {...s.geo, lng}})} inputMode="decimal" />
                      </div>
                      <TextInput label={t('qr.geo.label')} value={s.geo.label} onChange={(label) => patchStudio({geo: {...s.geo, label}})} isOptional hasClear />
                      {'geolocation' in navigator && (
                        <div>
                          <Button label={t('qr.geo.here')} icon={<LocateFixed size={16} />} size="sm" onClick={locate} />
                        </div>
                      )}
                    </>
                  )}
                  {type === 'event' && (
                    <>
                      <TextInput label={t('qr.event.title')} value={s.event.title} onChange={(title) => patchStudio({event: {...s.event, title}})} hasClear />
                      <TextInput label={t('qr.event.location')} value={s.event.location} onChange={(location) => patchStudio({event: {...s.event, location}})} isOptional hasClear />
                      <Switch label={t('qr.event.allDay')} value={s.event.allDay} onChange={(allDay) => patchStudio({event: {...s.event, allDay}})} />
                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1.5 text-sm font-semibold">
                          {t('qr.event.start')}
                          <input
                            type={s.event.allDay ? 'date' : 'datetime-local'}
                            value={s.event.start}
                            onChange={(e) => patchStudio({event: {...s.event, start: e.target.value}})}
                            className="h-10 rounded-md border border-border bg-surface px-3 font-normal"
                          />
                        </label>
                        <label className="flex flex-col gap-1.5 text-sm font-semibold">
                          {t('qr.event.end')}
                          <input
                            type={s.event.allDay ? 'date' : 'datetime-local'}
                            value={s.event.end}
                            onChange={(e) => patchStudio({event: {...s.event, end: e.target.value}})}
                            className="h-10 rounded-md border border-border bg-surface px-3 font-normal"
                          />
                        </label>
                      </div>
                      <TextArea label={t('qr.event.description')} value={s.event.description} onChange={(description) => patchStudio({event: {...s.event, description}})} rows={3} />
                    </>
                  )}
                  {type === 'social' && (
                    <>
                      <Selector
                        label={t('qr.social.platform')}
                        value={s.social.platform}
                        onChange={(platform) => patchStudio({social: {...s.social, platform: platform as SocialPlatform}})}
                        options={PLATFORMS}
                        width="100%"
                        presentation="adaptive"
                      />
                      <TextInput
                        label={t('qr.social.handle')}
                        value={s.social.handle}
                        onChange={(handle) => patchStudio({social: {...s.social, handle}})}
                        description={SOCIAL_PREFIX[s.social.platform]}
                        hasClear
                        autoCapitalize="off"
                      />
                    </>
                  )}

                  <div className="flex flex-col gap-3 pt-2 border-t border-border">
                    <TextInput
                      label={t('qr.frameText')}
                      value={s.caption}
                      onChange={(caption) => patchStudio({caption})}
                      placeholder={t('qr.frameTextPlaceholder')}
                      isOptional
                      hasClear
                    />
                    {s.caption && <AccentPicker value={s.captionColor} onChange={(captionColor) => patchStudio({captionColor})} label={t('gen.accent')} />}
                  </div>
                </div>
              ) : (
                <StylePanel
                  style={s.style}
                  onStyle={(p) => patchStudio({style: {...studioStore.state.style, ...p}})}
                  design={s}
                  onDesign={(p) => patchStudio(p as Partial<StudioState>)}
                  allowBankLogo={false}
                />
              )}
            </div>
          </Panel>

          <div className="flex flex-col gap-4 lg:sticky lg:top-20 min-w-0">
            <Panel>
              <div className="flex flex-col gap-4">
                <QrStage
                  scene={scene}
                  label={payload}
                  checker={s.style.transparentBg}
                  empty={<EmptyState icon={<LogoMark size={56} />} title={t('qr.empty')} isCompact />}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 min-h-7">
                  <ScanCheckBadge status={scanStatus} />
                  {payload && <span className="text-xs text-secondary">{t('qr.chars', {count: payload.length, version})}</span>}
                </div>
                {error && <p className="text-sm text-error">{error}</p>}
                <ExportActions
                  scene={scene}
                  filename={slugify(`qr-${s.type}-${payload.slice(0, 24)}`)}
                  onExported={onExported}
                  extra={<Button label={t('qr.copyEmbed')} icon={<Code2 size={16} />} variant="ghost" isDisabled={!embedHtml} onClick={copyEmbed} />}
                />
              </div>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  )
}
