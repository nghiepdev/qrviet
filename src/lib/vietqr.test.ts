import {test} from 'node:test'
import assert from 'node:assert/strict'
import {checkCrc, crc16ccitt, parseTlv, repairCrc, tlv} from './emv.ts'
import {buildVietQr, maskAccount, parseEmvQr, toQrAscii, validateVietQr} from './vietqr.ts'
import {amountToEnglishWords, amountToVietnameseWords, formatVnd, parseAmount, shortAmount} from './money.ts'
import {foldForSearch, matchesQuery, removeDiacritics, sanitizeTransferContent} from './text.ts'

// Reference strings cross-checked against an independent port of vietqr-core.
const STATIC_MB =
  '00020101021138560010A0000007270126000697042201120567897999990208QRIBFTTA53037045802VN6304CAD2'

test('crc16 ccitt-false matches the reference vector', () => {
  assert.equal(crc16ccitt('123456789'), '29B1')
  assert.equal(checkCrc(STATIC_MB).valid, true)
})

test('tlv encodes id + 2-digit length + value and drops empty values', () => {
  assert.equal(tlv('00', '01'), '000201')
  assert.equal(tlv('54', ''), '')
  assert.throws(() => tlv('62', 'x'.repeat(100)))
})

test('static VietQR matches the reference payload byte for byte', () => {
  assert.equal(buildVietQr({bin: '970422', accountNumber: '056789799999'}), STATIC_MB)
})

test('dynamic VietQR with amount + Vietnamese purpose', () => {
  const qr = buildVietQr({
    bin: '970422',
    accountNumber: '056789799999',
    amount: 50000,
    purpose: 'Thanh toán đơn hàng 123',
  })
  assert.match(qr, /^000201010212/)
  assert.ok(qr.includes('5405500005802VN62270823Thanh toan don hang 123'))
  assert.ok(qr.endsWith('6304AEB8'), qr)
})

test('card service, bill number and reference label are encoded in order', () => {
  const qr = buildVietQr({
    bin: '970436',
    accountNumber: '9704366614951234',
    service: 'card',
    billNumber: 'HD01',
    referenceLabel: 'REF9',
    purpose: 'abc',
  })
  const parsed = parseEmvQr(qr)
  assert.equal(parsed.kind, 'vietqr')
  if (parsed.kind !== 'vietqr') return
  assert.equal(parsed.service, 'card')
  assert.equal(parsed.billNumber, 'HD01')
  assert.equal(parsed.referenceLabel, 'REF9')
  assert.equal(parsed.purpose, 'abc')
  assert.equal(parsed.initiation, 'dynamic')
  assert.ok(qr.includes('62230104HD010504REF90803abc'))
})

test('parse round-trips every field and validates the CRC', () => {
  const qr = buildVietQr({
    bin: '970436',
    accountNumber: '0011004455667',
    amount: '1.250.000',
    purpose: 'Tien nha T11',
    merchantName: 'Nguyễn Văn A',
    merchantCity: 'Hà Nội',
  })
  const parsed = parseEmvQr(qr)
  assert.equal(parsed.kind, 'vietqr')
  if (parsed.kind !== 'vietqr') return
  assert.equal(parsed.bin, '970436')
  assert.equal(parsed.accountNumber, '0011004455667')
  assert.equal(parsed.amount, '1250000')
  assert.equal(parsed.purpose, 'Tien nha T11')
  assert.equal(parsed.merchantName, 'NGUYEN VAN A')
  assert.equal(parsed.merchantCity, 'HA NOI')
  assert.equal(parsed.currency, '704')
  assert.equal(parsed.country, 'VN')
  assert.equal(parsed.crc.valid, true)

  const tampered = qr.replace('1250000', '9250000')
  assert.equal(parseEmvQr(tampered).crc.valid, false)
})

test('non-VietQR EMV payloads are reported as generic EMV', () => {
  const body = tlv('00', '01') + tlv('01', '11') + tlv('26', tlv('00', 'COM.EXAMPLE') + tlv('01', '123')) + tlv('53', '704') + tlv('58', 'VN') + '6304'
  const parsed = parseEmvQr(body + crc16ccitt(body))
  assert.equal(parsed.kind, 'emv')
  if (parsed.kind === 'emv') assert.deepEqual(parsed.schemes, ['COM.EXAMPLE'])
})

test('validation flags bad input and long purposes', () => {
  assert.deepEqual(
    validateVietQr({bin: '97', accountNumber: ''}).map((i) => i.code),
    ['bin-format', 'required'],
  )
  const long = validateVietQr({bin: '970436', accountNumber: '123', purpose: 'x'.repeat(30)})
  assert.deepEqual(long.map((i) => [i.code, i.severity]), [['purpose-long', 'warning']])
  assert.equal(validateVietQr({bin: '970436', accountNumber: '1'.repeat(20)})[0]?.code, 'account-length')
})

test('purpose is stripped to printable ASCII so TLV lengths stay correct', () => {
  assert.equal(toQrAscii('Chuyển  tiền 💸 ₫50k'), 'Chuyen tien 50k')
  const qr = buildVietQr({bin: '970436', accountNumber: '123', purpose: 'Ăn trưa 🍜'})
  assert.equal(parseEmvQr(qr).crc.valid, true)
})

test('nested TLV parsing exposes template children', () => {
  const fields = parseTlv(STATIC_MB)
  const t38 = fields.find((f) => f.id === '38')
  assert.ok(t38?.children?.length)
  assert.equal(t38?.children?.find((f) => f.id === '01')?.children?.find((f) => f.id === '00')?.value, '970422')
})

test('amount parsing understands Vietnamese shorthand', () => {
  assert.equal(parseAmount('150k'), 150_000)
  assert.equal(parseAmount('1tr2'), 1_200_000)
  assert.equal(parseAmount('1tr250'), 1_250_000)
  assert.equal(parseAmount('1.5tr'), 1_500_000)
  assert.equal(parseAmount('2 triệu 300k'), 2_300_000)
  assert.equal(parseAmount('1.234.567'), 1_234_567)
  assert.equal(parseAmount('50,000'), 50_000)
  assert.equal(parseAmount('3 tỷ'), 3_000_000_000)
  assert.equal(parseAmount('abc'), null)
  assert.equal(parseAmount(''), null)
})

test('VND formatting and compact labels', () => {
  assert.equal(formatVnd(1234567), '1.234.567')
  assert.equal(formatVnd('50000', true), '50.000 ₫')
  assert.equal(shortAmount(50_000), '50k')
  assert.equal(shortAmount(1_500_000), '1,5tr')
  assert.equal(shortAmount(1_500_000, 'en'), '1.5M')
})

test('amount in Vietnamese words', () => {
  assert.equal(amountToVietnameseWords(0), 'Không đồng')
  assert.equal(amountToVietnameseWords(15), 'Mười lăm đồng')
  assert.equal(amountToVietnameseWords(21), 'Hai mươi mốt đồng')
  assert.equal(amountToVietnameseWords(105), 'Một trăm lẻ năm đồng')
  assert.equal(amountToVietnameseWords(1_250_000), 'Một triệu hai trăm năm mươi nghìn đồng')
  assert.equal(amountToVietnameseWords(1_005_000), 'Một triệu không trăm lẻ năm nghìn đồng')
  assert.equal(amountToVietnameseWords(2_000_000_024), 'Hai tỷ không trăm hai mươi tư đồng')
  assert.equal(amountToVietnameseWords(1_000_000_000_000), 'Một nghìn tỷ đồng')
})

test('amount in English words', () => {
  assert.equal(amountToEnglishWords(1_250_000), 'One million two hundred fifty thousand dong')
  assert.equal(amountToEnglishWords(21), 'Twenty-one dong')
})

test('Vietnamese text helpers', () => {
  assert.equal(removeDiacritics('Đặng Thị Ánh Tuyết'), 'Dang Thi Anh Tuyet')
  assert.equal(foldForSearch('  Ngân  Hàng Á Châu '), 'ngan hang a chau')
  assert.ok(matchesQuery('Ngân hàng TMCP Á Châu ACB', 'a chau'))
  assert.equal(sanitizeTransferContent('Mua hàng #12 (giảm 10%)!', 'strict'), 'Mua hang 12 giam 10 ')
  assert.equal(maskAccount('0123456789'), '012****789')
})

test('payloads missing the checksum are still parsed and flagged', () => {
  const full = buildVietQr({bin: '970436', accountNumber: '0071000888999', amount: 45000, purpose: 'Ca phe'})
  const noCrc = full.slice(0, -4)
  const parsed = parseEmvQr(noCrc)
  assert.equal(parsed.kind, 'vietqr')
  assert.equal(parsed.crc.present, false)
  if (parsed.kind === 'vietqr') assert.equal(parsed.amount, '45000')
  assert.throws(() => parseEmvQr('0002010102'))
})

test('review regressions: amounts with currency, grouping and leading zeros', () => {
  const cases: Record<string, number | null> = {
    '100.000đ': 100_000,
    '50.000 VND': 50_000,
    '1.250.000 VNĐ': 1_250_000,
    '1,250,000 VND': 1_250_000,
    '1.234.567 VND': 1_234_567,
    '1.250.000 ₫': 1_250_000,
    '1tr05': 1_050_000,
    '1.500k': 1_500_000,
    '1 500 000': 1_500_000,
    '50000.00': 50_000,
    '150000,phong 101': null,
    '150000 101': null,
    '1e23': null,
  }
  for (const [input, expected] of Object.entries(cases)) assert.equal(parseAmount(input), expected, input)
  assert.equal(formatVnd('50000.00'), '50.000')
  assert.equal(formatVnd(1_250_000, true), '1.250.000 ₫')
})

test('review regressions: oversized amounts are rejected instead of becoming 1e+23', () => {
  assert.equal(validateVietQr({bin: '970436', accountNumber: '1', amount: 1e23})[0]?.code, 'amount-too-large')
  assert.equal(validateVietQr({bin: '970436', accountNumber: '1', amount: 12_345_678_901_234})[0]?.code, 'amount-too-large')
  assert.equal(validateVietQr({bin: '970436', accountNumber: '1', amount: 9_999_999_999_999}).length, 0)
})

test('review regressions: a checksum that reads "6304" is still found', () => {
  const qr = buildVietQr({bin: '970436', accountNumber: '0123456789', amount: 161299})
  assert.ok(qr.endsWith('63046304'), qr)
  assert.deepEqual(checkCrc(qr), {present: true, valid: true, expected: '6304', actual: '6304'})
  const parsed = parseEmvQr(qr)
  assert.equal(parsed.crc.valid, true)
  if (parsed.kind === 'vietqr') assert.equal(parsed.amount, '161299')
})

test('review regressions: CRC repair never cuts inside a value', () => {
  // No tag 63 at all, and the amount contains "6304".
  const body = tlv('00', '01') + tlv('01', '12') + tlv('38', tlv('00', 'A000000727') + tlv('01', tlv('00', '970436') + tlv('01', '123')) + tlv('02', 'QRIBFTTA')) + tlv('53', '704') + tlv('54', '630400') + tlv('58', 'VN')
  const fixed = repairCrc(body)
  assert.ok(fixed?.startsWith(body))
  assert.equal(checkCrc(fixed!).valid, true)
  if (fixed) {
    const parsed = parseEmvQr(fixed)
    if (parsed.kind === 'vietqr') assert.equal(parsed.amount, '630400')
  }
  assert.equal(repairCrc('0002010102'), null)
})
