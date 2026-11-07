/**
 * Minimal ZIP writer (store method, no compression) — enough to bundle the
 * PNGs/SVGs from batch mode without pulling in a dependency. PNGs are already
 * compressed so "store" costs almost nothing in size.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  name: string
  data: Uint8Array | Blob | string
  date?: Date
}

function dosTime(d: Date) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return {time, date}
}

export async function createZip(entries: ZipEntry[]): Promise<Blob> {
  const enc = new TextEncoder()
  const chunks: BlobPart[] = []
  const central: Uint8Array[] = []
  let offset = 0
  const used = new Set<string>()

  for (const entry of entries) {
    let name = entry.name
    // De-duplicate names: a.png, a-2.png, …
    if (used.has(name)) {
      const dot = name.lastIndexOf('.')
      const stem = dot > 0 ? name.slice(0, dot) : name
      const ext = dot > 0 ? name.slice(dot) : ''
      let i = 2
      while (used.has(`${stem}-${i}${ext}`)) i++
      name = `${stem}-${i}${ext}`
    }
    used.add(name)
    const data =
      typeof entry.data === 'string'
        ? enc.encode(entry.data)
        : entry.data instanceof Blob
          ? new Uint8Array(await entry.data.arrayBuffer())
          : entry.data
    const nameBytes = enc.encode(name)
    const crc = crc32(data)
    const {time, date} = dosTime(entry.date ?? new Date())

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // version needed
    local.setUint16(6, 0x0800, true) // UTF-8 names
    local.setUint16(8, 0, true) // store
    local.setUint16(10, time, true)
    local.setUint16(12, date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true)
    chunks.push(local.buffer, nameBytes, data as BlobPart)

    const cen = new DataView(new ArrayBuffer(46))
    cen.setUint32(0, 0x02014b50, true)
    cen.setUint16(4, 20, true)
    cen.setUint16(6, 20, true)
    cen.setUint16(8, 0x0800, true)
    cen.setUint16(10, 0, true)
    cen.setUint16(12, time, true)
    cen.setUint16(14, date, true)
    cen.setUint32(16, crc, true)
    cen.setUint32(20, data.length, true)
    cen.setUint32(24, data.length, true)
    cen.setUint16(28, nameBytes.length, true)
    cen.setUint16(30, 0, true)
    cen.setUint16(32, 0, true)
    cen.setUint16(34, 0, true)
    cen.setUint16(36, 0, true)
    cen.setUint32(38, 0, true)
    cen.setUint32(42, offset, true)
    const cenBytes = new Uint8Array(46 + nameBytes.length)
    cenBytes.set(new Uint8Array(cen.buffer), 0)
    cenBytes.set(nameBytes, 46)
    central.push(cenBytes)

    offset += 30 + nameBytes.length + data.length
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, central.length, true)
  end.setUint16(10, central.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...chunks, ...(central as BlobPart[]), end.buffer], {type: 'application/zip'})
}
