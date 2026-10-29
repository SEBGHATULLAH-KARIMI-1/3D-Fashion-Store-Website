import { useEffect, useRef, useState } from 'react'
import { PRODUCTS, img, money } from '../data/products'

// Where the hanger hook sits inside the product photos (fractions of image width).
const HOOK_X = 0.495
const HOOK_Y = 0.053

// One garment = two photo faces on a 3D card that pivots around the hook.
// side face at 0deg, front face on the back of the card (so it appears when the card turns 180deg).
function Garment({ slug, hookOnly = false }) {
  const layer = {
    left: `calc(-1 * var(--iw) * ${HOOK_X})`,
    top: `calc(var(--rod) / 2 - var(--iw) * ${HOOK_Y})`,
    aspectRatio: '1086 / 1448',
  }
  // The "hook only" copy is clipped to the sliver above the rod, so the hook
  // sits in front of the rail while the rest of the garment hangs behind it.
  const clip = hookOnly
    ? { clipPath: `inset(0 0 calc(100% - (var(--iw) * ${HOOK_Y} - var(--rod) / 2)) 0)` }
    : undefined
  return (
    <div className="garment">
      <div className="garment-card">
        <div className="garment-layer" style={layer}>
          <img className="g-face g-side" src={img(slug, 'side')} alt="" draggable="false" width="1086" height="1448" decoding="async" style={clip} />
          <img className="g-face g-front" src={img(slug, 'front')} alt="" draggable="false" width="1086" height="1448" decoding="async" style={clip} />
        </div>
      </div>
    </div>
  )
}

export default function Rack({ hidden, onOpen }) {
  const itemRefs = useRef([])
  const sceneRef = useRef(null)
  const phys = useRef(PRODUCTS.map(() => ({ a: 0, v: 0, t: 0 })))
  const hoverRef = useRef(-1)
  const [hover, setHover] = useState(-1)
  const mid = (PRODUCTS.length - 1) / 2

  const setHoverBoth = (k) => {
    hoverRef.current = k
    setHover(k)
  }

  // Intro: garments drop in and swing, one after another.
  useEffect(() => {
    const ids = PRODUCTS.map((_, k) =>
      setTimeout(() => {
        phys.current[k].v = (k % 2 ? -1 : 1) * (110 + k * 12)
      }, 250 + k * 110),
    )
    return () => ids.forEach(clearTimeout)
  }, [])

  // Physics: every garment is a damped pendulum around its hook, and turns
  // to face the camera when hovered.
  useEffect(() => {
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      phys.current.forEach((s, k) => {
        s.v += (-60 * s.a - 5 * s.v) * dt
        s.a += s.v * dt
        const target = hoverRef.current === k ? 180 : 0
        s.t += (target - s.t) * (1 - Math.exp(-dt * 7))
        const idle = Math.sin(now / 1100 + k * 1.7) * 0.35
        const el = itemRefs.current[k]
        if (el) {
          el.style.setProperty('--swing', `${(s.a + idle).toFixed(3)}deg`)
          el.style.setProperty('--turn', `${s.t.toFixed(2)}deg`)
        }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onPointerMove = (e) => {
    // whole-scene parallax tilt
    const scene = sceneRef.current
    if (scene) {
      const nx = e.clientX / window.innerWidth - 0.5
      const ny = e.clientY / window.innerHeight - 0.5
      scene.style.setProperty('--ry', `${(nx * 7).toFixed(2)}deg`)
      scene.style.setProperty('--rx', `${(-ny * 4).toFixed(2)}deg`)
    }
    // moving through the rack pushes the nearby garments
    const els = itemRefs.current
    if (els.length < 2) return
    const pitch = Math.abs(els[1].getBoundingClientRect().left - els[0].getBoundingClientRect().left)
    const range = pitch * 1.6
    els.forEach((el, k) => {
      const r = el.getBoundingClientRect()
      if (e.clientY < r.top) return
      const d = Math.abs(e.clientX - r.left)
      if (d > range) return
      const s = phys.current[k]
      s.v = Math.max(-140, Math.min(140, s.v + e.movementX * 0.9 * (1 - d / range)))
    })
  }

  const onPointerLeave = () => {
    const scene = sceneRef.current
    if (scene) {
      scene.style.setProperty('--ry', '0deg')
      scene.style.setProperty('--rx', '0deg')
    }
  }

  return (
    <div
      className={`rack ${hidden ? 'is-hidden' : ''}`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className="rack-scene" ref={sceneRef}>
        <div className="rail rack-rail" aria-hidden="true">
          <div className="rail-tube" />
          <div className="rail-end l">
            <div className="rail-plate" />
            <div className="rail-cap" />
          </div>
          <div className="rail-end r">
            <div className="rail-plate" />
            <div className="rail-cap" />
          </div>
        </div>

        {PRODUCTS.map((p, k) => {
          const slug = p.variants[0].slug
          const push = hover < 0 || hover === k ? 0 : k < hover ? -0.05 : 0.05
          return (
            <div
              key={p.id}
              className="rack-item"
              ref={(el) => (itemRefs.current[k] = el)}
              style={{ '--i': k - mid, '--push': push }}
            >
              <div className="rack-layer rack-garment" style={{ zIndex: hover === k ? 120 : k + 1 }}>
                <Garment slug={slug} />
              </div>
              <div className="rack-layer" style={{ zIndex: 205 }}>
                <div className="hook-contact-line" />
              </div>
              <div className="rack-layer" style={{ zIndex: 210 }}>
                <Garment slug={slug} hookOnly />
              </div>
              <button
                type="button"
                className="rack-hit"
                tabIndex={hidden ? -1 : 0}
                aria-label={`${p.name} — ${money(p.price)}`}
                onPointerEnter={() => setHoverBoth(k)}
                onPointerLeave={() => setHoverBoth(-1)}
                onFocus={() => setHoverBoth(k)}
                onBlur={() => setHoverBoth(-1)}
                onClick={() => onOpen(k)}
              />
            </div>
          )
        })}

        {PRODUCTS.map((p, k) => (
          <p
            key={p.id}
            className={`rack-caption ${hover === k ? 'on' : ''}`}
            style={{ '--i': k - mid, '--hem': 1.385 }}
            aria-hidden="true"
          >
            <b>{p.name}</b>
            <span>{money(p.price)}</span>
          </p>
        ))}
      </div>
    </div>
  )
}
