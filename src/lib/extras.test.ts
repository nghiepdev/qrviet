import {test} from 'node:test'
import assert from 'node:assert/strict'
import jsQR from 'jsqr'
import {buildEvent, buildSocial, buildVCard, buildWifi, classifyPayload, contactToVCard, normalizePhone} from './payloads.ts'
import {crc32, createZip} from './zip.ts'
import {DEFAULT_QR_STYLE, layoutQr, makeQr, contrastRatio} from './qr/render.ts'
import {buildVietQr} from './vietqr.ts'

test('wifi payload escapes special characters and round-trips', () => {
  const payload = buildWifi({ssid: 'Quán Cà Phê;1', password: 'p@ss:word', security: 'WPA', hidden: true})
  assert.equal(payload, 'WIFI:T:WPA;S:Quán Cà Phê\\;1;P:p@ss\\:word;H:true;;')
  const c = classifyPayload(payload)
  assert.equal(c.type, 'wifi')
  if (c.type === 'wifi') assert.deepEqual(c.wifi, {ssid: 'Quán Cà Phê;1', password: 'p@ss:word', security: 'WPA', hidden: true})
})

test('vcard builds and is recognised', () => {
  const v = buildVCard({
    firstName: 'An',
    lastName: 'Nguyễn',
    org: 'QRViet',
    title: '',
    phone: '',
    mobile: '0912345678',
    email: 'an@example.com',
    website: '',
    address: '',
    note: '',
  })
  assert.match(v, /FN:An Nguyễn/)
  const c = classifyPayload(v)
  assert.equal(c.type, 'vcard')
  if (c.type === 'vcard') assert.equal(c.name, 'An Nguyễn')
})

test('classifier recognises common payloads', () => {
  assert.equal(classifyPayload('https://qrviet.app').type, 'url')
  assert.equal(classifyPayload('tel:+84912345678').type, 'phone')
  assert.equal(classifyPayload('SMSTO:+84912:hello').type, 'sms')
  assert.equal(classifyPayload('geo:10.77,106.70').type, 'geo')
  assert.equal(classifyPayload('mailto:a@b.vn?subject=Hi').type, 'email')
  assert.equal(classifyPayload('xin chào').type, 'text')
  const vq = classifyPayload(buildVietQr({bin: '970436', accountNumber: '0123456789', amount: 10000}))
  assert.equal(vq.type, 'emv')
  assert.equal(classifyPayload('000201010211BROKEN').type, 'emv-invalid')
})

test('event and social helpers', () => {
  const ev = buildEvent({title: 'Họp lớp', location: 'Hà Nội', start: '2026-12-24T19:00', end: '', allDay: false, description: ''})
  assert.match(ev, /^BEGIN:VEVENT\nSUMMARY:Họp lớp\nDTSTART:\d{8}T\d{4}00Z/)
  assert.equal(buildSocial({platform: 'zalo', handle: '0912 345 678'}), 'https://zalo.me/84912345678')
  assert.equal(buildSocial({platform: 'tiktok', handle: '@qrviet'}), 'https://www.tiktok.com/@qrviet')
  assert.equal(normalizePhone('0912 345 678'), '+84912345678')
})

test('crc32 reference vector and zip structure', async () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')).toString(16), 'cbf43926')
  const zip = await createZip([
    {name: 'a.txt', data: 'hello'},
    {name: 'a.txt', data: 'again'},
  ])
  const bytes = new Uint8Array(await zip.arrayBuffer())
  const view = new DataView(bytes.buffer)
  assert.equal(view.getUint32(0, true), 0x04034b50)
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50)
  assert.equal(view.getUint16(bytes.length - 22 + 10, true), 2)
  assert.ok(new TextDecoder().decode(bytes).includes('a-2.txt'))
})

function rasterize(text: string, ecc: 'L' | 'M' | 'Q' | 'H' = 'M', px = 4) {
  const model = makeQr(text, ecc)
  const margin = 4
  const total = model.size + margin * 2
  const w = total * px
  const data = new Uint8ClampedArray(w * w * 4).fill(255)
  for (let y = 0; y < model.size; y++) {
    for (let x = 0; x < model.size; x++) {
      if (!model.data[y][x]) continue
      for (let dy = 0; dy < px; dy++) {
        for (let dx = 0; dx < px; dx++) {
          const i = (((y + margin) * px + dy) * w + (x + margin) * px + dx) * 4
          data[i] = data[i + 1] = data[i + 2] = 0
        }
      }
    }
  }
  return {data, w}
}

test('encoded VietQR decodes back to the identical payload', () => {
  const payload = buildVietQr({bin: '970422', accountNumber: '056789799999', amount: 50000, purpose: 'Thanh toan don hang 123'})
  for (const ecc of ['L', 'M', 'Q', 'H'] as const) {
    const {data, w} = rasterize(payload, ecc)
    assert.equal(jsQR(data, w, w)?.data, payload, `ecc ${ecc}`)
  }
})

test('UTF-8 text survives encode/decode', () => {
  const text = 'Xin chào Việt Nam 🇻🇳'
  const {data, w} = rasterize(text)
  const res = jsQR(data, w, w)
  assert.equal(new TextDecoder().decode(new Uint8Array(res!.binaryData)), text)
})

test('layout produces geometry for every dot style and excavates the logo area', () => {
  const model = makeQr('https://qrviet.app/some/path', 'H')
  for (const dots of ['square', 'rounded', 'dots', 'fluid', 'diamond', 'classy', 'bars-v', 'bars-h'] as const) {
    const geo = layoutQr(model, {...DEFAULT_QR_STYLE, dots})
    assert.ok(geo.dots.length > 100, dots)
    assert.equal(geo.total, model.size + DEFAULT_QR_STYLE.margin * 2)
  }
  const withLogo = layoutQr(model, DEFAULT_QR_STYLE, {size: 0.24, excavate: true, plate: 'rounded'})
  const without = layoutQr(model, DEFAULT_QR_STYLE)
  assert.ok(withLogo.logoBox)
  assert.ok(withLogo.dots.length < without.dots.length)
})

test('contrast ratio helper', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21)
  assert.ok(contrastRatio('#ffffff', '#fefefe') < 1.1)
})

test('payment links round-trip through the URL fragment', async () => {
  const {decodePayLink, encodePayLink} = await import('./paylink.ts')
  const data = {bin: '970436', acc: '0011004455667', name: 'NGUYỄN VĂN A', amount: 150000, memo: 'Tien nha T11', card: true, note: 'Cảm ơn & hẹn gặp lại #1', exp: 1_800_000_000_000, accent: '#d7263d'}
  const back = decodePayLink(`#${encodePayLink(data)}`)
  assert.deepEqual(back, data)
  assert.equal(decodePayLink('#b=970436'), null)
  assert.equal(decodePayLink('#b=970436&a=1&m=-5&k=zzz')?.amount, undefined)
  assert.equal(decodePayLink('#b=970436&a=1&k=zzz')?.accent, undefined)
})

test('review regressions: sms URIs, malformed mailto, MECARD, all-day events', () => {
  const sms = classifyPayload('sms:+84912345678?body=Hi%20there')
  assert.deepEqual(sms, {type: 'sms', phone: '+84912345678', message: 'Hi there'})
  assert.deepEqual(classifyPayload('SMSTO:+84912:hello:world'), {type: 'sms', phone: '+84912', message: 'hello:world'})
  const mail = classifyPayload('mailto:100%@x.vn?subject=Hi')
  assert.equal(mail.type, 'email')
  if (mail.type === 'email') assert.equal(mail.to, '100%@x.vn')
  const me = classifyPayload('MECARD:N:Nguyen,An;TEL:0912345678;EMAIL:an@x.vn;;')
  assert.equal(me.type, 'vcard')
  if (me.type === 'vcard') assert.match(contactToVCard(me.fields, me.name), /^BEGIN:VCARD[\s\S]*TEL;TYPE=CELL:0912345678[\s\S]*END:VCARD$/)
  const ev = buildEvent({title: 'Tết', location: '', start: '2027-02-06', end: '2027-02-08', allDay: true, description: ''})
  assert.match(ev, /DTSTART;VALUE=DATE:20270206/)
  assert.match(ev, /DTEND;VALUE=DATE:20270209/) // exclusive end
})

test('review regressions: text fitting keeps emoji whole', async () => {
  const {fitText, wellFormed} = await import('./qr/scene.ts')
  const measure = (t: string) => Array.from(t).length * 10
  const out = fitText(measure, '🍜🍜🍜🍜🍜🍜🍜🍜🍜🍜', 60, 10, 400, 10)
  assert.doesNotThrow(() => encodeURIComponent(out.text))
  assert.equal(wellFormed('a\uD83C'), 'a\uFFFD')
})

test('review regressions: invalid colours are normalised for both painters', async () => {
  const {normalizeStyle, DEFAULT_QR_STYLE: d} = await import('./qr/render.ts')
  const s = normalizeStyle({...d, fg: '#11111', fg2: 'nope', bg: '#fff', eyeFrameColor: 'red;'})
  assert.equal(s.fg, d.fg)
  assert.equal(s.fg2, d.fg)
  assert.equal(s.bg, '#fff')
  assert.equal(s.eyeFrameColor, null)
})
