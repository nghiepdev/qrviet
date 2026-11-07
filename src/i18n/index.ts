import {useSettings, type Locale} from '#/stores/settings'
import {en} from './en'
import {vi, type MessageKey} from './vi'

export type {MessageKey}
export const MESSAGES: Record<Locale, Record<MessageKey, string>> = {vi, en}

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = MESSAGES[locale][key] ?? MESSAGES.vi[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`))
}

export function useLocale(): Locale {
  return useSettings((s) => s.locale)
}

export function useT(): TFunction {
  const locale = useLocale()
  return (key, vars) => translate(locale, key, vars)
}

/** Relative time like "5 phút trước" / "Hôm qua". */
export function formatRelative(ts: number, locale: Locale, now = Date.now()): string {
  const diff = Math.max(0, now - ts)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return translate(locale, 'common.justNow')
  if (min < 60) return translate(locale, 'common.minutesAgo', {n: min})
  const h = Math.floor(min / 60)
  if (h < 24 && new Date(ts).getDate() === new Date(now).getDate()) return translate(locale, 'common.hoursAgo', {n: h})
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (new Date(ts).toDateString() === yesterday.toDateString()) return translate(locale, 'common.yesterday')
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'}).format(ts)
}
