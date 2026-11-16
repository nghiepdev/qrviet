import {useEffect, useState} from 'react'
import {LogoMark} from './logo'
import {useT} from '#/i18n'
import './loader.css'

interface Particle {
  left: number
  size: number
  duration: number
  delay: number
  opacity: number
  star: boolean
  drift: number
}

/**
 * Scattered particles from a small seeded PRNG (mulberry32): pure, so it can run
 * during render, and every loader of a given size looks the same.
 */
function makeParticles(count: number): Particle[] {
  let seed = 0x9e3779b9 ^ count
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
  return Array.from({length: count}, () => {
    const depth = random() // 0 = far, 1 = near
    const duration = 9 - depth * 4.5
    return {
      left: random() * 100,
      size: 4 + depth * 9,
      duration,
      delay: -random() * duration,
      opacity: 0.25 + depth * 0.55,
      star: random() < 0.22,
      drift: (random() - 0.5) * 60,
    }
  })
}

/**
 * Brand loader: QR "modules" and tiny stars float up around the pulsing mark.
 * - Appears only after `delay` ms so fast navigations never flash it.
 * - Negative animation delays mean the scene is already full on frame one.
 * - Size drives speed and opacity so particles read as near/far layers.
 * - Under reduced motion the scene pauses instead of disappearing.
 */
export function BrandLoader({
  variant = 'inline',
  delay = 300,
  label,
  count = 26,
}: {
  variant?: 'inline' | 'overlay'
  delay?: number
  label?: string
  count?: number
}) {
  const t = useT()
  const [visible, setVisible] = useState(delay === 0)
  useEffect(() => {
    if (delay === 0) return
    const id = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(id)
  }, [delay])

  const particles = makeParticles(count)

  return (
    <div
      className={`qv-loader qv-loader-${variant}${visible ? ' is-visible' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="qv-loader-field" aria-hidden>
        {particles.map((p, i) => (
          <span
            key={i}
            className={p.star ? 'qv-particle is-star' : 'qv-particle'}
            style={
              {
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                '--qv-drift': `${p.drift}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="qv-loader-center">
        <LogoMark size={variant === 'overlay' ? 88 : 64} animated />
        <span className="qv-loader-caption">{label ?? t('app.loading')}</span>
      </div>
    </div>
  )
}
