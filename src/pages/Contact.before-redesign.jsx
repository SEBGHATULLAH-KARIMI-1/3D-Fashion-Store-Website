import { useEffect, useRef, useState } from 'react'
import { useReveal } from '../lib/useReveal'
import Title3D from '../components/Title3D.jsx'
import Footer from '../components/Footer.jsx'

const TOPICS = ['Order', 'Sizing', 'Press', 'Other']
const EMAIL = 'hello@fancyclothes.example'

const FAQ = [
  ['How do the sizes fit?', 'Most pieces are cut boxy with a dropped shoulder. If you are between sizes, take the smaller one for a fitted look or the larger one for the intended oversized fit.'],
  ['Is this a real store?', 'No. Fancy Clothes is a front-end sample. Adding to the bag and checking out are demos, so nothing is charged and nothing ships.'],
  ['How does shipping work?', 'In a real store this is where delivery times and costs would go. Here it is placeholder text so you can see how the accordion unfolds.'],
  ['What is the returns policy?', 'Placeholder text again: a typical policy would give you a set number of days to return unworn items with the tags attached.'],
  ['Who made the 3D effects?', 'All of it is plain CSS 3D transforms and small animation loops written in React and JavaScript. No 3D library is used.'],
]

function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <div className="kc-faq-list">
      {FAQ.map(([q, a], i) => (
        <div key={q} className={`kc-faq-item ${open === i ? 'open' : ''}`} data-reveal style={{ '--d': i }}>
          <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
            <span className="kc-faq-n">0{i + 1}</span>
            <span className="kc-faq-q">{q}</span>
            <i aria-hidden="true" />
          </button>
          <div className="kc-faq-a">
            <div>
              <p>{a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Contact() {
  const ref = useReveal()
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
      const hl = L.offsetHeight || 1
      S.style.setProperty('--s0', Math.min(0.62, (H * 0.84) / hl).toFixed(3))
      S.style.setProperty('--rise', `${(-H * 0.62).toFixed(0)}px`)
      S.style.setProperty('--dock', `${(H * 0.08).toFixed(0)}px`)
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
    o.style.setProperty('--my', `${(x * 16).toFixed(2)}deg`)
    o.style.setProperty('--mx', `${(-y * 10).toFixed(2)}deg`)
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

  return (
    <div ref={ref} className="pg contact">
      <section className="kc-stage">
        <div className="kc-copy-col">
          <p className="eyebrow">Get in touch</p>
          <Title3D text="Say Hello" />
          <p className="lede">
            Questions about sizing, an order or a collaboration? Open the envelope and write us a few lines. (This is a
            demo, so nothing leaves your browser.)
          </p>

          <ul className="kc-info">
            <li>
              <span className="eyebrow">Email</span>
              <b>{EMAIL}</b>
              <button type="button" className="kc-copy" onClick={copy}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </li>
            <li>
              <span className="eyebrow">Studio</span>
              <b>Unit 12, Sample Street</b>
            </li>
            <li>
              <span className="eyebrow">Hours</span>
              <b>Mon – Fri, 10:00 – 18:00</b>
            </li>
          </ul>

          {!open && (
            <button type="button" className="kc-cta" onClick={openIt}>
              <span>Open the envelope</span>
              <i aria-hidden="true">→</i>
            </button>
          )}
        </div>

        <div ref={sceneRef} className={`kc-scene ${open ? 'open' : ''}`} onPointerMove={onMove} onPointerLeave={onLeave}>
          <div ref={objRef} className="kc-obj">
            <div ref={envRef} className="kc-env">
              {/* inside of the envelope */}
              <div className="kc-lining" />

              {/* the letter = the form */}
              <div ref={letterRef} className="kc-letter">
                <div className="kc-rules" aria-hidden="true" />
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
              <svg className="kc-front" viewBox="0 0 440 290" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="kc-gf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#262622" />
                    <stop offset="1" stopColor="#10100e" />
                  </linearGradient>
                </defs>
                <path d="M0 0 L220 160 L440 0 L440 290 L0 290 Z" fill="url(#kc-gf)" />
                <path d="M0 290 L205 150 M440 290 L235 150 M0 0 L220 160 L440 0" fill="none" stroke="#ffffff1c" strokeWidth="1.2" />
                <rect x="0.6" y="0.6" width="438.8" height="288.8" fill="none" stroke="#ffffff14" strokeWidth="1.2" />
              </svg>

              {/* flap with wax seal */}
              <div className="kc-flap">
                <svg className="kc-flap-out" viewBox="0 0 440 160" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="kc-gp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#1c1c19" />
                      <stop offset="1" stopColor="#2a2a25" />
                    </linearGradient>
                  </defs>
                  <path d="M0 0 H440 L220 160 Z" fill="url(#kc-gp)" />
                  <path d="M0 0 H440 L220 160 Z" fill="none" stroke="#ffffff1f" strokeWidth="1.2" />
                </svg>
                <svg className="kc-flap-in" viewBox="0 0 440 160" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 0 H440 L220 160 Z" fill="#b4e81a" />
                  <path d="M0 0 H440 L220 160 Z" fill="none" stroke="#12121226" strokeWidth="1.2" />
                </svg>
                <span className="kc-seal" aria-hidden="true">
                  FC
                </span>
              </div>

              {!open && (
                <button type="button" className="kc-hit" onClick={openIt} aria-label="Open the envelope" />
              )}
            </div>
            <div className="kc-shadow" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="kc-faq">
        <div className="sec-head" data-reveal>
          <p className="eyebrow">FAQ</p>
          <h2>Quick answers.</h2>
        </div>
        <Faq />
      </section>

      <Footer />
    </div>
  )
}
