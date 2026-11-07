import {persistedStore} from '#/lib/persist'
import {DEFAULT_QR_STYLE, type QrStyle, type LogoPlate} from '#/lib/qr/render'
import type {EmailData, EventData, GeoData, QrKind, SmsData, SocialData, VCardData, WifiData} from '#/lib/payloads'
import type {LogoMode} from './settings'

export interface StudioState {
  type: QrKind
  url: string
  text: string
  wifi: WifiData
  vcard: VCardData
  email: EmailData
  sms: SmsData
  phone: string
  geo: GeoData
  event: EventData
  social: SocialData
  caption: string
  captionColor: string
  style: QrStyle
  logoMode: LogoMode
  customLogo: string | null
  logoSize: number
  logoPlate: LogoPlate
}

export const STUDIO_DEFAULT: StudioState = {
  type: 'url',
  url: '',
  text: '',
  wifi: {ssid: '', password: '', security: 'WPA', hidden: false},
  vcard: {firstName: '', lastName: '', org: '', title: '', phone: '', mobile: '', email: '', website: '', address: '', note: ''},
  email: {to: '', subject: '', body: ''},
  sms: {phone: '', message: ''},
  phone: '',
  geo: {lat: '', lng: '', label: ''},
  event: {title: '', location: '', start: '', end: '', allDay: false, description: ''},
  social: {platform: 'zalo', handle: ''},
  caption: '',
  captionColor: '#d7263d',
  style: {...DEFAULT_QR_STYLE, dots: 'rounded', eyeFrame: 'rounded', eyeBall: 'rounded'},
  logoMode: 'none',
  customLogo: null,
  logoSize: 0.22,
  logoPlate: 'rounded',
}

export const studioStore = persistedStore<StudioState>({
  key: 'studio',
  version: 1,
  initial: STUDIO_DEFAULT,
  merge: (p, i) => ({...i, ...p, style: {...i.style, ...p.style}}),
})

export function patchStudio(patch: Partial<StudioState>) {
  studioStore.setState((s) => ({...s, ...patch}))
}
