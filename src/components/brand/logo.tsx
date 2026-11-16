import type {CSSProperties} from 'react'

const STAR =
  '376.0,306.0 393.6,351.7 442.6,354.4 404.5,385.3 417.1,432.6 376.0,406.0 334.9,432.6 347.5,385.3 309.4,354.4 358.4,351.7'

interface MarkProps {
  size?: number
  /** Animate the finder patterns / V / star (loader, empty states). */
  animated?: boolean
  className?: string
  style?: CSSProperties
  title?: string
}

/** The QRViet mark: three finder patterns, a "V" and a gold star in the 4th corner. */
export function LogoMark({size = 32, animated = false, className, style, title}: MarkProps) {
  const id = animated ? 'qv-mark-a' : 'qv-mark'
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`${animated ? 'qv-mark-animated ' : ''}${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0435a" />
          <stop offset="0.55" stopColor="#d7263d" />
          <stop offset="1" stopColor="#a5122a" />
        </linearGradient>
        <linearGradient id={`${id}-star`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#ffbe2e" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${id}-bg)`} />
      <g fill="none" stroke="#fff" strokeWidth="26">
        <rect className="qv-ring" x="85" y="85" width="102" height="102" rx="26" />
        <rect className="qv-ring qv-d2" x="325" y="85" width="102" height="102" rx="26" />
        <rect className="qv-ring qv-d3" x="85" y="325" width="102" height="102" rx="26" />
      </g>
      <g fill="#fff">
        <rect className="qv-core" x="116" y="116" width="40" height="40" rx="11" />
        <rect className="qv-core qv-d2" x="356" y="116" width="40" height="40" rx="11" />
        <rect className="qv-core qv-d3" x="116" y="356" width="40" height="40" rx="11" />
      </g>
      <path
        className="qv-v"
        d="M214 218 L256 296 L298 218"
        fill="none"
        stroke="#fff"
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        className="qv-star"
        points={STAR}
        fill={`url(#${id}-star)`}
        stroke="#ffc93c"
        strokeWidth="10"
        strokeLinejoin="round"
      />
    </svg>
  )
}
