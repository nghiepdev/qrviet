/**
 * TanStack Store + localStorage. Each store is saved under `qrviet:<key>` as
 * `{v, state}`, re-hydrated on load, and kept in sync across tabs/windows of
 * the installed app through the `storage` event.
 */
import {createStore, type Store} from '@tanstack/react-store'

interface Envelope<T> {
  v: number
  state: T
}

export interface PersistOptions<T> {
  key: string
  version: number
  initial: T
  /** Upgrade older shapes; return undefined to discard. */
  migrate?: (state: unknown, fromVersion: number) => T | undefined
  /** Merge persisted state onto the initial value (for added fields). */
  merge?: (persisted: T, initial: T) => T
}

export const STORAGE_PREFIX = 'qrviet:'

function read<T>(opts: PersistOptions<T>): T {
  if (typeof localStorage === 'undefined') return opts.initial
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + opts.key)
    if (!raw) return opts.initial
    const env = JSON.parse(raw) as Envelope<unknown>
    let state: T | undefined
    if (env.v === opts.version) state = env.state as T
    else state = opts.migrate?.(env.state, env.v)
    if (state === undefined) return opts.initial
    return opts.merge ? opts.merge(state, opts.initial) : state
  } catch {
    return opts.initial
  }
}

export function persistedStore<T>(opts: PersistOptions<T>): Store<T> {
  const store = createStore<T>(read(opts))
  if (typeof window === 'undefined') return store

  let applyingRemote = false
  let scheduled = false
  store.subscribe(() => {
    if (applyingRemote || scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      try {
        const env: Envelope<T> = {v: opts.version, state: store.state}
        localStorage.setItem(STORAGE_PREFIX + opts.key, JSON.stringify(env))
      } catch {
        // Quota exceeded or private mode — the app keeps working in memory.
      }
    })
  })

  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_PREFIX + opts.key || e.storageArea !== localStorage) return
    applyingRemote = true
    try {
      store.setState(() => read(opts))
    } finally {
      applyingRemote = false
    }
  })
  return store
}

/** Every key this app owns (for backup / reset). */
export function listAppKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(STORAGE_PREFIX)) keys.push(k)
  }
  return keys
}
