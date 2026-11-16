import {useState} from 'react'
import {bankLogoUrl, bankMonogramColor, type Bank} from '#/data/banks'

/** Bank logo on a white tile (logos are designed for light backgrounds) with a monogram fallback. */
export function BankLogo({
  bank,
  size = 40,
  className = '',
}: {
  bank: Bank | undefined | null
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const src = bankLogoUrl(bank)
  const w = Math.round(size * 1.6)
  if (!bank || !src || failed) {
    const label = bank?.shortName ?? '?'
    return (
      <span
        aria-hidden
        className={`inline-grid shrink-0 place-items-center rounded-md font-bold text-white ${className}`}
        style={{
          width: w,
          height: size,
          background: bank ? bankMonogramColor(bank.code) : 'var(--color-background-muted)',
          fontSize: size * 0.32,
        }}
      >
        {label.slice(0, 4).toUpperCase()}
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-white ${className}`}
      style={{width: w, height: size}}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
        style={{padding: size * 0.06}}
      />
    </span>
  )
}
