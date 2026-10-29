import { useEffect, useRef, useState } from 'react'
import { SIZES, img, money, pad } from '../data/products'
import { flyTo } from '../lib/fly'

const SLICES = [-2, -1, 0, 1, 2] // fake thickness behind the faces (px)

const Chevron = ({ dir }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d={dir === 'l' ? 'M11 3 5 9l6 6' : 'M7 3l6 6-6 6'} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function Focus({ product, variantIndex, index, total, onNav, onVariant, onAdd }) {
  const variant = product.variants[variantIndex]
  const front = img(variant.slug, 'front')
  const side = img(variant.slug, 'side')

  const [size, setSize] = useState('M')
  const [face, setFace] = useState('front')
  const [added, setAdded] = useState(false)

  const stageRef = useRef(null)
  const cardRef = useRef(null)
  const faceRef = useRef('front')
  const addTimer = useRef(0)
  const firstVariant = useRef(true)
  // a = current yaw, target = where it's heading (multiples of 180 when at rest)
  const st = useRef({ a: -360, target: 0, v: 0, drag: false, px: 0, py: 0, tx: 0, ty: 0 })

  useEffect(() => () => clearTimeout(addTimer.current), [])

  // the turntable loop
  useEffect(() => {
    let raf
    let last = performance.now()
    const tick = (now) => {
      const s = st.current
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      if (s.drag) {
        s.v *= Math.pow(0.8, dt * 60)
      } else if (Math.abs(s.v) > 0.08) {
        s.target += s.v * dt * 60
        s.v *= Math.pow(0.92, dt * 60)
      } else {
        s.v = 0
        s.target = Math.round(s.target / 180) * 180
      }
      s.a += (s.target - s.a) * (1 - Math.exp(-dt * (s.drag ? 30 : 8)))
      s.tx += (s.px * 10 - s.tx) * (1 - Math.exp(-dt * 6))
      s.ty += (s.py * -7 - s.ty) * (1 - Math.exp(-dt * 6))

      const yaw = s.a + s.tx + Math.sin(now / 1300) * 2.2
      const pitch = s.ty + Math.sin(now / 1700) * 1.2
      const rad = (yaw * Math.PI) / 180
      const card = cardRef.current
      const stage = stageRef.current
      if (card && stage) {
        card.style.transform = `rotateX(${pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg)`
        card.style.setProperty('--sheen', (50 - Math.sin(rad) * 90 + s.px * 25).toFixed(1))
        stage.style.setProperty('--fs', (0.45 + 0.55 * Math.abs(Math.cos(rad))).toFixed(3))
        const f = Math.cos(rad) >= 0 ? 'front' : 'side'
        if (f !== faceRef.current) {
          faceRef.current = f
          setFace(f)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // changing colour = one flourish spin
  useEffect(() => {
    if (firstVariant.current) {
      firstVariant.current = false
      return
    }
    st.current.target += 360
  }, [variantIndex])

  const onPointerDown = (e) => {
    if (e.target.closest('button')) return
    const s = st.current
    s.drag = true
    s.v = 0
    let lastX = e.clientX
    const move = (ev) => {
      const dx = ev.clientX - lastX
      lastX = ev.clientX
      s.target += dx * 0.6
      s.v = dx * 0.6
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

  const onPointerMove = (e) => {
    const r = stageRef.current.getBoundingClientRect()
    st.current.px = ((e.clientX - r.left) / r.width - 0.5) * 2
    st.current.py = ((e.clientY - r.top) / r.height - 0.5) * 2
  }
  const onPointerLeave = () => {
    st.current.px = 0
    st.current.py = 0
  }

  const showFront = () => {
    const s = st.current
    s.v = 0
    s.target = Math.round(s.target / 360) * 360
  }
  const showSide = () => {
    const s = st.current
    s.v = 0
    s.target = Math.round((s.target - 180) / 360) * 360 + 180
  }
  const spin = () => {
    st.current.v = 0
    st.current.target += 360
  }

  const add = () => {
    flyTo(cardRef.current, document.getElementById('bag-btn'), front)
    onAdd(product, variant, size)
    spin()
    setAdded(true)
    clearTimeout(addTimer.current)
    addTimer.current = setTimeout(() => setAdded(false), 1600)
  }

  // 3D tilt on the big button
  const tilt = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--bx', (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(2))
    e.currentTarget.style.setProperty('--by', (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(2))
  }
  const untilt = (e) => {
    e.currentTarget.style.setProperty('--bx', 0)
    e.currentTarget.style.setProperty('--by', 0)
  }

  return (
    <div className="focus">
      <section
        className="tt"
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <div className="tt-scene">
          <div className="tt-card" ref={cardRef}>
            {SLICES.map((z) => (
              <img
                key={z}
                className="tt-slice"
                src={front}
                alt=""
                draggable="false"
                style={{ transform: `translateZ(${z}px)` }}
              />
            ))}
            <div className="tt-face tt-front" style={{ '--m': `url(${front})` }}>
              <img src={front} alt={`${product.name} — ${variant.label}`} draggable="false" width="1086" height="1448" />
              <i className="tt-glare" />
            </div>
            <div className="tt-face tt-back" style={{ '--m': `url(${side})` }}>
              <img src={side} alt="" draggable="false" width="1086" height="1448" />
              <i className="tt-glare" />
            </div>
          </div>
          <div className="tt-floor" />
        </div>

        <button type="button" className="focus-arrow l" aria-label="Previous product" onClick={() => onNav(-1)}>
          <Chevron dir="l" />
        </button>
        <button type="button" className="focus-arrow r" aria-label="Next product" onClick={() => onNav(1)}>
          <Chevron dir="r" />
        </button>

        <div className="tt-controls" role="group" aria-label="View">
          <button type="button" className={face === 'front' ? 'lit' : ''} onClick={showFront}>Front</button>
          <button type="button" onClick={spin}>360°</button>
          <button type="button" className={face === 'side' ? 'lit' : ''} onClick={showSide}>Side</button>
        </div>
        <p className="tt-hint">Drag to rotate</p>
      </section>

      <aside className="panel">
        <p className="eyebrow">No. {pad(index + 1)} / {pad(total)}</p>
        <h2 className="p-name">{product.name}</h2>
        <p className="p-price">{money(product.price)}</p>
        <p className="p-desc">{product.desc}</p>

        <div className="p-row">
          <span className="p-label">Colour — <b>{variant.label}</b></span>
          <div className="swatches" role="group" aria-label="Colour">
            {product.variants.map((v, i) => (
              <button
                key={v.slug}
                type="button"
                className={`swatch ${i === variantIndex ? 'on' : ''}`}
                style={{ '--c': v.color }}
                aria-label={v.label}
                aria-pressed={i === variantIndex}
                onClick={() => onVariant(i)}
              >
                <i />
              </button>
            ))}
          </div>
        </div>

        <div className="p-row">
          <span className="p-label">Size — <b>{size}</b></span>
          <div className="sizes" role="group" aria-label="Size">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                className={s === size ? 'on' : ''}
                aria-pressed={s === size}
                onClick={() => setSize(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className={`add ${added ? 'is-added' : ''}`}
          onClick={add}
          onPointerMove={tilt}
          onPointerLeave={untilt}
        >
          <span className="add-face">
            <span className="add-a">Add to bag — {money(product.price)}</span>
            <span className="add-b">Added ✓</span>
          </span>
        </button>
      </aside>
    </div>
  )
}
