import { useRef } from 'react'

// Big extruded headline: letters flip in one by one, then the whole word
// tilts toward the pointer.
export default function Title3D({ text, as: Tag = 'h1', className = '' }) {
  const ref = useRef(null)

  const move = (e) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 20).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 16).toFixed(2)}deg`)
  }
  const leave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--rx', '0deg')
  }

  const words = text.split(' ')
  let n = 0
  return (
    <Tag className={`t3d ${className}`} ref={ref} onPointerMove={move} onPointerLeave={leave} aria-label={text}>
      {words.map((w, wi) => (
        <span className="t3d-word" key={wi} aria-hidden="true">
          {[...w].map((ch) => (
            <span key={n} className="t3d-ch" style={{ '--i': n++ }}>
              {ch}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  )
}
