import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * Counts a number up to its target when it scrolls into view. Landing-only — a
 * designed cinematic moment. The terminal never animates a number being read.
 */
export default function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  durationMs = 1400,
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
  durationMs?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(() =>
    prefersReducedMotion() ? value : 0,
  )
  const started = useRef(false)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value)
      return
    }
    const el = ref.current
    if (!el) return
    let raf = 0
    let cancelled = false
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return
        started.current = true
        const t0 = performance.now()
        const tick = (t: number) => {
          if (cancelled) return
          const p = Math.min(1, (t - t0) / durationMs)
          const e = 1 - Math.pow(1 - p, 3)
          setDisplay(value * e)
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      started.current = false
    }
  }, [value, durationMs])

  return (
    // Inter with tabular figures (matches the Aura design's big display stats —
    // mono is reserved for the ticker/equity readouts).
    <span ref={ref} className={`tnum ${className}`.trim()}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  )
}
