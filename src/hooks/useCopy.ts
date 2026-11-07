import {useCallback} from 'react'
import {useToast} from '@astryxdesign/core/Toast'
import {copyText} from '#/lib/qr/export'
import {useT} from '#/i18n'

/** Copy text and confirm with a toast. */
export function useCopy() {
  const showToast = useToast()
  const t = useT()
  return useCallback(
    async (text: string, message?: string) => {
      try {
        await copyText(text)
        showToast({body: message ?? t('common.copied'), uniqueID: 'copy'})
        return true
      } catch {
        showToast({body: t('common.copyFailed'), type: 'error', uniqueID: 'copy'})
        return false
      }
    },
    [showToast, t],
  )
}
