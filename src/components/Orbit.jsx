import { useCallback, useEffect, useRef, useState } from 'react'
import { PRODUCTS, img, money, pad } from '../data/products'

const N = PRODUCTS.length
const STEP = 360 / N
const norm = (deg) => ((((deg % 360) + 540) % 360) - 180) // -180..180

// A 3D cylinder carousel. Drag / wheel / arrows to spin, click the front piece to open it.
export default function Orbit({ hidden, onOpen }) {
  const ringRef = useRef(null)
  const itemRefs = useRef([])
  const st = useRef({ a: 0, target: 0, v: 0, drag: false, moved: 0 })
  const activeRef = useRef(0)
  const [active, setActive] = useState(0)

  const snapBy = useCallback((dir) => {
    const s = st.current
    s.v = 0
    s.target = Math.round(s.target / STEP) * STEP + dir * STEP
  }, [])

  useEffect(() => {
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = st.current
      if (s.drag) {
        s.v *= Math.pow(0.8, dt * 60)
      } else if (Math.abs(s.v) > 0.08) {
        s.target += s.v * dt * 60
        s.v *= Math.pow(0.93, dt * 60)
      } else {
        s.v = 0
        s.target = Math.round(s.target / STEP) * STEP
      }
      s.a += (s.target - s.a) * (1 - Math.exp(-dt * (s.drag ? 26 : 8)))

      const ring = ringRef.current
      if (ring) {
        ring.style.transform = `translateZ(calc(var(--iw) * -1.1)) rotateX(-6deg) rotateY(${s.a.toFixed(2)}deg)`
      }
      itemRefs.current.forEach((el, k) => {
        if (!el) return
        const rel = norm(k * STEP + s.a)
        const depth = Math.cos((rel * Math.PI) / 180)
        el.style.setProperty('--d', depth.toFixed(3))
      })
      const idx = (((Math.round(-s.a / STEP) % N) + N) % N)
      if (idx !== activeRef.current) {
        activeRef.current = idx
        setActive(idx)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // keyboard
  useEffect(() => {
    if (hidden) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') snapBy(1)
      if (e.key === 'ArrowRight') snapBy(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hidden, snapBy])

  const onPointerDown = (e) => {
    const s = st.current
    s.drag = true
    s.moved = 0
    s.v = 0
    let lastX = e.clientX
    const move = (ev) => {
      const dx = ev.clientX - lastX
      lastX = ev.clientX
      s.moved += Math.abs(dx)
      s.target += dx * 0.32
      s.v = dx * 0.32
    }
    const up = () => {
      s.drag = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const onWheel = (e) => {
    const s = st.current
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    s.v = Math.max(-6, Math.min(6, s.v - d * 0.012))
  }

  const onItemClick = (k) => {
    const s = st.current
    if (s.moved > 6) return
    const rel = norm(k * STEP + s.target)
    if (Math.abs(rel) > STEP / 2) {
      s.v = 0
      s.target -= rel
    } else {
      onOpen(k)
    }
  }

  const cur = PRODUCTS[active]

  return (
    <div
      className={`orbit ${hidden ? 'is-hidden' : ''}`}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      <div className="orbit-stage">
        <div className="orbit-floor" />
        <div className="orbit-ring" ref={ringRef}>
          {PRODUCTS.map((p, k) => (
            <button
              key={p.id}
              type="button"
              className="orbit-item"
              ref={(el) => (itemRefs.current[k] = el)}
              style={{ '--ang': `${k * STEP}deg` }}
              tabIndex={hidden ? -1 : 0}
              aria-label={`${p.name} — ${money(p.price)}`}
              onClick={() => onItemClick(k)}
            >
              <img src={img(p.variants[0].slug, 'front')} alt="" draggable="false" width="1086" height="1448" decoding="async" />
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="orbit-arrow l" aria-label="Previous" onClick={() => snapBy(1)}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M11 3 5 9l6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button type="button" className="orbit-arrow r" aria-label="Next" onClick={() => snapBy(-1)}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 3l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      <div className="orbit-caption" key={cur.id}>
        <span className="eyebrow">No. {pad(active + 1)} / {pad(N)}</span>
        <b>{cur.name}</b>
        <span>{money(cur.price)}</span>
      </div>
    </div>
  )
}
