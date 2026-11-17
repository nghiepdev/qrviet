import {normalizePhone, type Classified, type SocialPlatform} from './payloads'
import type {QrSearch} from './route-search'
import type {StudioState} from '#/stores/studio'

function socialFromUrl(value: string): {platform: SocialPlatform; handle: string} | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.search || url.hash) return null
  const host = url.hostname.replace(/^www\./i, '').toLowerCase()
  const path = url.pathname.replace(/^\/+|\/+$/g, '')
  if (!path || path.includes('/')) return null
  if (host === 'zalo.me' && /^\+?\d{8,15}$/.test(path)) return {platform: 'zalo', handle: path}
  if (host === 'facebook.com' && /^[A-Za-z0-9.]{3,}$/.test(path))
    return {platform: 'facebook', handle: path}
  if (host === 'm.me' && /^[A-Za-z0-9.]{3,}$/.test(path))
    return {platform: 'messenger', handle: path}
  if (host === 'tiktok.com' && /^@[A-Za-z0-9._]{2,}$/.test(path))
    return {platform: 'tiktok', handle: path.slice(1)}
  if (host === 'instagram.com' && /^[A-Za-z0-9._]{2,}$/.test(path))
    return {platform: 'instagram', handle: path}
  if (host === 'youtube.com' && /^@[A-Za-z0-9._-]{2,}$/.test(path))
    return {platform: 'youtube', handle: path.slice(1)}
  if (host === 't.me' && /^[A-Za-z0-9_]{3,}$/.test(path))
    return {platform: 'telegram', handle: path}
  if ((host === 'x.com' || host === 'twitter.com') && /^[A-Za-z0-9_]{1,15}$/.test(path))
    return {platform: 'x', handle: path}
  if (host === 'shopee.vn' && /^[A-Za-z0-9._-]{2,}$/.test(path))
    return {platform: 'shopee', handle: path}
  return null
}

export function qrSearchFromClassified(classified: Classified): QrSearch | null {
  switch (classified.type) {
    case 'url': {
      const social = socialFromUrl(classified.url)
      return social ? {type: 'social', ...social} : {type: 'url', url: classified.url}
    }
    case 'phone':
      return {type: 'phone', phone: normalizePhone(classified.phone)}
    case 'sms':
      return {type: 'sms', phone: normalizePhone(classified.phone), message: classified.message}
    case 'email':
      return {type: 'email', to: classified.to, subject: classified.subject, body: classified.body}
    case 'wifi':
      return {type: 'wifi', ...classified.wifi}
    case 'vcard':
      return {type: 'vcard', ...classified.vcard}
    case 'geo': {
      const prefix = `${classified.lat},${classified.lng}(`
      const label =
        classified.query.startsWith(prefix) && classified.query.endsWith(')')
          ? classified.query.slice(prefix.length, -1)
          : classified.query
      return {type: 'geo', lat: classified.lat, lng: classified.lng, label}
    }
    case 'event':
      return classified.event ? {type: 'event', ...classified.event} : null
    case 'text':
      return {type: 'text', text: classified.text}
    default:
      return null
  }
}

/** Payload fields replace their QR kind; caption-only links keep the current content. */
export function studioPatchFromSearch(
  search: QrSearch,
  current: StudioState,
): Partial<StudioState> | null {
  const {type, caption, ...content} = search
  if (!Object.values(content).some((value) => value !== undefined)) {
    return caption !== undefined ? {type: type ?? current.type, caption} : null
  }
  const inferredType =
    type ??
    (search.url !== undefined
      ? 'url'
      : search.ssid !== undefined
        ? 'wifi'
        : search.to !== undefined
          ? 'email'
          : search.lat !== undefined || search.lng !== undefined
            ? 'geo'
            : search.platform !== undefined || search.handle !== undefined
              ? 'social'
              : search.message !== undefined
                ? 'sms'
                : search.firstName !== undefined || search.lastName !== undefined
                  ? 'vcard'
                  : search.start !== undefined || search.allDay !== undefined
                    ? 'event'
                    : search.phone !== undefined
                      ? 'phone'
                      : search.text !== undefined
                        ? 'text'
                        : current.type)
  const patch: Partial<StudioState> = {type: inferredType}
  if (caption !== undefined) patch.caption = caption
  switch (inferredType) {
    case 'url':
      if (search.url !== undefined) patch.url = search.url
      break
    case 'text':
      if (search.text !== undefined) patch.text = search.text
      break
    case 'phone':
      if (search.phone !== undefined) patch.phone = search.phone
      break
    case 'wifi':
      patch.wifi = {
        ssid: search.ssid ?? '',
        password: search.password ?? '',
        security: search.security ?? 'WPA',
        hidden: search.hidden ?? false,
      }
      break
    case 'vcard':
      patch.vcard = {
        firstName: search.firstName ?? '',
        lastName: search.lastName ?? '',
        org: search.org ?? '',
        title: search.title ?? '',
        phone: search.phone ?? '',
        mobile: search.mobile ?? '',
        email: search.email ?? '',
        website: search.website ?? '',
        address: search.address ?? '',
        note: search.note ?? '',
      }
      break
    case 'email':
      patch.email = {to: search.to ?? '', subject: search.subject ?? '', body: search.body ?? ''}
      break
    case 'sms':
      patch.sms = {phone: search.phone ?? '', message: search.message ?? ''}
      break
    case 'geo':
      patch.geo = {lat: search.lat ?? '', lng: search.lng ?? '', label: search.label ?? ''}
      break
    case 'event':
      patch.event = {
        title: search.title ?? '',
        location: search.location ?? '',
        start: search.start ?? '',
        end: search.end ?? '',
        allDay: search.allDay ?? false,
        timeZone: search.timeZone,
        description: search.description ?? '',
      }
      break
    case 'social':
      patch.social = {
        platform: search.platform ?? current.social.platform,
        handle: search.handle ?? '',
      }
      break
  }
  return patch
}
