import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PRODUCTS, img } from './data/products'
import { LINKS, useRoute } from './lib/router'
import Header from './components/Header.jsx'
import Rack from './components/Rack.jsx'
import Orbit from './components/Orbit.jsx'
import Focus from './components/Focus.jsx'
import Bag from './components/Bag.jsx'
import Shop from './pages/Shop.jsx'
import Lookbook from './pages/Lookbook.jsx'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'

const DEFAULT_TINT = '#e9e8e4'

export default function App() {
  const route = useRoute()
  const [view, setView] = useState('rack') // 'rack' | 'orbit'
  const [focus, setFocus] = useState(null) // null or { p, v }
  const [bag, setBag] = useState([])
  const [bagOpen, setBagOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [ordered, setOrdered] = useState(false)
  const wallRef = useRef(null)

  const open = useCallback((p, v = 0) => setFocus({ p, v }), [])
  const close = useCallback(() => setFocus(null), [])
  const nav = useCallback(
    (dir) => setFocus((f) => (f ? { p: (f.p + dir + PRODUCTS.length) % PRODUCTS.length, v: 0 } : f)),
    [],
  )
  const setVariant = useCallback((v) => setFocus((f) => (f ? { ...f, v } : f)), [])
  const onNavigate = useCallback(() => {
    setFocus(null)
    setMenuOpen(false)
  }, [])

  // leaving a page always closes the product view and the menu
  useEffect(() => {
    setFocus(null)
    setMenuOpen(false)
  }, [route])

  const addToBag = useCallback((product, variant, size) => {
    const key = `${variant.slug}-${size}`
    setBag((b) => {
      const hit = b.find((i) => i.key === key)
      if (hit) return b.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i))
      return [
        ...b,
        { key, slug: variant.slug, name: product.name, label: variant.label, size, price: product.price, qty: 1 },
      ]
    })
  }, [])

  const changeQty = useCallback((key, d) => {
    setBag((b) => b.map((i) => (i.key === key ? { ...i, qty: i.qty + d } : i)).filter((i) => i.qty > 0))
  }, [])

  const checkout = () => {
    setBag([])
    setBagOpen(false)
    setOrdered(true)
  }

  const count = useMemo(() => bag.reduce((n, i) => n + i.qty, 0), [bag])
  const total = useMemo(() => bag.reduce((n, i) => n + i.qty * i.price, 0), [bag])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (ordered) setOrdered(false)
        else if (bagOpen) setBagOpen(false)
        else if (menuOpen) setMenuOpen(false)
        else setFocus(null)
      }
      if (!bagOpen && focus && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        if (e.key === 'ArrowLeft') nav(-1)
        if (e.key === 'ArrowRight') nav(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nav, bagOpen, ordered, menuOpen, focus])

  // Warm the image cache so everything opens instantly.
  useEffect(() => {
    PRODUCTS.forEach((p) =>
      p.variants.forEach((v) => {
        new Image().src = img(v.slug, 'front')
        new Image().src = img(v.slug, 'side')
      }),
    )
  }, [])

  // Background parallax (writes CSS vars, no re-render).
  const onWallMove = (e) => {
    const el = wallRef.current
    if (!el) return
    el.style.setProperty('--mx', (e.clientX / window.innerWidth - 0.5).toFixed(3))
    el.style.setProperty('--my', (e.clientY / window.innerHeight - 0.5).toFixed(3))
  }

  const product = focus && PRODUCTS[focus.p]
  const variant = product && product.variants[focus.v]
  const home = route === '/'
  const dark = route === '/about' && !focus

  return (
    <div
      className={`wall ${dark ? 'dark' : ''}`}
      ref={wallRef}
      onPointerMove={onWallMove}
      style={{ '--tint': focus ? variant.wall : dark ? '#0a0908' : DEFAULT_TINT }}
    >
      <Header
        route={route}
        view={view}
        onView={setView}
        inFocus={!!focus}
        onBack={close}
        onNavigate={onNavigate}
        count={count}
        onBag={() => setBagOpen(true)}
        menuOpen={menuOpen}
        onMenu={() => setMenuOpen((o) => !o)}
      />

      <main className="stage">
        <Rack hidden={!!focus || !home || view !== 'rack'} onOpen={open} />
        <Orbit hidden={!!focus || !home || view !== 'orbit'} onOpen={open} />

        <p className={`hint ${focus || !home ? 'is-hidden' : ''}`}>
          {view === 'rack'
            ? 'Move through the rack · click a piece'
            : 'Drag to spin the carousel · click the front piece'}
        </p>
      </main>

      {!home && (
        <div className={`page ${focus ? 'is-hidden' : ''} ${route === '/about' ? 'cine' : ''}`} key={route}>
          {route === '/shop' && <Shop onOpen={open} onAdd={addToBag} />}
          {route === '/lookbook' && <Lookbook onOpen={open} />}
          {route === '/about' && <About />}
          {route === '/contact' && <Contact />}
        </div>
      )}

      {focus && (
        <Focus
          key={product.id}
          product={product}
          variantIndex={focus.v}
          index={focus.p}
          total={PRODUCTS.length}
          onNav={nav}
          onVariant={setVariant}
          onAdd={addToBag}
        />
      )}

      <nav className={`menu ${menuOpen ? 'on' : ''}`} aria-hidden={!menuOpen} aria-label="Menu">
        {[['/', 'Home'], ...LINKS].map(([p, l], i) => (
          <a
            key={p}
            href={`#${p}`}
            style={{ '--n': i }}
            onClick={onNavigate}
            tabIndex={menuOpen ? 0 : -1}
            className={route === p ? 'on' : ''}
          >
            <small>0{i + 1}</small>
            {l}
          </a>
        ))}
      </nav>

      <Bag
        open={bagOpen}
        items={bag}
        count={count}
        total={total}
        onClose={() => setBagOpen(false)}
        onQty={changeQty}
        onCheckout={checkout}
      />

      {ordered && (
        <div className="ordered" onClick={() => setOrdered(false)}>
          <div className="ordered-card" onClick={(e) => e.stopPropagation()}>
            <b>Order placed</b>
            <p>This is a demo store, so nothing was charged and nothing will ship.</p>
            <button type="button" onClick={() => setOrdered(false)}>
              Keep browsing
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
