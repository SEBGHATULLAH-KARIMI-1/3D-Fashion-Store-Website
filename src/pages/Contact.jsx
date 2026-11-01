import { useEffect, useRef, useState } from 'react'
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

/* ================================================================
   Scroll choreography
   0 ──────── 0.50 ── 0.62 ── 0.76 ───────── 1
     walk in     reach   raise     on the call
   ================================================================ */
const T_WALK = 0.5
const T_REACH = 0.62
const T_RAISE = 0.76

const PHASES = [
  ['walk', 'Walk'],
  ['reach', 'Reach'],
  ['raise', 'Pick up'],
  ['call', 'Talk'],
]
const PHASE_TEXT = {
  walk: 'Incoming call · someone is on the way',
  reach: 'Reaching for the phone',
  raise: 'Picked up',
  call: 'Connected · say hello',
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, k) => a + (b - a) * k
const sm = (k) => k * k * (3 - 2 * k)
const seg = (p, a, b) => clamp((p - a) / (b - a))
const RAD = Math.PI / 180
const DEG = 180 / Math.PI
const wrap = (a) => ((a + 540) % 360) - 180

const phaseOf = (p) => (p < T_WALK ? 'walk' : p < T_REACH ? 'reach' : p < T_RAISE ? 'raise' : 'call')

/* ---------- geometry of the right arm (screen right) in rig px ----------
   Feet are at y = 0, up is negative. The arm is solved with two-bone IK
   in the screen plane, so the hand really lands on the handset. */
const PED_X = 134 // phone table, to the right of the walker
const SH = [50, -228] // right shoulder
const UA = 64 // upper arm length
const FA = 64 // elbow -> centre of the fist
const REST = [SH[0] + 8, SH[1] + 116] // hand hanging down
const CRADLE = [PED_X, -190] // handset lying on the phone
const EAR = [66, -262] // handset at the ear
const TILT = 60 // upper arm swings toward the camera by this much at the ear
const JACK = [PED_X - 52, -116] // where the cord leaves the phone
const MOUTH = [-7.6, 40.8] // cord end on the handset (handset-local)

// U = upper arm length as seen from the front (it shortens when it swings toward the camera)
function ik(T, U) {
  const dx = T[0] - SH[0]
  const dy = T[1] - SH[1]
  const d = clamp(Math.hypot(dx, dy), Math.abs(U - FA) + 1, U + FA - 0.5)
  const base = Math.atan2(dy, dx)
  const a = Math.acos(clamp((U * U + d * d - FA * FA) / (2 * U * d), -1, 1))
  let best = null
  for (const phi of [base - a, base + a]) {
    const ex = U * Math.cos(phi)
    const ey = U * Math.sin(phi)
    const score = ey + 0.6 * ex // prefer the elbow low and to the outside
    if (!best || score > best.score) best = { phi, score, ex, ey }
  }
  const phiF = Math.atan2(dy - best.ey, dx - best.ex)
  return { th: wrap(best.phi * DEG - 90), ga: wrap((phiF - best.phi) * DEG) }
}

// coiled phone cord: a sagging curve with a helix wound around it
function cordPath(J, K) {
  const dist = Math.hypot(K[0] - J[0], K[1] - J[1])
  const C = [(J[0] + K[0]) / 2, Math.min(-6, Math.max(J[1], K[1]) + 36 + dist * 0.18)]
  const N = 72
  let d = ''
  for (let i = 0; i <= N; i++) {
    const s = i / N
    const u = 1 - s
    let x = u * u * J[0] + 2 * u * s * C[0] + s * s * K[0]
    let y = u * u * J[1] + 2 * u * s * C[1] + s * s * K[1]
    const k = s * 16 * Math.PI * 2
    x += Math.cos(k) * 5
    y = Math.min(-1, y + Math.sin(k) * 3.4)
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return d
}

// where the sticky stage sticks, measured from the top of the scroll container
// (sticky offsets start at the container's padding edge, so padding counts)
function stickTop(page, stage) {
  const pad = parseFloat(getComputedStyle(page).paddingTop) || 0
  return pad + (parseFloat(getComputedStyle(stage).top) || 0)
}

// Everything that moves is a number written to a CSS variable.
// "l" = left side of the screen, "r" = right side of the screen.
function poseFor(p) {
  const w = seg(p, 0, T_WALK)
  const we = 1 - Math.pow(1 - w, 1.7) // slows down on arrival
  const phi = we * 11 * Math.PI * 2 // 11 strides
  const amp = 1 - sm(seg(w, 0.84, 1)) // stride fades out at the end
  const A = 30 * amp
  const s = Math.sin(phi)
  const c = Math.cos(phi)
  const r = sm(seg(p, T_WALK, T_REACH)) // reaching for the phone
  const q = sm(seg(p, T_REACH, T_RAISE)) // phone up to the ear

  // right hand target: hanging -> handset on the phone -> ear
  const T = [lerp(lerp(REST[0], CRADLE[0], r), EAR[0], q), lerp(lerp(REST[1], CRADLE[1], r), EAR[1], q)]
  const tau = TILT * q
  const arm = ik(T, UA * Math.cos(tau * RAD))

  // handset position / angle / cord
  const H = [lerp(CRADLE[0], EAR[0], q), lerp(CRADLE[1], EAR[1], q)]
  const ha = lerp(90, -6, q)
  const rh = ha * RAD
  const K = [
    H[0] + MOUTH[0] * Math.cos(rh) - MOUTH[1] * Math.sin(rh),
    H[1] + MOUTH[0] * Math.sin(rh) + MOUTH[1] * Math.cos(rh),
  ]

  const rig = {
    '--fx': lerp(-40, 0, we),
    '--fz': lerp(-1900, -140, we),
    '--bob': -amp * Math.abs(s) * 5,
    '--ty': amp * s * 5,
    '--tz': amp * c * 1.4,
    '--lt': -A * s,
    '--rt': A * s,
    '--lk': -amp * 46 * Math.max(0, -c),
    '--rk': -amp * 46 * Math.max(0, c),
    '--la1': lerp(A * 0.9 * s, 0, r),
    '--la2': lerp(4, 6, r),
    '--le': 3,
    '--lex': lerp(12 + amp * 10 * Math.max(0, c), 8, r),
    '--ra1': lerp(-A * 0.9 * s, 0, r) + tau,
    '--ra2': arm.th,
    '--re': arm.ga,
    '--rex': lerp(12 + amp * 10 * Math.max(0, -c), 0, r) - tau,
    '--hz2': UA * Math.sin(tau * RAD) + 4,
    '--hy': 18 * sm(seg(p, T_WALK, 0.57)) * (1 - sm(seg(p, T_REACH, 0.72))),
    '--hz': 6 * q,
    '--hx': H[0],
    '--hy2': H[1],
    '--ha': ha,
  }
  const stage = {
    '--p': p,
    '--pan': sm(seg(p, T_REACH, 0.8)),
    '--dolly': 60 * sm(seg(p, 0, T_WALK)),
  }
  return { rig, stage, cord: cordPath(JACK, K) }
}

/* ================================================================
   Building blocks
   Bx = a 3D box (props, table) · Pv = a pivot/joint · Sv = a flat SVG part
   The character is flat cartoon parts hung on 3D pivots. Each part is
   stacked a few times with slightly darker copies behind it, which
   gives it thickness when the camera tilts.
   ================================================================ */
const px = (n) => `${n}px`

function Bx({ w, h, d, c, x = 0, y = 0, z = 0, cls = '' }) {
  return (
    <div
      className={`bx ${cls}`}
      style={{ '--w': px(w), '--h': px(h), '--d': px(d), '--c': c, '--bx': px(x), '--by': px(y), '--bz': px(z) }}
    >
      <i className="f" />
      <i className="b" />
      <i className="l" />
      <i className="r" />
      <i className="t" />
      <i className="u" />
    </div>
  )
}

function Pv({ x = 0, y = 0, z = 0, rx = '0deg', ry = '0deg', rz = '0deg', cls = '', children }) {
  return (
    <div className={`pv ${cls}`} style={{ '--x': px(x), '--y': px(y), '--z': px(z), '--rx': rx, '--ry': ry, '--rz': rz }}>
      {children}
    </div>
  )
}

function Sv({ w, h, vb, x = 0, y = 0, z = 0, d = 0, cls = '', children }) {
  const common = { width: w, height: h, viewBox: vb || `0 0 ${w} ${h}`, 'aria-hidden': 'true' }
  const at = (zz) => ({ left: x - w / 2, top: y, transform: `translateZ(${zz}px)` })
  return (
    <>
      {Array.from({ length: d }, (_, i) => (
        <svg key={i} className={`sv sl ${cls}`} {...common} style={at(z - (d - i) * 2)}>
          {children}
        </svg>
      ))}
      <svg className={`sv ${cls}`} {...common} style={at(z)}>
        {children}
      </svg>
    </>
  )
}

function Defs() {
  return (
    <svg className="defs-svg" aria-hidden="true">
      <defs>
        <linearGradient id="g-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fad0ae" />
          <stop offset="1" stopColor="#e6a077" />
        </linearGradient>
        <linearGradient id="g-skin-h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d98f68" />
          <stop offset="0.35" stopColor="#f7c7a4" />
          <stop offset="0.7" stopColor="#f1b690" />
          <stop offset="1" stopColor="#d58b64" />
        </linearGradient>
        <linearGradient id="g-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#58402f" />
          <stop offset="1" stopColor="#2a1c13" />
        </linearGradient>
        <linearGradient id="g-jk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d3d7e2" />
          <stop offset="0.55" stopColor="#b3b9cb" />
          <stop offset="1" stopColor="#98a0b8" />
        </linearGradient>
        <linearGradient id="g-jkd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#929bb7" />
          <stop offset="1" stopColor="#6f799a" />
        </linearGradient>
        <linearGradient id="g-tee" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#faf8f6" />
          <stop offset="1" stopColor="#d9d3d0" />
        </linearGradient>
        <linearGradient id="g-pants" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5d5d67" />
          <stop offset="0.5" stopColor="#4a4a53" />
          <stop offset="1" stopColor="#35353d" />
        </linearGradient>
        <linearGradient id="g-shoe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c7695a" />
          <stop offset="1" stopColor="#7d3328" />
        </linearGradient>
        <linearGradient id="g-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3f5f8" />
          <stop offset="0.5" stopColor="#b3b8c0" />
          <stop offset="1" stopColor="#7d838c" />
        </linearGradient>
        <linearGradient id="g-down" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id="g-up" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="g-gloss" cx="0.35" cy="0.25" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
}

/* ---------- character ---------- */
function Head() {
  return (
    <Sv w={96} h={114} vb="0 -10 96 114" y={-106} d={2}>
      <ellipse cx="8" cy="58" rx="7" ry="11" fill="url(#g-skin-h)" />
      <ellipse cx="88" cy="58" rx="7" ry="11" fill="url(#g-skin-h)" />
      <ellipse cx="9" cy="58" rx="3" ry="6" fill="#d98f68" opacity="0.7" />
      <ellipse cx="87" cy="58" rx="3" ry="6" fill="#d98f68" opacity="0.7" />
      <path
        d="M12 54 C12 26 28 14 48 14 C68 14 84 26 84 54 C84 80 68 96 48 96 C28 96 12 80 12 54 Z"
        fill="url(#g-skin)"
      />
      <path
        d="M12 54 C12 26 28 14 48 14 C68 14 84 26 84 54 C84 80 68 96 48 96 C28 96 12 80 12 54 Z"
        fill="url(#g-down)"
      />
      <ellipse cx="48" cy="94" rx="26" ry="7" fill="#c97c55" opacity="0.28" />
      <circle cx="25" cy="75" r="8" fill="#ff8f7a" opacity="0.3" />
      <circle cx="71" cy="75" r="8" fill="#ff8f7a" opacity="0.3" />
      <path d="M14 36 C30 40 46 32 60 36 C72 38 80 36 84 34 L84 20 L14 20 Z" fill="#000" opacity="0.1" />
      <g className="blink">
        <ellipse cx="33" cy="58" rx="9.5" ry="10.5" fill="#fff" />
        <ellipse cx="63" cy="58" rx="9.5" ry="10.5" fill="#fff" />
        <circle cx="34" cy="59" r="6.8" fill="#6a4128" />
        <circle cx="62" cy="59" r="6.8" fill="#6a4128" />
        <circle cx="34" cy="59" r="5" fill="#4b2d1b" />
        <circle cx="62" cy="59" r="5" fill="#4b2d1b" />
        <circle cx="34" cy="59" r="3" fill="#120a06" />
        <circle cx="62" cy="59" r="3" fill="#120a06" />
        <circle cx="31.4" cy="55.4" r="2.5" fill="#fff" />
        <circle cx="59.4" cy="55.4" r="2.5" fill="#fff" />
        <circle cx="37" cy="63" r="1.2" fill="#fff" opacity="0.7" />
        <circle cx="65" cy="63" r="1.2" fill="#fff" opacity="0.7" />
        <path d="M23 52 Q33 46 43 51" fill="none" stroke="#2a1c13" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M53 51 Q63 46 73 52" fill="none" stroke="#2a1c13" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <path d="M22 43 Q33 35 44 41" fill="none" stroke="#33231a" strokeWidth="3.8" strokeLinecap="round" />
      <path d="M52 41 Q63 35 74 43" fill="none" stroke="#33231a" strokeWidth="3.8" strokeLinecap="round" />
      <path d="M48 64 Q54 74 47 75" fill="none" stroke="#d58a66" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M44 76 Q48 78 52 76" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      <path className="smile" d="M37 82 Q48 91 59 82" fill="none" stroke="#8c3d2a" strokeWidth="3" strokeLinecap="round" />
      <path className="smile" d="M43 86 Q48 88.5 53 86" fill="none" stroke="#c9705a" strokeWidth="2" strokeLinecap="round" />
      <ellipse className="talk" cx="48" cy="84" rx="7" ry="5" fill="#7a2c20" />
      <path
        d="M9 54 C2 30 10 8 32 3 C36 -6 54 -8 60 2 C80 0 94 20 87 52 C84 44 80 36 72 30 C62 36 48 28 40 24 C30 30 20 30 15 34 C11 40 10 46 9 54 Z"
        fill="url(#g-hair)"
      />
      <path d="M30 4 L36 -10 L46 2 L56 -12 L64 2 L78 -6 L76 12 Z" fill="url(#g-hair)" />
      <path
        d="M38 0 L40 -7 M58 -2 L60 -8 M22 12 Q30 6 40 6 M66 8 Q74 6 80 14 M44 10 Q52 4 62 8"
        fill="none"
        stroke="#7a5a42"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.8"
      />
    </Sv>
  )
}

function Torso() {
  return (
    <Sv w={112} h={104} y={-104} d={3}>
      <path d="M26 4 Q56 20 86 4 L90 104 L22 104 Z" fill="url(#g-tee)" />
      <path d="M26 4 Q56 20 86 4 L90 104 L22 104 Z" fill="url(#g-down)" opacity="0.8" />
      <path d="M38 3 Q56 22 74 3" fill="none" stroke="#cfc7c4" strokeWidth="3" />
      <path d="M42 36 Q56 40 70 36 M44 62 Q56 66 68 62" fill="none" stroke="#c9c1be" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
      <path d="M18 10 Q56 -8 94 10 L90 28 Q56 12 22 28 Z" fill="url(#g-jkd)" />
      <path d="M16 12 Q22 6 34 8 L40 14 L34 104 L6 104 Q2 56 8 24 Q10 14 16 12 Z" fill="url(#g-jk)" />
      <path d="M96 12 Q90 6 78 8 L72 14 L78 104 L106 104 Q110 56 104 24 Q102 14 96 12 Z" fill="url(#g-jk)" />
      <path d="M16 12 Q22 6 34 8 L40 14 L34 40 L10 40 Q8 20 16 12 Z" fill="url(#g-gloss)" />
      <path d="M96 12 Q90 6 78 8 L72 14 L78 40 L102 40 Q104 20 96 12 Z" fill="url(#g-gloss)" />
      <path d="M38 14 L33 104" stroke="#7d86a6" strokeWidth="4" />
      <path d="M74 14 L79 104" stroke="#7d86a6" strokeWidth="4" />
      <path d="M20 56 Q25 66 21 82 M92 56 Q87 66 91 82 M14 70 Q18 78 15 92" fill="none" stroke="#7d86a6" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      {[40, 62, 84].map((y) => (
        <g key={y}>
          <circle cx={35.5 - (y - 40) * 0.04} cy={y} r="2.4" fill="#e2e6f0" />
          <circle cx={35.5 - (y - 40) * 0.04} cy={y} r="2.4" fill="none" stroke="#8d95b0" strokeWidth="0.8" />
          <circle cx={76.5 + (y - 40) * 0.04} cy={y} r="2.4" fill="#e2e6f0" />
          <circle cx={76.5 + (y - 40) * 0.04} cy={y} r="2.4" fill="none" stroke="#8d95b0" strokeWidth="0.8" />
        </g>
      ))}
      <rect x="84" y="32" width="14" height="16" rx="3" fill="none" stroke="#8189a6" strokeWidth="1.6" />
      <path d="M84 36 H98" stroke="#8189a6" strokeWidth="1.2" />
      <rect x="5" y="98" width="102" height="6" rx="3" fill="#7d86a6" opacity="0.45" />
    </Sv>
  )
}

function Arm({ s }) {
  const x = s === 'l' ? -50 : 50
  return (
    <Pv x={x} y={-88} z={8} cls={`arm ${s}`} rx={`calc(var(--${s}a1) * 1deg)`} rz={`calc(var(--${s}a2) * 1deg)`}>
      <div className="wv">
        <div className="wv2">
          <Sv w={36} h={70} y={-4} d={2}>
            <rect x="3" y="0" width="30" height="66" rx="15" fill="url(#g-jk)" />
            <rect x="3" y="0" width="30" height="66" rx="15" fill="url(#g-gloss)" />
            <path d="M9 14 Q12 26 9 38" fill="none" stroke="#7d86a6" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
            <rect x="1" y="46" width="34" height="18" rx="8" fill="#a8afc4" />
            <rect x="1" y="46" width="34" height="18" rx="8" fill="url(#g-down)" />
            <path d="M3 52 H33" stroke="#7d86a6" strokeWidth="2" />
          </Sv>
          <Pv y={64} rx={`calc(var(--${s}ex) * 1deg)`}>
            <Pv rz={`calc(var(--${s}e) * 1deg)`}>
              <Sv w={28} h={76} d={2}>
                <rect x="3" y="0" width="22" height="60" rx="11" fill="url(#g-skin-h)" />
                <path d="M2 54 Q2 75 14 75 Q26 75 26 54 Q26 49 14 49 Q2 49 2 54 Z" fill="url(#g-skin-h)" />
                <path d="M9 64 V72 M14 66 V74 M19 64 V72" stroke="#c98259" strokeWidth="1.4" strokeLinecap="round" />
                <ellipse cx="24" cy="60" rx="4" ry="7" fill="#eba97f" />
              </Sv>
            </Pv>
          </Pv>
        </div>
      </div>
    </Pv>
  )
}

function Leg({ s }) {
  const x = s === 'l' ? -22 : 22
  return (
    <Pv x={x} y={-144} rx={`calc(var(--${s}t) * 1deg)`} rz={s === 'l' ? '1.5deg' : '-1.5deg'}>
      <Sv w={48} h={74} d={2}>
        <path d="M5 8 Q5 0 14 0 H34 Q43 0 43 8 L40 74 H8 Z" fill="url(#g-pants)" />
        <path d="M24 8 V68" stroke="#2c2c33" strokeOpacity="0.25" strokeWidth="2" />
        <path d="M12 40 Q20 44 14 52 M36 36 Q30 42 35 50" fill="none" stroke="#2c2c33" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
      </Sv>
      <Pv y={72} rx={`calc(var(--${s}k) * 1deg)`}>
        <Sv w={44} h={54} d={2}>
          <path d="M7 0 H37 L39 46 Q39 54 31 54 H13 Q5 54 5 46 Z" fill="url(#g-pants)" />
          <rect x="5" y="40" width="34" height="9" rx="4" fill="#2f2f36" opacity="0.5" />
        </Sv>
        <Pv y={44} z={5}>
          <Sv w={60} h={28} d={2}>
            <path d="M6 7 Q6 0 30 0 Q54 0 54 7 L58 20 Q60 28 50 28 H10 Q0 28 2 20 Z" fill="url(#g-shoe)" />
            <path d="M6 7 Q6 0 30 0 Q54 0 54 7 L58 20 Q60 28 50 28 H10 Q0 28 2 20 Z" fill="url(#g-gloss)" />
            <rect x="1" y="21" width="58" height="7" rx="3.5" fill="#f1ebe4" />
            <path d="M16 8 H44 M14 13 H46 M13 18 H47" stroke="#f4ece3" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M22 2 Q30 -3 38 2" fill="none" stroke="#e6ddd3" strokeWidth="3" strokeLinecap="round" />
          </Sv>
        </Pv>
      </Pv>
    </Pv>
  )
}

function Person() {
  return (
    <div className="actor">
      <div className="shadow" />
      <div className="body">
        <Leg s="l" />
        <Leg s="r" />
        <Sv w={88} h={30} y={-160} z={-2}>
          <rect x="0" y="0" width="88" height="30" rx="12" fill="url(#g-pants)" />
        </Sv>
        <Pv y={-140} ry="calc(var(--ty) * 1deg)" rz="calc(var(--tz) * 1deg)">
          <Sv w={30} h={18} y={-116} z={-1}>
            <rect x="0" y="0" width="30" height="18" rx="7" fill="#dd9670" />
            <rect x="0" y="0" width="30" height="18" rx="7" fill="url(#g-up)" />
          </Sv>
          <Torso />
          <Arm s="l" />
          <Arm s="r" />
          <Pv y={-106} z={2} ry="calc(var(--hy) * 1deg)" rz="calc(var(--hz) * 1deg)" cls="head">
            <Head />
          </Pv>
        </Pv>
      </div>
    </div>
  )
}

/* ---------- retro rotary phone ---------- */
function Base() {
  const holes = Array.from({ length: 10 }, (_, i) => {
    const a = ((35 + i * 29) * Math.PI) / 180
    return [60 + 34 * Math.cos(a), 44 + 19 * Math.sin(a)]
  })
  return (
    <Sv w={120} h={76} y={-181} d={3}>
      <rect x="22" y="0" width="12" height="14" rx="4" fill="#7d838c" />
      <rect x="86" y="0" width="12" height="14" rx="4" fill="#7d838c" />
      <path
        d="M8 76 Q2 76 6 62 L18 22 Q22 12 36 12 H84 Q98 12 102 22 L114 62 Q118 76 112 76 Z"
        fill="url(#g-metal)"
      />
      <path d="M8 76 Q2 76 6 62 L18 22 Q22 12 36 12 H84 Q98 12 102 22 L114 62 Q118 76 112 76 Z" fill="url(#g-down)" />
      <ellipse cx="60" cy="46" rx="42" ry="26" fill="#eaedf0" stroke="#9aa0a8" strokeWidth="2" />
      <ellipse cx="60" cy="46" rx="42" ry="26" fill="url(#g-gloss)" />
      {holes.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="5.5" ry="3.2" fill="#7f858d" />
      ))}
      <ellipse cx="60" cy="44" rx="14" ry="8" fill="#3b3e44" />
      <ellipse cx="60" cy="42" rx="11" ry="5.5" fill="#5a5e66" />
      <path d="M92 50 Q98 56 104 56" fill="none" stroke="#6b7078" strokeWidth="3" strokeLinecap="round" />
    </Sv>
  )
}

function Handset() {
  return (
    <Sv w={34} h={105} vb="0 0 40 124" x={-7.6} y={-52.5} d={2}>
      <path d="M20 24 Q39 62 20 100" fill="none" stroke="url(#g-metal)" strokeWidth="17" strokeLinecap="round" />
      <path d="M17 28 Q33 62 17 96" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="20" cy="14" rx="19" ry="13" fill="url(#g-metal)" />
      <ellipse cx="20" cy="14" rx="12" ry="8" fill="#8d939b" />
      <ellipse cx="20" cy="110" rx="19" ry="13" fill="url(#g-metal)" />
      <ellipse cx="20" cy="110" rx="12" ry="8" fill="#8d939b" />
      {[-5, 0, 5].map((dx) => (
        <g key={dx}>
          <circle cx={20 + dx} cy="14" r="1.4" fill="#4b5058" />
          <circle cx={20 + dx} cy="110" r="1.4" fill="#4b5058" />
        </g>
      ))}
    </Sv>
  )
}

function Pedestal() {
  return (
    <Pv x={PED_X} y={0} z={-140} cls="ped-grp">
      <div className="ped-glow" />
      <i className="wave" style={{ '--dl': '0s' }} />
      <i className="wave" style={{ '--dl': '0.7s' }} />
      <i className="wave" style={{ '--dl': '1.4s' }} />
      <Bx w={90} h={105} d={90} c="#e6e5e0" y={-105} cls="ped" />
      <Base />
    </Pv>
  )
}

const PROPS = [
  { t: 'ring', x: -520, y: -430, z: -900, s: 190, k: 1, d: 11 },
  { t: 'cube', x: 380, y: -540, z: -1200, s: 48, k: 2, d: 14, c: '#c8ff2e' },
  { t: 'ring', x: 660, y: -250, z: -1500, s: 270, k: 3, d: 16 },
  { t: 'cube', x: -720, y: -190, z: -1700, s: 66, k: 2, d: 18, c: '#e2e1dc' },
  { t: 'cube', x: -260, y: -610, z: -520, s: 30, k: 3, d: 10, c: '#c8ff2e' },
  { t: 'ring', x: 290, y: -650, z: -300, s: 110, k: 2, d: 9 },
  { t: 'cube', x: 560, y: -330, z: -300, s: 26, k: 1, d: 12, c: '#e2e1dc' },
]

/* ================================================================
   Page
   ================================================================ */
export default function Contact() {
  const ref = useReveal()
  const sceneRef = useRef(null)
  const stageRef = useRef(null)
  const rigRef = useRef(null)
  const barRef = useRef(null)
  const cordA = useRef(null)
  const cordB = useRef(null)

  const [f, setF] = useState({ name: '', email: '', topic: 'Order', message: '' })
  const [err, setErr] = useState({})
  const [sent, setSent] = useState(false)
  const [open, setOpen] = useState(0)
  const [phase, setPhase] = useState('walk')

  const live = phase === 'call'
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

  // scroll position of the tall section -> 0..1 -> pose of the character
  useEffect(() => {
    const root = sceneRef.current
    const stage = stageRef.current
    const rig = rigRef.current
    const bar = barRef.current
    const ca = cordA.current
    const cb = cordB.current
    const page = root && root.closest('.page')
    if (!root || !stage || !rig || !bar || !ca || !cb || !page) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let target = reduce ? 1 : 0
    let cur = target
    let raf = 0
    let ph = ''
    let head = 0

    const apply = (p) => {
      const { rig: rv, stage: sv, cord } = poseFor(p)
      for (const k in rv) rig.style.setProperty(k, rv[k].toFixed(3))
      for (const k in sv) stage.style.setProperty(k, sv[k].toFixed(4))
      ca.setAttribute('d', cord)
      cb.setAttribute('d', cord)
      bar.style.transform = `scaleX(${p.toFixed(3)})`
      const next = phaseOf(p)
      if (next !== ph) {
        ph = next
        setPhase(next)
      }
    }

    const tick = () => {
      raf = 0
      const d = target - cur
      cur = Math.abs(d) < 0.0004 ? target : cur + d * 0.14
      apply(cur)
      if (cur !== target) raf = requestAnimationFrame(tick)
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const read = () => {
      const s = root.getBoundingClientRect()
      const pr = page.getBoundingClientRect()
      const total = Math.max(1, s.height - stage.offsetHeight)
      target = clamp((pr.top + head - s.top) / total)
      kick()
    }
    const size = () => {
      const h = stage.clientHeight
      const w = stage.clientWidth
      head = stickTop(page, stage)
      stage.style.setProperty('--fs', clamp(Math.min(h / 500, w / 700), 0.7, 1.8).toFixed(3))
      if (!reduce) read()
    }

    size()
    apply(cur)
    if (reduce) return

    page.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', size)
    return () => {
      page.removeEventListener('scroll', read)
      window.removeEventListener('resize', size)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const skip = () => {
    const root = sceneRef.current
    const stage = stageRef.current
    const page = root && root.closest('.page')
    if (!page || !stage) return
    const s = root.getBoundingClientRect()
    const pr = page.getBoundingClientRect()
    const head = stickTop(page, stage)
    const total = s.height - stage.offsetHeight
    page.scrollTo({ top: page.scrollTop + (s.top - pr.top - head) + total * 0.86, behavior: 'smooth' })
  }

  return (
    <div ref={ref} className="pg contact">
      <header className="pg-hero">
        <p className="eyebrow">Get in touch</p>
        <Title3D text="Say Hello" />
        <p className="lede">
          Scroll down. Someone is walking over to answer the phone, and the message form drops in the moment they pick up.
          (It is a demo, so nothing leaves your browser.)
        </p>
      </header>

      <section ref={sceneRef} className="ct-scene" aria-label="Contact">
        <div ref={stageRef} className={`ct-stage ${sent ? 'sent' : ''}`} data-phase={phase}>
          <Defs />
          <div className="world">
            <div className="floor" />
            <div className="pool" />
            <div className="back-word" aria-hidden="true">
              HELLO
            </div>

            {PROPS.map((o, i) => (
              <div key={i} className="prop" style={{ '--px': o.x, '--py': o.y, '--pz': o.z, '--k': o.k }}>
                {o.t === 'ring' ? (
                  <div
                    className="p-ring"
                    style={{ width: o.s, height: o.s, margin: `${-o.s / 2}px 0 0 ${-o.s / 2}px`, animationDuration: `${o.d}s` }}
                  />
                ) : (
                  <div className="spin" style={{ animationDuration: `${o.d}s` }}>
                    <Bx w={o.s} h={o.s} d={o.s} c={o.c} y={-o.s / 2} />
                  </div>
                )}
              </div>
            ))}

            <div ref={rigRef} className="rig">
              <Pedestal />
              <Person />

              <Pv z={-136} cls="cord-layer">
                <svg className="cord" width="700" height="430" viewBox="-250 -380 700 430" style={{ left: -250, top: -380 }} aria-hidden="true">
                  <path ref={cordA} fill="none" stroke="#5f646c" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path ref={cordB} fill="none" stroke="#b9bec6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Pv>

              <Pv z={-132} cls="hs-layer">
                <div className="hs">
                  <div className="hs-shake">
                    <Handset />
                    <i className="flash" />
                  </div>
                </div>
              </Pv>
            </div>
          </div>

          <div className="ct-tag">
            <i className="ct-dot" />
            <span>{PHASE_TEXT[sent ? 'call' : phase]}</span>
          </div>

          <button type="button" className="ct-skip" onClick={skip} tabIndex={live ? -1 : 0}>
            Skip intro <span aria-hidden="true">→</span>
          </button>

          <div className="ct-hud" aria-hidden="true">
            <ol>
              {PHASES.map(([k, l], i) => (
                <li key={k} className={PHASES.findIndex(([x]) => x === phase) >= i ? 'on' : ''}>
                  <small>0{i + 1}</small> {l}
                </li>
              ))}
            </ol>
            <div className="ct-bar">
              <i ref={barRef} />
            </div>
          </div>

          <p className="ct-cue" aria-hidden="true">
            Scroll · watch who is coming
          </p>

          <div className={`ct-drop ${live ? 'live' : ''}`} aria-hidden={!live} inert={live ? undefined : ''}>
            <div className={`flip ${sent ? 'sent' : ''}`}>
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
                        <button
                          key={x}
                          type="button"
                          className={f.topic === x ? 'on' : ''}
                          onClick={() => setF((s) => ({ ...s, topic: x }))}
                        >
                          {x}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className={`field ${err.message ? 'err' : ''}`}>
                    <span>Message</span>
                    <textarea rows="3" value={f.message} onChange={set('message')} />
                    {err.message && <em>{err.message}</em>}
                  </label>

                  <button type="submit" className="send">
                    <span>Send message</span>
                  </button>
                </form>

                <div className="flip-face flip-back" aria-hidden={!sent}>
                  <b>Thanks, {f.name.split(' ')[0] || 'friend'}.</b>
                  <p>
                    Your message about “{f.topic.toLowerCase()}” would be on its way. This is a demo, so nothing was
                    actually sent.
                  </p>
                  <button type="button" className="send" onClick={reset} tabIndex={sent ? 0 : -1}>
                    <span>Write another</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="info-row">
        {INFO.map(([k, v], i) => (
          <div key={k} className="tile" data-reveal style={{ '--d': i }} {...t}>
            <div className="tile-in">
              <span className="eyebrow">{k}</span>
              <b>{v}</b>
            </div>
          </div>
        ))}
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
