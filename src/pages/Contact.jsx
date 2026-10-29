import { useState } from 'react'
import { useReveal } from '../lib/useReveal'
import { tilt } from '../lib/tilt'
import Title3D from '../components/Title3D.jsx'
import Footer from '../components/Footer.jsx'

const TOPICS = ['Order', 'Sizing', 'Press', 'Other']

const FAQ = [
  ['How do the sizes fit?', 'Most pieces are cut boxy with a dropped shoulder. If you are between sizes, take the smaller one for a fitted look or the larger one for the intended oversized fit.'],
  ['Is this a real store?', 'No. Fancy Clothes is a front-end sample. Adding to the bag and checking out are demos, so nothing is charged and nothing ships.'],
  ['How does shipping work?', 'In a real store this is where delivery times and costs would go. Here it is placeholder text so you can see how the accordion unfolds.'],
  ['What is the returns policy?', 'Placeholder text again: a typical policy would give you a set number of days to return unworn items with the tags attached.'],
  ['Who made the 3D effects?', 'All of it is plain CSS 3D transforms and small animation loops written in React and JavaScript. No 3D library is used.'],
]

const INFO = [
  ['Email', 'hello@fancyclothes.example'],
  ['Studio', 'Unit 12, Sample Street'],
  ['Hours', 'Mon – Fri, 10:00 – 18:00'],
]

const t = tilt(12)

export default function Contact() {
  const ref = useReveal()
  const [f, setF] = useState({ name: '', email: '', topic: 'Order', message: '' })
  const [err, setErr] = useState({})
  const [sent, setSent] = useState(false)
  const [open, setOpen] = useState(0)

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    const er = {}
    if (!f.name.trim()) er.name = 'Please add your name'
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Enter a valid email'
    if (f.message.trim().length < 5) er.message = 'Write a few words'
    setErr(er)
    if (Object.keys(er).length === 0) setSent(true)
  }

  const reset = () => {
    setF({ name: '', email: '', topic: 'Order', message: '' })
    setErr({})
    setSent(false)
  }

  return (
    <div ref={ref} className="pg contact">
      <header className="pg-hero">
        <p className="eyebrow">Get in touch</p>
        <Title3D text="Say Hello" />
        <p className="lede">Questions about sizing, orders or press? The form below flips over when it is sent (it is a demo, so nothing leaves your browser).</p>
      </header>

      <section className="contact-grid">
        <div className="info-tiles">
          {INFO.map(([k, v], i) => (
            <div key={k} className="tile" data-reveal="left" style={{ '--d': i }} {...t}>
              <div className="tile-in">
                <span className="eyebrow">{k}</span>
                <b>{v}</b>
              </div>
            </div>
          ))}
        </div>

        <div className={`flip ${sent ? 'sent' : ''}`} data-reveal="right">
          <div className="flip-inner">
            <form className="flip-face flip-front" onSubmit={submit} noValidate>
              <h2>Send a message</h2>

              <label className={`field ${err.name ? 'err' : ''}`}>
                <span>Name</span>
                <input value={f.name} onChange={set('name')} autoComplete="name" />
                {err.name && <em>{err.name}</em>}
              </label>

              <label className={`field ${err.email ? 'err' : ''}`}>
                <span>Email</span>
                <input value={f.email} onChange={set('email')} type="email" autoComplete="email" />
                {err.email && <em>{err.email}</em>}
              </label>

              <div className="field">
                <span>Topic</span>
                <div className="chips" role="group" aria-label="Topic">
                  {TOPICS.map((x) => (
                    <button key={x} type="button" className={f.topic === x ? 'on' : ''} onClick={() => setF((s) => ({ ...s, topic: x }))}>
                      {x}
                    </button>
                  ))}
                </div>
              </div>

              <label className={`field ${err.message ? 'err' : ''}`}>
                <span>Message</span>
                <textarea rows="4" value={f.message} onChange={set('message')} />
                {err.message && <em>{err.message}</em>}
              </label>

              <button type="submit" className="send">
                <span>Send message</span>
              </button>
            </form>

            <div className="flip-face flip-back" aria-hidden={!sent}>
              <b>Thanks, {f.name.split(' ')[0] || 'friend'}.</b>
              <p>Your message about “{f.topic.toLowerCase()}” would be on its way. This is a demo, so nothing was actually sent.</p>
              <button type="button" className="send" onClick={reset} tabIndex={sent ? 0 : -1}>
                <span>Write another</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="faq">
        <div className="sec-head" data-reveal>
          <p className="eyebrow">FAQ</p>
          <h2>Quick answers.</h2>
        </div>
        <div className="faq-list">
          {FAQ.map(([q, a], i) => (
            <div key={q} className={`faq-item ${open === i ? 'open' : ''}`} data-reveal style={{ '--d': i }}>
              <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                <span>{q}</span>
                <i aria-hidden="true" />
              </button>
              <div className="faq-a">
                <div>
                  <p>{a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  )
}
