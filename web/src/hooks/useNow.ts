import { useEffect, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** A clock that ticks only while `active`. 100ms normally, 1s under reduced motion. */
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), reduced() ? 1000 : 100)
    return () => clearInterval(id)
  }, [active])
  return now
}

/** Counts a number from 0 to `target` once it becomes non-null. */
export function useCountUp(target: number | null, ms = 400) {
  const [value, setValue] = useState<number | null>(target)
  useEffect(() => {
    if (target == null) {
      setValue(null)
      return
    }
    if (reduced()) {
      setValue(target)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      setValue(target * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}
