import { useEffect, useRef, useState } from 'react'
import { PRODUCTS, img, money, pad } from '../data/products'
import { useReveal } from '../lib/useReveal'
import Title3D from '../components/Title3D.jsx'
import Footer from '../components/Footer.jsx'

const D = 900 // distance between looks along the z axis (px)

// x / y are in vw / vh, ry in degrees
const LOOKS = [
  { p: 0, x: -16, y: -2, ry: 14, note: 'Washed crimson on heavy cotton. Wear it loose, sleeves pushed up.' },
  { p: 1, x: 17, y: 3, ry: -12, note: 'The slogan tee in three colourways. One attitude.' },
  { p: 2, x: -18, y: 0, ry: 12, note: 'Painted, distressed, layered over everything.' },
  { p: 3, x: 15, y: -3, ry: -14, note: 'Wool body, leather-look sleeves. The one you keep for ten years.' },
  { p: 4, x: -14, y: 2, ry: 10, note: 'Faded blue, oversized print. Easy and loud.' },
  { p: 5, x: 18, y: -1, ry: -12, note: 'Mesh football jersey. Roomy on purpose.' },
  { p: 6, x: -12, y: 3, ry: 12, note: 'A raised silicone logo you can feel from across the room.' },
]
const N = LOOKS.length

export default function Lookbook({ onOpen }) {
  const ref = useReveal()
  const secRef = useRef(null)
  const stageRef = useRef(null)
  const worldRef = useRef(null)
  const barRef = useRef(null)
  const itemRefs = useRef([])
  const idxRef = useRef(0)
  const [idx, setIdx] = useState(0)

  // Scrolling flies the camera forward through the looks.
  useEffect(() => {
    const sec = secRef.current
    const sc = sec.closest('.page')
    const update = () => {
      const range = sec.offsetHeight - stageRef.current.offsetHeight
      const prog = Math.max(0, Math.min(1, (sc.scrollTop - sec.offsetTop) / Math.max(1, range)))
      const cam = prog * (N - 1) * D
      worldRef.current.style.transform = `translateZ(${cam.toFixed(1)}px)`
      itemRefs.current.forEach((el, i) => {
        if (!el) return
        const z = -i * D + cam // distance in front of / behind the camera
        const o = Math.max(0, Math.min(1, z > 0 ? 1 - z / (D * 0.7) : 1 + z / (D * 2.2)))
        el.style.opacity = o.toFixed(3)
        el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
        el.style.pointerEvents = Math.abs(z) < D * 0.35 ? 'auto' : 'none'
      })
      if (barRef.current) barRef.current.style.transform = `scaleX(${prog.toFixed(3)})`
      const k = Math.round(prog * (N - 1))
      if (k !== idxRef.current) {
        idxRef.current = k
        setIdx(k)
      }
    }
    sc.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => {
      sc.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div ref={ref} className="pg lookbook">
      <header className="pg-hero">
        <p className="eyebrow">Season 01 — {pad(N)} looks</p>
        <Title3D text="Lookbook" />
        <p className="lede">
          Scroll to walk through the collection. Each look sits a little deeper in the room — keep going, and click
          any piece to open it.
        </p>
      </header>

      <section className="lb" ref={secRef} style={{ '--n': N }}>
        <div className="lb-stage" ref={stageRef}>
          <div className="lb-world" ref={worldRef}>
            {LOOKS.map((l, i) => {
              const p = PRODUCTS[l.p]
              return (
                <figure
                  key={p.id}
                  className="look"
                  ref={(el) => (itemRefs.current[i] = el)}
                  style={{ '--i': i, '--x': l.x, '--y': l.y, '--ry': l.ry }}
                >
                  <span className="look-num" aria-hidden="true">
                    {pad(i + 1)}
                  </span>
                  <img src={img(p.variants[0].slug, 'front')} alt={p.name} draggable="false" width="1086" height="1448" decoding="async" />
                  <figcaption>
                    <b>{p.name}</b>
                    <span>{l.note}</span>
                    <button type="button" onClick={() => onOpen(l.p)}>
                      View piece — {money(p.price)}
                    </button>
                  </figcaption>
                </figure>
              )
            })}
          </div>

          <div className="lb-hud" aria-hidden="true">
            <span>
              Look {pad(idx + 1)} / {pad(N)}
            </span>
            <div className="lb-bar">
              <i ref={barRef} />
            </div>
          </div>
          <p className={`lb-scroll ${idx > 0 ? 'gone' : ''}`}>Scroll ↓</p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
