import { useMemo, useRef, useState } from 'react'
import { PRODUCTS, img, money, pad } from '../data/products'
import { flyTo } from '../lib/fly'
import { tilt } from '../lib/tilt'
import { useReveal } from '../lib/useReveal'
import Title3D from '../components/Title3D.jsx'
import Footer from '../components/Footer.jsx'

const CAT = {
  'crimson-memory': 'Tops',
  'its-us-tee': 'Tees',
  tank: 'Tops',
  varsity: 'Outerwear',
  'distressed-logo-t': 'Tees',
  jersey: 'Tops',
  'silicone-tee': 'Tees',
}
const FILTERS = ['All', 'Tees', 'Tops', 'Outerwear']
const SORTS = [
  ['featured', 'Featured'],
  ['low', 'Price ↑'],
  ['high', 'Price ↓'],
]
const t = tilt(13)

function Card({ p, idx, n, onOpen, onAdd }) {
  const [vi, setVi] = useState(0)
  const [done, setDone] = useState(false)
  const imgRef = useRef(null)
  const v = p.variants[vi]

  const quick = (e) => {
    e.stopPropagation()
    flyTo(imgRef.current, document.getElementById('bag-btn'), img(v.slug, 'front'))
    onAdd(p, v, 'M')
    setDone(true)
    setTimeout(() => setDone(false), 1400)
  }
  const open = () => onOpen(idx, vi)

  return (
    <article className="card" style={{ '--n': n }} {...t}>
      <div className="card-tilt">
        <div
          className="card-media"
          role="button"
          tabIndex={0}
          aria-label={`Open ${p.name}`}
          onClick={open}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open()}
        >
          <img ref={imgRef} className="c-front" src={img(v.slug, 'front')} alt="" draggable="false" width="1086" height="1448" loading="lazy" />
          <img className="c-side" src={img(v.slug, 'side')} alt="" draggable="false" width="1086" height="1448" loading="lazy" />
          <i className="card-glare" />
          <span className="card-no">{pad(idx + 1)}</span>
          <span className="card-view">View in 3D</span>
        </div>

        <div className="card-info">
          <div>
            <b>{p.name}</b>
            <span>
              {CAT[p.id]} · {v.label}
            </span>
          </div>
          <strong>{money(p.price)}</strong>
        </div>

        <div className="card-foot">
          <div className="dots" role="group" aria-label="Colour">
            {p.variants.map((x, i) => (
              <button
                key={x.slug}
                type="button"
                className={i === vi ? 'on' : ''}
                style={{ '--c': x.color }}
                aria-label={x.label}
                aria-pressed={i === vi}
                onClick={() => setVi(i)}
              />
            ))}
          </div>
          <button type="button" className="card-add" onClick={quick}>
            {done ? 'Added ✓' : 'Quick add'}
          </button>
        </div>
      </div>
    </article>
  )
}

export default function Shop({ onOpen, onAdd }) {
  const ref = useReveal()
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('featured')

  const list = useMemo(() => {
    let a = PRODUCTS.map((p, idx) => ({ p, idx })).filter((x) => filter === 'All' || CAT[x.p.id] === filter)
    if (sort === 'low') a = [...a].sort((x, y) => x.p.price - y.p.price)
    if (sort === 'high') a = [...a].sort((x, y) => y.p.price - x.p.price)
    return a
  }, [filter, sort])

  return (
    <div ref={ref} className="pg shop">
      <header className="pg-hero">
        <p className="eyebrow">Collection 01 — {pad(PRODUCTS.length)} pieces</p>
        <Title3D text="The Shop" />
        <p className="lede">
          Every piece is a 3D object: tilt it, flip it, open it up and spin it. Pick a colour, then quick-add it to
          your bag or open the turntable for the full view.
        </p>
      </header>

      <div className="toolbar" data-reveal>
        <div className="chips" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f} type="button" className={f === filter ? 'on' : ''} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Sort">
          {SORTS.map(([k, l]) => (
            <button key={k} type="button" className={k === sort ? 'on' : ''} onClick={() => setSort(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <p className="count" aria-live="polite">
        {list.length} {list.length === 1 ? 'piece' : 'pieces'}
      </p>

      <div className="grid" key={`${filter}-${sort}`}>
        {list.map(({ p, idx }, n) => (
          <Card key={p.id} p={p} idx={idx} n={n} onOpen={onOpen} onAdd={onAdd} />
        ))}
      </div>

      <Footer />
    </div>
  )
}
