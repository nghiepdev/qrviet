/** Read one image or plain text. Call from a user gesture; permission UI belongs to the caller. */
export async function readClipboard(): Promise<Blob | string | null> {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
  if (!clipboard) throw new DOMException('Clipboard unavailable', 'NotAllowedError')
  try {
    if (typeof clipboard.read === 'function') {
      const items = await clipboard.read()
      for (const item of items) {
        const type = item.types.find((value) => value.startsWith('image/'))
        if (type) return await item.getType(type)
      }
      for (const item of items) {
        if (item.types.includes('text/plain')) {
          const text = (await (await item.getType('text/plain')).text()).trim()
          if (text) return text
        }
      }
      return null
    }
    if (typeof clipboard.readText !== 'function') {
      throw new DOMException('Clipboard unavailable', 'NotAllowedError')
    }
    return (await clipboard.readText()).trim() || null
  } catch (error) {
    if (
      (error as DOMException)?.name === 'NotAllowedError' ||
      typeof clipboard.readText !== 'function'
    )
      throw error
    return (await clipboard.readText()).trim() || null
  }
}
