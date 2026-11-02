import { useEffect, useRef, useState } from 'react'

const TOPICS = ['Order', 'Sizing', 'Press', 'Other']
const EMAIL = 'hello@fancyclothes.example'

/* ---------- headline: black letters that fade into olive, then the lime "O" ---------- */
const lerp = (a, b, t) => Math.round(a + (b - a) * t)
const tone = (t) => `rgb(${lerp(11, 112, t)}, ${lerp(11, 152, t)}, ${lerp(9, 8, t)})`
const SAY = [
  ['S', 0],
  ['A', 0],
  ['Y', 0],
]
const HELL = [
  ['H', 0],
  ['E', 0.1],
  ['L', 0.5],
  ['L', 0.85],
]

/* ---------- scalloped wax seal outline ---------- */
const SEAL = (() => {
  const pts = []
  for (let i = 0; i < 360; i += 2) {
    const a = (i * Math.PI) / 180
    const r = 46 + 2.2 * Math.cos(a * 16)
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
})()

/* ---------- the glowing ring around the envelope (an ellipse rotated -9°) ---------- */
const RING = { cx: 450, cy: 400, rx: 405, ry: 165, rot: -9 }
const onRing = (deg) => {
  const a = (deg * Math.PI) / 180
  const x = RING.rx * Math.cos(a)
  const y = RING.ry * Math.sin(a)
  const t = (RING.rot * Math.PI) / 180
  return [RING.cx + x * Math.cos(t) - y * Math.sin(t), RING.cy + x * Math.sin(t) + y * Math.cos(t)]
}
const [LX, LY] = onRing(212) // lime sphere, left
const [RX, RY] = onRing(326) // lime sphere, right
const [SX, SY] = onRing(4) // silver sphere
const [BX, BY] = onRing(70) // glass bead

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

const Sparkle = ({ x, y, s = 1, d = '0s' }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path
      className="kc-twinkle"
      style={{ '--d': d }}
      d="M0 -10 Q1.3 -1.3 10 0 Q1.3 1.3 0 10 Q-1.3 1.3 -10 0 Q-1.3 -1.3 0 -10Z"
      fill="#fff"
      stroke="#d6ff3a"
      strokeOpacity=".5"
      strokeWidth=".8"
    />
  </g>
)

export default function Contact() {
  const sceneRef = useRef(null)
  const objRef = useRef(null)
  const envRef = useRef(null)
  const letterRef = useRef(null)
  const timers = useRef([])

  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', email: '', topic: 'Order', message: '' })
  const [err, setErr] = useState({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

  // The letter starts small enough to sit inside the envelope. Measure once and on resize.
  useEffect(() => {
    const measure = () => {
      const S = sceneRef.current
      const E = envRef.current
      const L = letterRef.current
      if (!S || !E || !L) return
      const H = E.offsetHeight
      const W = E.offsetWidth
      const hl = L.offsetHeight || 1
      const wl = L.offsetWidth || 1
      S.style.setProperty('--s0', Math.min(0.62, (H * 0.84) / hl, (W * 0.9) / wl).toFixed(3))
      S.style.setProperty('--rise', `${(-H * 0.62).toFixed(0)}px`)
      // desktop: the letter settles lower, so it keeps clear of the header
      const k = window.matchMedia('(min-width: 981px)').matches ? 0.232 : 0.08
      S.style.setProperty('--dock', `${(H * k).toFixed(0)}px`)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const onMove = (e) => {
    if (open) return
    const o = objRef.current
    if (!o) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    o.style.setProperty('--my', `${(x * 12).toFixed(2)}deg`)
    o.style.setProperty('--mx', `${(-y * 8).toFixed(2)}deg`)
  }
  const onLeave = () => {
    const o = objRef.current
    if (!o) return
    o.style.setProperty('--my', '0deg')
    o.style.setProperty('--mx', '0deg')
  }

  const openIt = () => {
    onLeave()
    setOpen(true)
  }

  // fade the letter out, then let it slide back in and close the flap
  const closeIt = () => {
    if (closing) return
    setClosing(true)
    later(() => {
      setOpen(false)
      setClosing(false)
    }, 280)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeIt()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closing])

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    if (busy) return
    const er = {}
    if (!f.name.trim()) er.name = 'Please add your name'
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Enter a valid email'
    if (f.message.trim().length < 5) er.message = 'Write a few words'
    setErr(er)
    if (Object.keys(er).length) return
    setBusy(true)
    later(() => {
      setBusy(false)
      setSent(true)
    }, 900)
  }

  const reset = () => {
    setF({ name: '', email: '', topic: 'Order', message: '' })
    setErr({})
    setSent(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL)
    } catch {
      /* clipboard may be blocked; the label still confirms the click */
    }
    setCopied(true)
    later(() => setCopied(false), 1600)
  }

  let n = 0

  return (
    <div className="pg contact">
      {/* ---------- backdrop: blurred leaves, light rays, thin arc ---------- */}
      <div className="kc-bg" aria-hidden="true">
        <svg viewBox="0 0 1672 941" preserveAspectRatio="xMidYMid slice">
          <defs>
            <filter id="kcb-b1" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
            <filter id="kcb-b2" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
            <linearGradient id="kcb-ray" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity=".75" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <path id="kcb-leaf" d="M0 0 C40 -44 120 -60 190 -16 C132 30 54 40 0 0Z" />
          </defs>
          <g filter="url(#kcb-b2)" opacity=".8">
            <polygon points="330,941 520,941 780,620 700,620" fill="url(#kcb-ray)" />
            <polygon points="560,941 700,941 930,690 870,690" fill="url(#kcb-ray)" />
            <polygon points="900,941 1040,941 1180,760 1120,760" fill="url(#kcb-ray)" opacity=".6" />
          </g>
          <g filter="url(#kcb-b1)">
            <use href="#kcb-leaf" transform="translate(-30 250) rotate(18) scale(1.1)" fill="#2e4a17" opacity=".85" />
            <use href="#kcb-leaf" transform="translate(-40 305) rotate(-14) scale(.9)" fill="#3f6a1f" opacity=".7" />
            <use href="#kcb-leaf" transform="translate(-34 470) rotate(-8) scale(.8)" fill="#6f9a2c" opacity=".55" />
            <use href="#kcb-leaf" transform="translate(-24 905) rotate(-30) scale(1.4)" fill="#2b4416" opacity=".8" />
            <use href="#kcb-leaf" transform="translate(26 965) rotate(-62) scale(1.3)" fill="#3f6a1f" opacity=".7" />
            <use href="#kcb-leaf" transform="translate(1710 560) rotate(200) scale(1.5)" fill="#2e4a17" opacity=".85" />
            <use href="#kcb-leaf" transform="translate(1706 655) rotate(168) scale(1.2)" fill="#4c7a22" opacity=".6" />
            <use href="#kcb-leaf" transform="translate(1694 905) rotate(216) scale(1.7)" fill="#2b4416" opacity=".85" />
            <use href="#kcb-leaf" transform="translate(1722 120) rotate(160) scale(.9)" fill="#6f9a2c" opacity=".35" />
          </g>
          <circle cx="-92" cy="800" r="152" fill="none" stroke="#141412" strokeOpacity=".55" strokeWidth="1" />
        </svg>
      </div>

      <section className="kc-stage">
        {/* ---------- left column ---------- */}
        <div className="kc-copy-col">
          <p className="kc-eyebrow">
            <span>Get in touch</span>
            <i className="kc-dot" aria-hidden="true" />
            <i className="kc-rule" aria-hidden="true" />
          </p>

          <h1 className="kc-title" aria-label="Say Hello">
            <span className="kc-word" aria-hidden="true">
              {SAY.map(([ch, t]) => (
                <span key={n} className="kc-ch" style={{ '--i': n++, '--c': tone(t) }}>
                  {ch}
                </span>
              ))}
            </span>
            <span className="kc-word" aria-hidden="true">
              {HELL.map(([ch, t]) => (
                <span key={n} className="kc-ch" style={{ '--i': n++, '--c': tone(t) }}>
                  {ch}
                </span>
              ))}
              <span className="kc-o" style={{ '--i': n }}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" fill="#fff" />
                </svg>
              </span>
            </span>
          </h1>

          <p className="kc-lede">
            Questions about sizing, an order or a collaboration?
            <br />
            Open the envelope and write us a few lines.
          </p>
          <p className="kc-lede kc-demo">(This is a demo, so nothing leaves your browser.)</p>

          <ul className="kc-info">
            <li>
              <span className="kc-ic">
                <Icon>
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="M3.8 7.6 12 13.2l8.2-5.6" />
                </Icon>
              </span>
              <div>
                <span className="kc-lab">Email</span>
                <b>{EMAIL}</b>
              </div>
              <button type="button" className="kc-copy" onClick={copy}>
                <Icon>
                  <rect x="9" y="9" width="11" height="11" rx="2.2" />
                  <path d="M5 15V6.4A2.4 2.4 0 0 1 7.4 4H15" />
                </Icon>
                <span>{copied ? 'Copied ✓' : 'Copy'}</span>
              </button>
            </li>
            <li>
              <span className="kc-ic">
                <Icon>
                  <path d="M4.5 9 6 4h12l1.5 5" />
                  <path d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />
                  <path d="M5 11.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5" />
                  <rect x="9" y="14" width="6" height="6" rx=".8" />
                </Icon>
              </span>
              <div>
                <span className="kc-lab">Studio</span>
                <b>Unit 12, Sample Street</b>
              </div>
            </li>
            <li>
              <span className="kc-ic">
                <Icon>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5.2l3.2 2" />
                </Icon>
              </span>
              <div>
                <span className="kc-lab">Hours</span>
                <b>Mon – Fri, 10:00 – 18:00</b>
              </div>
            </li>
          </ul>

          <button
            type="button"
            className={`kc-cta ${open ? 'is-gone' : ''}`}
            onClick={openIt}
            tabIndex={open ? -1 : 0}
            aria-hidden={open}
          >
            <span>Open the envelope</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12h16M14 6l6 6-6 6" />
            </svg>
          </button>

          <p className="kc-sign">
            <span>We reply soon</span>
            <b aria-hidden="true">·</b>
            <span>Fancy Clothes team</span>
          </p>
        </div>

        {/* ---------- right: the envelope scene ---------- */}
        <div className="kc-scene-wrap">
          <div ref={sceneRef} className={`kc-scene ${open ? 'open' : ''} ${closing ? 'closing' : ''}`} onPointerMove={onMove} onPointerLeave={onLeave}>
            {/* back layer: glow, podium, back half of the ring, floating pieces */}
            <svg className="kc-layer kc-back" viewBox="0 0 872 841" aria-hidden="true">
              <defs>
                <radialGradient id="kcg-glow" cx=".5" cy=".5" r=".5">
                  <stop offset="0" stopColor="#d6ff3a" stopOpacity=".6" />
                  <stop offset="1" stopColor="#d6ff3a" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="kcg-top" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#f4f1e8" />
                  <stop offset=".55" stopColor="#e0dacb" />
                  <stop offset="1" stopColor="#c9c2b0" />
                </linearGradient>
                <linearGradient id="kcg-side" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#b3ab97" />
                  <stop offset=".3" stopColor="#e4dfd2" />
                  <stop offset=".68" stopColor="#cfc8b6" />
                  <stop offset="1" stopColor="#9e9682" />
                </linearGradient>
                <linearGradient id="kcg-ring" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#c8ff2e" />
                  <stop offset=".5" stopColor="#f6ffd0" />
                  <stop offset="1" stopColor="#b4e81a" />
                </linearGradient>
                <linearGradient id="kcg-bag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#2b2b27" />
                  <stop offset="1" stopColor="#10100e" />
                </linearGradient>
                <linearGradient id="kcg-skirt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fffaf0" />
                  <stop offset="1" stopColor="#e4d6b8" />
                </linearGradient>
                <clipPath id="kcg-up">
                  <rect x="0" y="0" width="872" height="400" />
                </clipPath>
                <clipPath id="kcg-dn">
                  <rect x="0" y="400" width="872" height="441" />
                </clipPath>
                <clipPath id="kcg-topclip">
                  <ellipse cx="388" cy="672" rx="308" ry="50" />
                </clipPath>
                <filter id="kcg-blur" x="-30%" y="-60%" width="160%" height="220%">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
                <filter id="kcg-blur-lg" x="-30%" y="-80%" width="160%" height="260%">
                  <feGaussianBlur stdDeviation="16" />
                </filter>
              </defs>

              {/* lime light on the floor */}
              <ellipse cx="392" cy="728" rx="390" ry="70" fill="url(#kcg-glow)" filter="url(#kcg-blur-lg)" />

              {/* marble podium */}
              <ellipse cx="388" cy="718" rx="324" ry="56" fill="none" stroke="#d9ff4a" strokeWidth="7" opacity=".75" filter="url(#kcg-blur)" />
              <path d="M80 672 L80 712 A308 50 0 0 0 696 712 L696 672 Z" fill="url(#kcg-side)" />
              <path d="M80 700 A308 50 0 0 0 696 700" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="6" />
              <ellipse cx="388" cy="672" rx="308" ry="50" fill="url(#kcg-top)" />
              <g clipPath="url(#kcg-topclip)" fill="none" strokeLinecap="round">
                <path d="M120 660 C190 648 215 690 290 672 S380 640 440 668" stroke="#b79a52" strokeOpacity=".55" strokeWidth="1.4" />
                <path d="M520 646 C560 660 590 690 650 676" stroke="#b79a52" strokeOpacity=".5" strokeWidth="1.2" />
                <path d="M230 690 C270 700 310 712 360 700" stroke="#8d887b" strokeOpacity=".45" strokeWidth="1" />
                <path d="M470 700 C520 692 560 700 600 692" stroke="#8d887b" strokeOpacity=".4" strokeWidth="1" />
                <path d="M300 648 C320 660 340 656 356 668" stroke="#d3b45e" strokeOpacity=".55" strokeWidth="1.6" />
              </g>
              <ellipse cx="388" cy="672" rx="308" ry="50" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.6" />
              <path d="M80 712 A308 50 0 0 0 696 712" fill="none" stroke="#d6ff3a" strokeWidth="3" strokeOpacity=".9" />
              <ellipse cx="420" cy="676" rx="200" ry="26" fill="url(#kcg-glow)" />

              {/* ring: the half behind the envelope */}
              <g transform={`rotate(${RING.rot} ${RING.cx} ${RING.cy})`}>
                <ellipse cx={RING.cx} cy={RING.cy} rx={RING.rx} ry={RING.ry} fill="none" stroke="#c8ff2e" strokeWidth="16" opacity=".32" filter="url(#kcg-blur)" clipPath="url(#kcg-up)" />
                <ellipse cx={RING.cx} cy={RING.cy} rx={RING.rx} ry={RING.ry} fill="none" stroke="url(#kcg-ring)" strokeWidth="6.5" strokeOpacity=".9" clipPath="url(#kcg-up)" />
                <ellipse cx={RING.cx} cy={RING.cy} rx={RING.rx} ry={RING.ry} fill="none" stroke="#fff" strokeWidth="1.4" strokeOpacity=".85" clipPath="url(#kcg-up)" />
              </g>

              {/* (animated pieces live in their own svg, so the blur filters above are not repainted every frame) */}
            </svg>
            <svg className="kc-layer kc-back" viewBox="0 0 872 841" aria-hidden="true">
              {/* dashed flight path + paper plane */}
              <g className="kc-fade">
                <path d="M77 302 C66 214 118 168 232 138" fill="none" stroke="#a9d400" strokeWidth="2.2" strokeDasharray="7 8" strokeLinecap="round" />
                <g className="kc-fl" style={{ '--d': '-1s' }}>
                  <path d="M222 108 L313 93 L270 128 Z" fill="#fff" stroke="#e3dfd2" strokeWidth="1" strokeLinejoin="round" />
                  <path d="M270 128 L313 93 L282 149 Z" fill="#d8d4c7" />
                  <path d="M222 108 L270 128 L261 142 Z" fill="#ebe8dd" />
                </g>
              </g>

              {/* shopping bag */}
              <g className="kc-fade" transform="translate(416 192) rotate(9)">
                <g className="kc-fl" style={{ '--d': '-2.2s' }}>
                  <path d="M-24 -36 C-27 -84 27 -84 24 -36" fill="none" stroke="#1a1a17" strokeWidth="4.5" strokeLinecap="round" />
                  <path d="M-12 -36 C-13 -68 15 -68 13 -36" fill="none" stroke="#33332e" strokeWidth="3" strokeLinecap="round" />
                  <path d="M50 -36 L70 -28 L62 56 L42 64 Z" fill="#20201d" />
                  <path d="M-50 -36 L50 -36 L42 64 L-42 64 Z" fill="url(#kcg-bag)" />
                  <path d="M-50 -36 L50 -36" stroke="#45453f" strokeWidth="1.4" />
                  <text x="0" y="13" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#e2e0d3" letterSpacing="1.2" fontFamily="'Archivo Black', Arial, sans-serif">
                    FANCY
                  </text>
                  <text x="0" y="27" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#e2e0d3" letterSpacing="1.2" fontFamily="'Archivo Black', Arial, sans-serif">
                    CLOTHES
                  </text>
                </g>
              </g>

              {/* dress on a stand */}
              <g className="kc-fade" transform="translate(618 176)">
                <g className="kc-fl" style={{ '--d': '-3.4s' }}>
                  <rect x="-1.6" y="108" width="3.2" height="32" fill="#c9b27a" />
                  <ellipse cx="0" cy="142" rx="13" ry="3.6" fill="#cdb98a" />
                  <path d="M-12 44 C-44 58 -58 92 -54 110 C-22 121 22 121 54 110 C58 92 44 58 12 44 Z" fill="url(#kcg-skirt)" />
                  <path d="M-16 58 C-22 80 -26 98 -28 114 M0 52 C0 76 0 98 0 118 M16 58 C22 80 26 98 28 114" fill="none" stroke="#d6c7a2" strokeOpacity=".75" strokeWidth=".9" />
                  <path d="M-13 8 L13 8 L12 26 L11 46 L-11 46 L-12 26 Z" fill="#f6eedd" />
                  <ellipse cx="-16" cy="13" rx="7" ry="8" fill="#f6eedd" />
                  <ellipse cx="16" cy="13" rx="7" ry="8" fill="#f6eedd" />
                  <path d="M-6 8 L0 21 L6 8" fill="#ecdfc4" stroke="#dccda9" strokeWidth=".8" />
                  <path d="M-11 44 L11 44" stroke="#dfd0ac" strokeWidth="2" />
                  <ellipse cx="0" cy="2" rx="5" ry="6" fill="#eadcc2" />
                </g>
              </g>
            </svg>

            {/* handwritten note */}
            <div className="kc-script kc-fade" aria-hidden="true">
              <span>Let&rsquo;s</span>
              <span>Create Something</span>
              <span>Amazing Together</span>
              <svg viewBox="0 0 50 56" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M24 50 C6 34 6 14 17 10 C22 8 25 12 25 17 C26 11 33 6 39 11 C46 18 38 34 24 50 Z" />
                <path d="M30 12 C38 4 44 6 46 12" />
              </svg>
            </div>

            {/* the envelope (this is the part that opens) */}
            <div ref={objRef} className="kc-obj">
              <div ref={envRef} className="kc-env">
                {/* inside of the envelope */}
                <div className="kc-lining" />

                {/* the letter = the form */}
                <div ref={letterRef} className="kc-letter">
                  <div className="kc-rules" aria-hidden="true" />
                  <button type="button" className="kc-x" onClick={closeIt} aria-label="Close the letter" tabIndex={open ? 0 : -1}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                  <div className="kc-letter-in" aria-hidden={!open} inert={open ? undefined : ''}>
                    {sent ? (
                      <div className="kc-done" role="status">
                        <svg width="64" height="64" viewBox="0 0 76 76" aria-hidden="true">
                          <circle className="kc-ring" cx="38" cy="38" r="34" fill="none" strokeWidth="3" />
                          <path className="kc-tick" d="M23 39l11 11 20-23" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <h2>Thanks, {f.name.trim().split(' ')[0] || 'friend'}.</h2>
                        <p>
                          Your message about “{f.topic.toLowerCase()}” would be on its way. This is a demo, so nothing was
                          actually sent.
                        </p>
                        <button type="button" className="kc-send" onClick={reset}>
                          <span>Write another</span>
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={submit} noValidate>
                        <h2 className="kc-h">Dear Fancy Clothes,</h2>

                        <label className={`kc-field ${err.name ? 'err' : ''}`}>
                          <span>Name</span>
                          <input value={f.name} onChange={set('name')} autoComplete="name" />
                          {err.name && <em>{err.name}</em>}
                        </label>

                        <label className={`kc-field ${err.email ? 'err' : ''}`}>
                          <span>Email</span>
                          <input value={f.email} onChange={set('email')} type="email" autoComplete="email" />
                          {err.email && <em>{err.email}</em>}
                        </label>

                        <div className="kc-field">
                          <span>Topic</span>
                          <div className="kc-chips" role="group" aria-label="Topic">
                            {TOPICS.map((x) => (
                              <button
                                key={x}
                                type="button"
                                className={f.topic === x ? 'on' : ''}
                                aria-pressed={f.topic === x}
                                onClick={() => setF((s) => ({ ...s, topic: x }))}
                              >
                                {x}
                              </button>
                            ))}
                          </div>
                        </div>

                        <label className={`kc-field ${err.message ? 'err' : ''}`}>
                          <span>
                            Message <small>{f.message.length}/400</small>
                          </span>
                          <textarea rows="3" maxLength={400} value={f.message} onChange={set('message')} />
                          {err.message && <em>{err.message}</em>}
                        </label>

                        <button type="submit" className="kc-send" disabled={busy}>
                          <span>{busy ? 'Sending…' : 'Send letter'}</span>
                          <i aria-hidden="true">→</i>
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* front pocket: the V-shaped front of the envelope */}
                <svg className="kc-front" viewBox="0 0 440 264" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="kc-gf" x1="0" y1="0" x2="0.35" y2="1">
                      <stop offset="0" stopColor="#2a2a26" />
                      <stop offset=".6" stopColor="#151513" />
                      <stop offset="1" stopColor="#0c0c0a" />
                    </linearGradient>
                    <linearGradient id="kc-rim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#c8ff2e" stopOpacity="0" />
                      <stop offset="1" stopColor="#c8ff2e" stopOpacity=".34" />
                    </linearGradient>
                    <linearGradient id="kc-gold" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stopColor="#e6c36a" stopOpacity=".95" />
                      <stop offset=".5" stopColor="#b88a35" stopOpacity=".7" />
                      <stop offset="1" stopColor="#e6c36a" stopOpacity=".9" />
                    </linearGradient>
                  </defs>
                  <path d="M0 0 L220 146 L440 0 L440 264 L0 264 Z" fill="url(#kc-gf)" />
                  <path d="M0 264 L205 136 M440 264 L235 136" fill="none" stroke="#ffffff22" strokeWidth="1.2" />
                  <path d="M0 0 L220 146 L440 0" fill="none" stroke="url(#kc-gold)" strokeWidth="1.5" />
                  <rect x="0" y="200" width="440" height="64" fill="url(#kc-rim)" />
                  <rect x="0.6" y="0.6" width="438.8" height="262.8" fill="none" stroke="#ffffff1a" strokeWidth="1.2" />
                </svg>

                {/* flap with wax seal */}
                <div className="kc-flap">
                  <svg className="kc-flap-out" viewBox="0 0 440 146" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="kc-gp" x1="0" y1="0" x2="0.4" y2="1">
                        <stop offset="0" stopColor="#1b1b18" />
                        <stop offset="1" stopColor="#34332d" />
                      </linearGradient>
                    </defs>
                    <path d="M0 0 H440 L220 146 Z" fill="url(#kc-gp)" />
                    <path d="M0 0 L220 146 L440 0" fill="none" stroke="url(#kc-gold)" strokeWidth="1.6" />
                    <path d="M0 0 H440" fill="none" stroke="#ffffff1f" strokeWidth="1.2" />
                  </svg>
                  <svg className="kc-flap-in" viewBox="0 0 440 146" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 0 H440 L220 146 Z" fill="#b4e81a" />
                    <path d="M0 0 H440 L220 146 Z" fill="none" stroke="#12121226" strokeWidth="1.2" />
                  </svg>
                  <span className="kc-seal" aria-hidden="true">
                    <svg viewBox="0 0 100 100">
                      <defs>
                        <radialGradient id="kcs-g" cx=".36" cy=".3" r=".85">
                          <stop offset="0" stopColor="#ecff82" />
                          <stop offset=".45" stopColor="#c6f01f" />
                          <stop offset="1" stopColor="#7fa300" />
                        </radialGradient>
                      </defs>
                      <path d={SEAL} fill="url(#kcs-g)" />
                      <circle cx="50" cy="50" r="35" fill="none" stroke="#6b9100" strokeOpacity=".55" strokeWidth="2.2" />
                      <circle cx="49.2" cy="49.2" r="35" fill="none" stroke="#f4ffb8" strokeOpacity=".6" strokeWidth="1" />
                      <text
                        x="50"
                        y="63"
                        textAnchor="middle"
                        fontFamily="'Archivo Black', Arial, sans-serif"
                        fontSize="38"
                        fontStyle="italic"
                        fill="#8fb305"
                        stroke="#f3ffa6"
                        strokeOpacity=".75"
                        strokeWidth=".9"
                      >
                        FC
                      </text>
                    </svg>
                  </span>
                </div>

                {!open && <button type="button" className="kc-hit" onClick={openIt} aria-label="Open the envelope" />}
              </div>
              <div className="kc-shadow" aria-hidden="true" />
            </div>

            {/* front layer: front half of the ring, spheres, sneaker, sunglasses */}
            <svg className="kc-layer kc-fore kc-fade" viewBox="0 0 872 841" aria-hidden="true">
              <defs>
                <radialGradient id="kcg-lime" cx=".35" cy=".3" r=".75">
                  <stop offset="0" stopColor="#f7ffbc" />
                  <stop offset=".35" stopColor="#cdf23a" />
                  <stop offset=".75" stopColor="#8fb800" />
                  <stop offset="1" stopColor="#506d00" />
                </radialGradient>
                <radialGradient id="kcg-silver" cx=".35" cy=".3" r=".75">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset=".4" stopColor="#d6d6d2" />
                  <stop offset=".8" stopColor="#8c8c88" />
                  <stop offset="1" stopColor="#5e5e5a" />
                </radialGradient>
                <radialGradient id="kcg-bead" cx=".35" cy=".3" r=".8">
                  <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
                  <stop offset=".5" stopColor="#f0ffc8" stopOpacity=".4" />
                  <stop offset="1" stopColor="#bcd878" stopOpacity=".55" />
                </radialGradient>
                <linearGradient id="kcg-lens" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#403f3a" />
                  <stop offset="1" stopColor="#0c0c0a" />
                </linearGradient>
              </defs>

              {/* ring: the half in front of the envelope */}
              <g transform={`rotate(${RING.rot} ${RING.cx} ${RING.cy})`}>
                <ellipse cx={RING.cx} cy={RING.cy} rx={RING.rx} ry={RING.ry} fill="none" stroke="#c8ff2e" strokeWidth="16" opacity=".32" filter="url(#kcg-blur)" clipPath="url(#kcg-dn)" />
                <ellipse cx={RING.cx} cy={RING.cy} rx={RING.rx} ry={RING.ry} fill="none" stroke="url(#kcg-ring)" strokeWidth="6.5" strokeOpacity=".92" clipPath="url(#kcg-dn)" />
                <ellipse cx={RING.cx} cy={RING.cy} rx={RING.rx} ry={RING.ry} fill="none" stroke="#fff" strokeWidth="1.4" strokeOpacity=".9" clipPath="url(#kcg-dn)" />
              </g>

            </svg>
            <svg className="kc-layer kc-fore kc-fade" viewBox="0 0 872 841" aria-hidden="true">
              {/* spheres on the ring */}
              <g className="kc-fl" style={{ '--d': '-0.6s' }}>
                <circle cx={LX} cy={LY} r="20" fill="url(#kcg-lime)" />
                <ellipse cx={LX - 6} cy={LY - 8} rx="6" ry="3.4" fill="#fff" opacity=".75" transform={`rotate(-30 ${LX - 6} ${LY - 8})`} />
              </g>
              <g className="kc-fl" style={{ '--d': '-2.8s' }}>
                <circle cx={RX} cy={RY} r="21" fill="url(#kcg-lime)" />
                <ellipse cx={RX - 6} cy={RY - 8} rx="6.5" ry="3.6" fill="#fff" opacity=".75" transform={`rotate(-30 ${RX - 6} ${RY - 8})`} />
              </g>
              <g className="kc-fl" style={{ '--d': '-1.7s' }}>
                <circle cx={SX} cy={SY} r="17" fill="url(#kcg-silver)" />
                <ellipse cx={SX - 5} cy={SY - 7} rx="5" ry="2.8" fill="#fff" opacity=".8" transform={`rotate(-30 ${SX - 5} ${SY - 7})`} />
              </g>
              <g className="kc-fl" style={{ '--d': '-3.9s' }}>
                <circle cx={BX} cy={BY} r="18" fill="url(#kcg-bead)" stroke="#fff" strokeOpacity=".85" strokeWidth="1.4" />
                <ellipse cx={BX - 5} cy={BY - 7} rx="5.5" ry="3" fill="#fff" opacity=".9" transform={`rotate(-30 ${BX - 5} ${BY - 7})`} />
              </g>

              {/* sneaker */}
              <g transform="translate(14 482) rotate(10 85 60)">
                <g className="kc-fl" style={{ '--d': '-1.4s' }}>
                  <path d="M4 88 C4 100 14 108 30 109 L150 107 C163 106 166 96 164 88 Z" fill="#efefe8" stroke="#d3d1c4" strokeWidth="1.2" />
                  <path d="M6 96 C40 101 120 101 163 96" fill="none" stroke="#d9d7cb" strokeWidth="1.2" />
                  <path d="M6 88 C4 70 14 58 34 55 C52 53 62 46 72 36 L96 24 C104 20 110 22 114 28 L120 36 C132 46 150 52 160 62 C166 70 166 80 164 88 Z" fill="#ffffff" stroke="#dedbd0" strokeWidth="1.2" strokeLinejoin="round" />
                  <path d="M96 24 C104 18 118 18 126 25 L120 36 L110 30 Z" fill="#cdcbbf" />
                  <path d="M6 88 C4 72 12 62 28 58 L40 74 L36 88 Z" fill="#f2f1e9" />
                  <path d="M52 86 C76 83 102 70 134 52 C116 80 88 97 52 86 Z" fill="#c8ff2e" stroke="#a8d400" strokeWidth=".8" />
                  <path d="M76 38 L96 52 M84 34 L104 48 M92 30 L110 44" stroke="#dcd8c6" strokeWidth="2" strokeLinecap="round" />
                </g>
              </g>

              {/* sunglasses */}
              <g transform="translate(704 596) rotate(26)">
                <g className="kc-fl" style={{ '--d': '-3.1s' }}>
                  <path d="M-4 16 L-40 2" stroke="#141412" strokeWidth="5" strokeLinecap="round" />
                  <path d="M138 16 L172 0" stroke="#141412" strokeWidth="5" strokeLinecap="round" />
                  <path d="M62 22 C66 12 74 12 78 22" fill="none" stroke="#141412" strokeWidth="6" strokeLinecap="round" />
                  <rect x="-2" y="6" width="66" height="48" rx="20" fill="url(#kcg-lens)" stroke="#0e0e0c" strokeWidth="5" />
                  <rect x="76" y="6" width="66" height="48" rx="20" fill="url(#kcg-lens)" stroke="#0e0e0c" strokeWidth="5" />
                  <path d="M10 19 C16 13 28 13 34 17" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M88 19 C94 13 106 13 112 17" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              </g>

              <Sparkle x={525} y={196} s={0.9} d="0s" />
              <Sparkle x={12} y={306} s={0.8} d="-1.2s" />
              <Sparkle x={684} y={496} s={1} d="-2.1s" />
            </svg>
          </div>
        </div>

        <p className="kc-sr-only" aria-live="polite">
          {open ? 'The envelope is open. Write your message.' : ''}
        </p>
      </section>
    </div>
  )
}
