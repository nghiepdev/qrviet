import {useEffect, useState} from 'react'
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
import {DateInput, type DateInputProps} from '@astryxdesign/core/DateInput'
import {DateTimeInput, type DateTimeInputProps} from '@astryxdesign/core/DateTimeInput'
import {Selector} from '@astryxdesign/core/Selector'
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {PageBody, PageHeader, Panel} from '#/components/common/page-header'
import {QrStage} from '#/components/qr/qr-stage'
import {ExportActions} from '#/components/qr/export-actions'
import {StylePanel} from '#/components/qr/style-panel'
import {AccentPicker} from '#/components/qr/template-picker'
import {effectiveStyle, resolveLogo, useTextMeasure} from '#/components/qr/use-qr-scene'
import {ScanCheckBadge, useScanCheck} from '#/components/vietqr/scan-check'
import {LogoMark} from '#/components/brand/logo'
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
  type EventData,
  type QrKind,
  type SocialPlatform,
} from '#/lib/payloads'
import {layoutQr, makeQr, type QrLogo, type QrStyle} from '#/lib/qr/render'
import {buildCaptionScene, buildTemplateScene, type TemplateLabels} from '#/lib/qr/templates'
import {templateLabels} from '#/components/vietqr/template-info'
import {sceneToStandaloneSvg, svgToDataUrl} from '#/lib/qr/export'
import type {Measure} from '#/lib/qr/scene'
import {slugify} from '#/lib/text'
import {patchStudio, studioStore, type StudioState} from '#/stores/studio'
import {addHistory} from '#/stores/history'
import {saveSceneThumb} from '#/lib/thumbs'
import {useSettings} from '#/stores/settings'
import {useCopy} from '#/hooks/use-copy'
import {useT, type MessageKey} from '#/i18n'
import {pageHead} from '#/seo/head'
import {useCoarsePointer} from '#/app/keyboard'
import {datePickerPresentation, sheetUnlessAnchored} from '#/app/anchoring'
import {HUES, type Hue} from '#/components/common/icon-badge'

const TYPES: Array<{id: QrKind; icon: typeof Link2; hue: Hue}> = [
  {id: 'url', icon: Link2, hue: 'blue'},
  {id: 'text', icon: FileText, hue: 'slate'},
  {id: 'wifi', icon: Wifi, hue: 'cyan'},
  {id: 'vcard', icon: UserRound, hue: 'violet'},
  {id: 'social', icon: AtSign, hue: 'pink'},
  {id: 'email', icon: Mail, hue: 'orange'},
  {id: 'sms', icon: MessageSquare, hue: 'green'},
  {id: 'phone', icon: Phone, hue: 'teal'},
  {id: 'geo', icon: MapPin, hue: 'red'},
  {id: 'event', icon: CalendarDays, hue: 'indigo'},
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
  head: () => pageHead('qr'),
  validateSearch: (s: Record<string, unknown>): {type?: QrKind} => ({
    type: TYPES.some((x) => x.id === s.type) ? (s.type as QrKind) : undefined,
  }),
  component: StudioPage,
})

/**
 * Switching between all-day and timed keeps the dates: all-day drops the times, and a timed event
 * starts at 09:00 and ends at 10:00 until a time is picked.
 */
function withAllDay(event: EventData, allDay: boolean): EventData {
  const day = (value: string) => value.slice(0, 10)
  const at = (value: string, time: string) => (value.length === 10 ? `${value}T${time}` : value)
  return allDay
    ? {...event, allDay, start: day(event.start), end: day(event.end)}
    : {...event, allDay, start: at(event.start, '09:00'), end: at(event.end, '10:00')}
}

/** Caption scene + a bare QR scene for the scan check. A plain function: try/catch stays out of render. */
function buildStudioScenes(
  payload: string,
  style: QrStyle,
  logo: QrLogo | null,
  caption: string,
  captionColor: string,
  labels: TemplateLabels,
  measure: Measure,
) {
  if (!payload) return {scene: null, qrScene: null, version: 0, error: null}
  try {
    const effective = effectiveStyle(style, logo)
    const model = makeQr(payload, effective.ecc)
    const geo = layoutQr(model, effective, logo)
    const qr = {geo, opts: {style: effective, logo}}
    return {
      scene: buildCaptionScene(qr, caption, captionColor, measure),
      qrScene: buildTemplateScene(
        'qr',
        {labels, accent: captionColor, showBrand: false},
        qr,
        measure,
      ),
      version: model.version,
      error: null,
    }
  } catch (e) {
    return {scene: null, qrScene: null, version: 0, error: (e as Error).message}
  }
}

/**
 * Studio scenes as a hook: values returned from hooks are frozen, so later uses in the
 * JSX (e.g. `version` inside a translation call) cannot stretch their memo scope past
 * other hook calls and make the compiler drop it.
 */
function useStudioScenes(
  payload: string,
  style: QrStyle,
  logo: QrLogo | null,
  caption: string,
  captionColor: string,
  labels: TemplateLabels,
) {
  const measure = useTextMeasure()
  return buildStudioScenes(payload, style, logo, caption, captionColor, labels, measure)
}

function payloadFor(s: StudioState, type: QrKind): string {
  switch (type) {
    case 'url':
      return normalizeUrl(s.url)
    case 'text':
      return s.text
    case 'wifi':
      return s.wifi.ssid ? buildWifi(s.wifi) : ''
    case 'vcard':
      return s.vcard.firstName || s.vcard.lastName || s.vcard.org || s.vcard.mobile
        ? buildVCard(s.vcard)
        : ''
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
  const coarse = useCoarsePointer()
  const navigate = useNavigate({from: '/qr'})
  const search = Route.useSearch()
  const state = useSelector(studioStore, (s) => s)
  const autoSave = useSettings((s) => s.autoSaveHistory)
  const [tab, setTab] = useState<'content' | 'style'>('content')
  const [mapInput, setMapInput] = useState('')
  // Self-contained (images inlined) snippet, prepared ahead so copying stays inside the click gesture.
  const [embedHtml, setEmbedHtml] = useState('')

  // Hooks above, derived values below: the compiler can only memoize values whose
  // construction does not straddle a hook call.
  const type = search.type ?? state.type
  const s = {...state, type}

  const setType = (next: QrKind) => {
    patchStudio({type: next})
    void navigate({search: {type: next}, replace: true, resetScroll: false})
  }

  // Derive from the store state (frozen) rather than the local `s`, so the compiler can memoize.
  const payload = payloadFor(state, type)
  const logo = resolveLogo(state)
  const {scene, qrScene, version, error} = useStudioScenes(
    payload,
    state.style,
    logo,
    state.caption,
    state.captionColor,
    templateLabels(t),
  )
  const scanStatus = useScanCheck(qrScene, payload || null)

  const onExported = () => {
    if (!payload || !autoSave) return
    const entry = addHistory({
      kind: 'qr',
      payload,
      title: payload.slice(0, 60),
      subtitle: t(`qr.type.${s.type}` as MessageKey),
      meta: {qrType: s.type},
      thumb: Boolean(scene),
    })
    if (scene) void saveSceneThumb(entry.id, scene)
  }

  useEffect(() => {
    let alive = true
    setEmbedHtml('')
    if (scene) {
      void sceneToStandaloneSvg(scene).then((svg) => {
        if (alive)
          setEmbedHtml(
            `<img src="${svgToDataUrl(svg)}" alt="QR code" width="${scene.width / 2}" height="${scene.height / 2}" />`,
          )
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
      patchStudio({
        geo: {...s.geo, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6)},
      }),
    )
  }

  const pasteMap = (value: string) => {
    setMapInput(value)
    const m =
      /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(value) ?? /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/.exec(value)
    if (m) patchStudio({geo: {...s.geo, lat: m[1], lng: m[2]}})
  }

  return (
    <>
      <PageHeader title={t('qr.title')} subtitle={t('qr.subtitle')} icon={<Shapes size={22} />} />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <Panel hue="violet">
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t('qr.type')}>
                {TYPES.map(({id, icon: Icon, hue}) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={id === type}
                    onClick={() => setType(id)}
                    className={`${HUES[hue]} qv-tile qv-tile-hue flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-semibold text-secondary sm:text-xs`}
                  >
                    <Icon size={19} aria-hidden />
                    <span className="max-w-full truncate">{t(`qr.type.${id}` as MessageKey)}</span>
                  </button>
                ))}
              </div>

              <SegmentedControl
                label={t('gen.design')}
                value={tab}
                onChange={(v) => setTab(v as 'content' | 'style')}
                layout="fill"
              >
                <SegmentedControlItem value="content" label={t('qr.text')} />
                <SegmentedControlItem value="style" label={t('gen.style')} />
              </SegmentedControl>

              {tab === 'content' ? (
                <div className="flex flex-col gap-4">
                  {type === 'url' && (
                    <TextInput
                      label={t('qr.url')}
                      type="url"
                      value={s.url}
                      onChange={(url) => patchStudio({url})}
                      placeholder="https://"
                      hasClear
                      inputMode="url"
                      autoCapitalize="off"
                      hasAutoFocus={!coarse}
                    />
                  )}
                  {type === 'text' && (
                    <TextArea
                      label={t('qr.text')}
                      value={s.text}
                      onChange={(text) => patchStudio({text})}
                      rows={5}
                      maxLength={900}
                    />
                  )}
                  {type === 'wifi' && (
                    <>
                      <TextInput
                        label={t('qr.wifi.ssid')}
                        value={s.wifi.ssid}
                        onChange={(ssid) => patchStudio({wifi: {...s.wifi, ssid}})}
                        hasClear
                        autoCapitalize="off"
                      />
                      <SegmentedControl
                        label={t('qr.wifi.security')}
                        value={s.wifi.security}
                        onChange={(v) =>
                          patchStudio({wifi: {...s.wifi, security: v as typeof s.wifi.security}})
                        }
                        layout="fill"
                      >
                        <SegmentedControlItem value="WPA" label="WPA/WPA2/WPA3" />
                        <SegmentedControlItem value="WEP" label="WEP" />
                        <SegmentedControlItem value="nopass" label={t('qr.wifi.none')} />
                      </SegmentedControl>
                      {s.wifi.security !== 'nopass' && (
                        <TextInput
                          label={t('qr.wifi.password')}
                          type="password"
                          value={s.wifi.password}
                          onChange={(password) => patchStudio({wifi: {...s.wifi, password}})}
                          autoComplete="off"
                        />
                      )}
                      <Switch
                        label={t('qr.wifi.hidden')}
                        value={s.wifi.hidden}
                        onChange={(hidden) => patchStudio({wifi: {...s.wifi, hidden}})}
                      />
                    </>
                  )}
                  {type === 'vcard' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(
                        [
                          'lastName',
                          'firstName',
                          'mobile',
                          'phone',
                          'email',
                          'org',
                          'title',
                          'website',
                        ] as const
                      ).map((k) => (
                        <TextInput
                          key={k}
                          label={t(`qr.vcard.${k}` as MessageKey)}
                          value={s.vcard[k]}
                          onChange={(v) => patchStudio({vcard: {...s.vcard, [k]: v}})}
                          type={
                            k === 'email'
                              ? 'email'
                              : k === 'mobile' || k === 'phone'
                                ? 'tel'
                                : k === 'website'
                                  ? 'url'
                                  : 'text'
                          }
                          hasClear
                        />
                      ))}
                      <div className="sm:col-span-2">
                        <TextInput
                          label={t('qr.vcard.address')}
                          value={s.vcard.address}
                          onChange={(address) => patchStudio({vcard: {...s.vcard, address}})}
                          hasClear
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <TextArea
                          label={t('qr.vcard.note')}
                          value={s.vcard.note}
                          onChange={(note) => patchStudio({vcard: {...s.vcard, note}})}
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                  {type === 'email' && (
                    <>
                      <TextInput
                        label={t('qr.email.to')}
                        type="email"
                        value={s.email.to}
                        onChange={(to) => patchStudio({email: {...s.email, to}})}
                        hasClear
                      />
                      <TextInput
                        label={t('qr.email.subject')}
                        value={s.email.subject}
                        onChange={(subject) => patchStudio({email: {...s.email, subject}})}
                        hasClear
                      />
                      <TextArea
                        label={t('qr.email.body')}
                        value={s.email.body}
                        onChange={(body) => patchStudio({email: {...s.email, body}})}
                        rows={4}
                      />
                    </>
                  )}
                  {type === 'sms' && (
                    <>
                      <TextInput
                        label={t('qr.sms.phone')}
                        type="tel"
                        value={s.sms.phone}
                        onChange={(phone) => patchStudio({sms: {...s.sms, phone}})}
                        hasClear
                      />
                      <TextArea
                        label={t('qr.sms.message')}
                        value={s.sms.message}
                        onChange={(message) => patchStudio({sms: {...s.sms, message}})}
                        rows={3}
                        maxLength={160}
                      />
                    </>
                  )}
                  {type === 'phone' && (
                    <TextInput
                      label={t('qr.phone')}
                      type="tel"
                      value={s.phone}
                      onChange={(phone) => patchStudio({phone})}
                      hasClear
                    />
                  )}
                  {type === 'geo' && (
                    <>
                      <TextInput
                        label={t('qr.geo.paste')}
                        value={mapInput}
                        onChange={pasteMap}
                        hasClear
                        placeholder="https://maps.google.com/…@10.7769,106.7009"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <TextInput
                          label={t('qr.geo.lat')}
                          value={s.geo.lat}
                          onChange={(lat) => patchStudio({geo: {...s.geo, lat}})}
                          inputMode="decimal"
                        />
                        <TextInput
                          label={t('qr.geo.lng')}
                          value={s.geo.lng}
                          onChange={(lng) => patchStudio({geo: {...s.geo, lng}})}
                          inputMode="decimal"
                        />
                      </div>
                      <TextInput
                        label={t('qr.geo.label')}
                        value={s.geo.label}
                        onChange={(label) => patchStudio({geo: {...s.geo, label}})}
                        isOptional
                        hasClear
                      />
                      {'geolocation' in navigator && (
                        <div>
                          <Button
                            label={t('qr.geo.here')}
                            icon={<LocateFixed size={16} />}
                            size="sm"
                            onClick={locate}
                          />
                        </div>
                      )}
                    </>
                  )}
                  {type === 'event' && (
                    <>
                      <TextInput
                        label={t('qr.event.title')}
                        value={s.event.title}
                        onChange={(title) => patchStudio({event: {...s.event, title}})}
                        hasClear
                      />
                      <TextInput
                        label={t('qr.event.location')}
                        value={s.event.location}
                        onChange={(location) => patchStudio({event: {...s.event, location}})}
                        isOptional
                        hasClear
                      />
                      <Switch
                        label={t('qr.event.allDay')}
                        value={s.event.allDay}
                        onChange={(allDay) => patchStudio({event: withAllDay(s.event, allDay)})}
                      />
                      {/* Side by side only when the panel is wide enough for a full date and time in each. */}
                      <div className="@container">
                        <div className="grid gap-3 @lg:grid-cols-2">
                          {s.event.allDay ? (
                            <>
                              <DateInput
                                label={t('qr.event.start')}
                                value={(s.event.start || undefined) as DateInputProps['value']}
                                onChange={(start) =>
                                  patchStudio({event: {...s.event, start: start ?? ''}})
                                }
                                presentation={datePickerPresentation}
                                width="100%"
                              />
                              <DateInput
                                label={t('qr.event.end')}
                                value={(s.event.end || undefined) as DateInputProps['value']}
                                min={(s.event.start || undefined) as DateInputProps['min']}
                                onChange={(end) =>
                                  patchStudio({event: {...s.event, end: end ?? ''}})
                                }
                                presentation={datePickerPresentation}
                                width="100%"
                              />
                            </>
                          ) : (
                            <>
                              <DateTimeInput
                                label={t('qr.event.start')}
                                value={(s.event.start || undefined) as DateTimeInputProps['value']}
                                onChange={(start) =>
                                  patchStudio({event: {...s.event, start: start ?? ''}})
                                }
                                presentation={datePickerPresentation}
                                width="100%"
                              />
                              <DateTimeInput
                                label={t('qr.event.end')}
                                value={(s.event.end || undefined) as DateTimeInputProps['value']}
                                min={(s.event.start || undefined) as DateTimeInputProps['min']}
                                onChange={(end) =>
                                  patchStudio({event: {...s.event, end: end ?? ''}})
                                }
                                presentation={datePickerPresentation}
                                width="100%"
                              />
                            </>
                          )}
                        </div>
                      </div>
                      <TextArea
                        label={t('qr.event.description')}
                        value={s.event.description}
                        onChange={(description) => patchStudio({event: {...s.event, description}})}
                        rows={3}
                      />
                    </>
                  )}
                  {type === 'social' && (
                    <>
                      <Selector
                        label={t('qr.social.platform')}
                        value={s.social.platform}
                        onChange={(platform) =>
                          patchStudio({social: {...s.social, platform: platform as SocialPlatform}})
                        }
                        options={PLATFORMS}
                        width="100%"
                        presentation={sheetUnlessAnchored('adaptive')}
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

                  <div className="flex flex-col gap-3 border-t border-border pt-2">
                    <TextInput
                      label={t('qr.frameText')}
                      value={s.caption}
                      onChange={(caption) => patchStudio({caption})}
                      placeholder={t('qr.frameTextPlaceholder')}
                      isOptional
                      hasClear
                    />
                    {s.caption && (
                      <AccentPicker
                        value={s.captionColor}
                        onChange={(captionColor) => patchStudio({captionColor})}
                        label={t('gen.accent')}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <StylePanel
                  style={s.style}
                  onStyle={(p) => patchStudio({style: {...studioStore.state.style, ...p}})}
                  design={s}
                  onDesign={(p) => patchStudio(p as Partial<StudioState>)}
                  allowBankLogo={false}
                  logo={logo}
                />
              )}
            </div>
          </Panel>

          <div className="flex min-w-0 flex-col gap-4 md:sticky md:top-20">
            <Panel hue="blue">
              <div className="flex flex-col gap-4">
                <QrStage
                  scene={scene}
                  label={payload}
                  checker={s.style.transparentBg}
                  empty={
                    <EmptyState icon={<LogoMark size={56} />} title={t('qr.empty')} isCompact />
                  }
                />
                {(payload || scanStatus === 'bad') && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ScanCheckBadge status={scanStatus} />
                    {payload && (
                      <span className="ml-auto text-xs text-secondary">
                        {t('qr.chars', {count: payload.length, version})}
                      </span>
                    )}
                  </div>
                )}
                {error && <p className="text-sm text-error">{error}</p>}
                <ExportActions
                  scene={scene}
                  filename={slugify(`qr-${s.type}-${payload.slice(0, 24)}`)}
                  onExported={onExported}
                  menuItems={[
                    {
                      id: 'embed',
                      label: t('qr.copyEmbed'),
                      icon: <Code2 size={16} />,
                      isDisabled: !embedHtml,
                      onClick: copyEmbed,
                    },
                  ]}
                />
              </div>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  )
}
