import {useSelector} from '@tanstack/react-store'
import {persistedStore} from '#/lib/persist'
import {uid} from '#/lib/text'
import type {VietQrService} from '#/lib/vietqr'

export interface SavedAccount {
  id: string
  bin: string
  accountNumber: string
  accountName: string
  nickname: string
  service: VietQrService
  color: string
  isDefault: boolean
  createdAt: number
  usedAt: number | null
}

export const ACCOUNT_COLORS = ['#d7263d', '#1d63d8', '#0b7f66', '#7c3aed', '#c2410c', '#c2185b', '#0f172a', '#ca8a04']

export const accountsStore = persistedStore<SavedAccount[]>({key: 'accounts', version: 1, initial: []})

export function useAccounts<T = SavedAccount[]>(selector?: (a: SavedAccount[]) => T): T {
  return useSelector(accountsStore, selector ?? ((a) => a as unknown as T))
}

export function findDuplicate(bin: string, accountNumber: string, ignoreId?: string) {
  return accountsStore.state.find(
    (a) => a.bin === bin && a.accountNumber.toUpperCase() === accountNumber.toUpperCase() && a.id !== ignoreId,
  )
}

export function saveAccount(
  input: Omit<SavedAccount, 'id' | 'createdAt' | 'usedAt' | 'isDefault' | 'color'> & Partial<Pick<SavedAccount, 'id' | 'color' | 'isDefault'>>,
): SavedAccount {
  const existing = input.id ? accountsStore.state.find((a) => a.id === input.id) : findDuplicate(input.bin, input.accountNumber)
  const isFirst = accountsStore.state.length === 0
  const record: SavedAccount = {
    id: existing?.id ?? uid(),
    createdAt: existing?.createdAt ?? Date.now(),
    usedAt: existing?.usedAt ?? null,
    color: input.color ?? existing?.color ?? ACCOUNT_COLORS[accountsStore.state.length % ACCOUNT_COLORS.length],
    isDefault: input.isDefault ?? existing?.isDefault ?? isFirst,
    bin: input.bin,
    accountNumber: input.accountNumber,
    accountName: input.accountName,
    nickname: input.nickname,
    service: input.service,
  }
  accountsStore.setState((list) => {
    let next = existing ? list.map((a) => (a.id === record.id ? record : a)) : [record, ...list]
    if (record.isDefault) next = next.map((a) => ({...a, isDefault: a.id === record.id}))
    return next
  })
  return record
}

export function removeAccount(id: string): SavedAccount | undefined {
  const target = accountsStore.state.find((a) => a.id === id)
  accountsStore.setState((list) => {
    const next = list.filter((a) => a.id !== id)
    if (target?.isDefault && next.length) next[0] = {...next[0], isDefault: true}
    return next
  })
  return target
}

export function restoreAccount(account: SavedAccount) {
  accountsStore.setState((list) => {
    if (list.some((a) => a.id === account.id)) return list
    const next = [account, ...list]
    // Undoing the deletion of the default account makes it the (single) default again.
    return account.isDefault ? next.map((a) => ({...a, isDefault: a.id === account.id})) : next
  })
}

export function setDefaultAccount(id: string) {
  accountsStore.setState((list) => list.map((a) => ({...a, isDefault: a.id === id})))
}

export function touchAccount(id: string) {
  accountsStore.setState((list) => list.map((a) => (a.id === id ? {...a, usedAt: Date.now()} : a)))
}

export function importAccounts(items: unknown): number {
  if (!Array.isArray(items)) throw new Error('not an array')
  let count = 0
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const bin = String(r.bin ?? '')
    const accountNumber = String(r.accountNumber ?? r.account ?? '')
    if (!/^\d{6}$/.test(bin) || !accountNumber) continue
    saveAccount({
      bin,
      accountNumber,
      accountName: String(r.accountName ?? r.name ?? ''),
      nickname: String(r.nickname ?? ''),
      service: r.service === 'card' ? 'card' : 'account',
      color: typeof r.color === 'string' ? r.color : undefined,
    })
    count++
  }
  return count
}

export function getDefaultAccount(): SavedAccount | undefined {
  return accountsStore.state.find((a) => a.isDefault) ?? accountsStore.state[0]
}
