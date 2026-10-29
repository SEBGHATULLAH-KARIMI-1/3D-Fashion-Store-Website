import { memo, useEffect, useRef, useState } from 'react'
import Footer from '../components/Footer.jsx'
import { useReveal } from '../lib/useReveal'

/* ================================================================
   About — "The Atelier, mapped"
   A scroll-driven camera flight over a 3D night-city map. Scrolling
   moves the camera along an avenue through five places a piece
   passes through.
================================================================ */

const MAP = 3000 // map is MAP x MAP px; 1 map unit = 1 css px
const STEPS = 220
const SCROLL_SCREENS = 9 // how many screens tall the flight is

const WP = [
  [700, 2500],
  [1100, 2050],
  [1650, 1850],
  [2050, 1350],
  [1500, 850],
]

const CH = [
  {
    k: 'Chapter I',
    place: 'The Atelier',
    title: ['Where a line', 'begins'],
    text: 'Every piece starts as a single line on paper. We draw it, pin it to the wall and leave it there. If it still feels right a week later, it earns a place on the map.',
    facts: [['12', 'sketches a piece'], ['1', 'week on the wall'], ['0', 'shortcuts']],
  },
  {
    k: 'Chapter II',
    place: 'The Mill',
    title: ['Cloth with', 'weight'],
    text: 'Heavy cotton, dense wool and rib knit, chosen by hand and brushed until it feels already worn. We would rather cut less and use better.',
    facts: [['240', 'gsm cotton'], ['3', 'fabric trials'], ['100%', 'pre-washed']],
  },
  {
    k: 'Chapter III',
    place: 'The Wash House',
    title: ['A history before', 'day one'],
    text: 'Every garment is washed, sanded and softened before a label is ever sewn in. The fade, the drape and the small imperfections are all intentional.',
    facts: [['2', 'wash cycles'], ['1', 'sanding pass'], ['∞', 'character']],
  },
  {
    k: 'Chapter IV',
    place: 'The Print Works',
    title: ['Pressed,', 'not printed'],
    text: 'Cracked graphics, hand-painted logos and raised silicone, finished one piece at a time by people who care how it sits on the chest.',
    facts: [['4', 'print methods'], ['1 by 1', 'finished by hand'], ['0', 'repeats']],
  },
  {
    k: 'Chapter V',
    place: 'The Rack',
    title: ['Hung, numbered,', 'gone'],
    text: 'Finished pieces go on the rail in small, numbered runs. When a size is gone, it is gone. Nothing is restocked and nothing is rushed.',
    facts: [['7', 'pieces'], ['11', 'colourways'], ['0', 'restocks']],
  },
]
const PH = [330, 300, 270, 320, 360] // pin heights

/* ------------------------------------------------------------- math */

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (t) => t * t * (3 - 2 * t)
const wrap = (a) => ((((a + 540) % 360) + 360) % 360) - 180

function cr(a, b, c, d, t) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
}
// Catmull-Rom spline through control points, u in 0..(n-1)
function spl(P, u) {
  const n = P.length
  const i = Math.min(n - 2, Math.max(0, Math.floor(u)))
  const t = u - i
  const g = (k) => P[Math.max(0, Math.min(n - 1, k))]
  const a = g(i - 1)
  const b = g(i)
  const c = g(i + 1)
  const d = g(i + 2)
  return [cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t)]
}
const routePoint = (u) => spl(WP, u)

const ROUTE = Array.from({ length: STEPS + 1 }, (_, i) => routePoint((i / STEPS) * (WP.length - 1)))
const LENS = [0]
for (let i = 1; i <= STEPS; i++) {
  LENS[i] = LENS[i - 1] + Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1])
}
const pathD = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')
const ROUTE_D = pathD(ROUTE)
const arcAt = (u) => LENS[Math.round(clamp(u / (WP.length - 1)) * STEPS)] / LENS[STEPS]

// normals + tangents along the route
const NORM = ROUTE.map((p, i) => {
  const a = ROUTE[Math.max(0, i - 1)]
  const b = ROUTE[Math.min(STEPS, i + 1)]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  return [-dy / l, dx / l, dx / l, dy / l] // nx, ny, tx, ty
})
const offsetD = (o) => pathD(ROUTE.map((p, i) => [p[0] + NORM[i][0] * o, p[1] + NORM[i][1] * o]))
const LANE_A = offsetD(26)
const LANE_B = offsetD(-26)

// a river that the avenue crosses on a bridge
const RIVER_CTRL = [
  [-300, 880],
  [500, 1060],
  [1000, 1320],
  [1450, 1520],
  [1900, 1660],
  [2400, 1930],
  [3300, 2180],
]
const RIVER = Array.from({ length: 161 }, (_, i) => spl(RIVER_CTRL, (i / 160) * (RIVER_CTRL.length - 1)))
const RIVER_D = pathD(RIVER)

const minDist = (arr, x, y, step = 1) => {
  let m = 1e9
  for (let i = 0; i < arr.length; i += step) {
    const d = Math.hypot(arr[i][0] - x, arr[i][1] - y)
    if (d < m) m = d
  }
  return m
}

const BRIDGE = (() => {
  let bi = -1
  let bd = 1e9
  ROUTE.forEach((p, i) => {
    const d = minDist(RIVER, p[0], p[1])
    if (d < bd) {
      bd = d
      bi = i
    }
  })
  if (bd > 90) return null
  return { x: ROUTE[bi][0], y: ROUTE[bi][1], ang: (Math.atan2(NORM[bi][3], NORM[bi][2]) * 180) / Math.PI }
})()

// deterministic random so the city is the same on every load
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------- the city */

// [dx, dy, w, d, h, z, gold]
const OFF = [[200, -60], [-250, -30], [230, 50], [-240, -40], [0, 0]]
const DEFS = [
  [[-30, -30, 60, 60, 380, 0, 1], [60, -20, 90, 70, 70, 0, 0], [-130, 10, 80, 60, 50, 0, 0]],
  [[-110, -70, 220, 140, 110, 0, 0], [70, -110, 40, 40, 320, 0, 1], [-100, 90, 60, 40, 60, 0, 0]],
  [[-90, -60, 80, 80, 150, 0, 0], [10, -60, 80, 80, 110, 0, 0], [-40, 40, 100, 60, 70, 0, 0], [-150, -20, 50, 50, 210, 0, 1]],
  [
    ...Array.from({ length: 5 }, (_, k) => [-120 + k * 48, -70, 38, 150, 70 + (k % 2) * 28, 0, 0]),
    [100, -80, 52, 52, 270, 0, 1],
  ],
  [[-110, -30, 36, 36, 300, 0, 1], [74, -30, 36, 36, 300, 0, 1], [-110, -30, 220, 36, 38, 300, 1]],
]

// street grid with irregular spacing; every third street is a main road
const R2 = rng(23)
const axis = () => {
  const a = [0]
  while (a[a.length - 1] < MAP - 200) a.push(a[a.length - 1] + 250 + Math.floor(R2() * 170))
  a.push(MAP)
  return a
}
const XS = axis()
const YS = axis()
const rw = (i, n) => (i === 0 || i === n - 1 ? 0 : i % 3 === 0 ? 44 : 26)

const MONO_CENTERS = WP.map((w, i) => [w[0] + OFF[i][0], w[1] + OFF[i][1]])

const CITY = (() => {
  const cells = [] // [x, y, w, h, isPark]
  const parks = []
  const lots = []
  const trees = []
  const rt = rng(41)

  for (let i = 0; i < XS.length - 1; i++) {
    for (let j = 0; j < YS.length - 1; j++) {
      const x0 = XS[i] + rw(i, XS.length) / 2 + 10
      const x1 = XS[i + 1] - rw(i + 1, XS.length) / 2 - 10
      const y0 = YS[j] + rw(j, YS.length) / 2 + 10
      const y1 = YS[j + 1] - rw(j + 1, YS.length) / 2 - 10
      const w = x1 - x0
      const h = y1 - y0
      if (w < 80 || h < 80) continue
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      const size = Math.min(w, h)
      const dR = minDist(ROUTE, cx, cy, 3)
      const dV = minDist(RIVER, cx, cy, 2)
      const blocked =
        dR < 100 + size * 0.4 ||
        dV < 90 + size * 0.35 ||
        MONO_CENTERS.some((m) => Math.hypot(m[0] - cx, m[1] - cy) < 300 + size * 0.2)
      if (blocked) {
        cells.push([x0, y0, w, h, 0])
        continue
      }
      if (R2() < 0.1) {
        cells.push([x0, y0, w, h, 1])
        parks.push([x0, y0, w, h])
        for (let k = 0; k < 11; k++) {
          trees.push([x0 + 22 + rt() * (w - 44), y0 + 22 + rt() * (h - 44), 11 + rt() * 9])
        }
        continue
      }
      cells.push([x0, y0, w, h, 0])
      const nx = w > 250 ? 2 : 1
      const ny = h > 250 ? 2 : 1
      const lw = (w - (nx - 1) * 14) / nx
      const lh = (h - (ny - 1) * 14) / ny
      for (let a = 0; a < nx; a++) {
        for (let b = 0; b < ny; b++) {
          const m = 10 + R2() * 10
          const bw = lw - 2 * m
          const bd = lh - 2 * m
          if (bw < 40 || bd < 40) continue
          const lx = x0 + a * (lw + 14) + m
          const ly = y0 + b * (lh + 14) + m
          lots.push({ x: lx, y: ly, w: bw, d: bd, dR: minDist(ROUTE, lx + bw / 2, ly + bd / 2, 3) })
        }
      }
    }
  }
  return { cells, parks, lots, trees }
})()

const BLOCKS = (() => {
  const out = []
  WP.forEach((w, i) =>
    DEFS[i].forEach(([dx, dy, bw, bd, h, z, g], k) =>
      out.push({
        x: w[0] + OFF[i][0] + dx,
        y: w[1] + OFF[i][1] + dy,
        w: bw,
        d: bd,
        h,
        z,
        g,
        c: 'b',
        v: 1 + ((i + k) % 3),
        ox: (k * 37) % 112,
        oy: (k * 53) % 120,
      }),
    ),
  )
  const r = rng(77)
  const lots = CITY.lots
    .filter((l) => l.dR < 1250)
    .sort((a, b) => a.dR - b.dR)
    .slice(0, 165)
  lots.forEach((l) => {
    const cx = l.x + l.w / 2
    const cy = l.y + l.d / 2
    const tall = Math.exp(-Math.hypot(cx - 1450, cy - 1500) / 1100)
    const h = 26 + Math.pow(r(), 1.5) * (60 + 330 * tall)
    const base = {
      c: ['a', 'b', 'c'][Math.floor(r() * 3)],
      v: 1 + Math.floor(r() * 3),
      ox: Math.floor(r() * 112),
      oy: Math.floor(r() * 120),
    }
    out.push({ x: l.x, y: l.y, w: l.w, d: l.d, h, z: 0, g: 0, ...base })
    if (h > 150) {
      const sw = l.w * 0.62
      const sd = l.d * 0.62
      out.push({ x: l.x + (l.w - sw) / 2, y: l.y + (l.d - sd) / 2, w: sw, d: sd, h: h * 0.32, z: h, g: 0, ...base })
      if (h > 250) {
        out.push({ x: cx - 5, y: cy - 5, w: 10, d: 10, h: 110, z: h + h * 0.32, g: 1, ...base })
      }
    }
  })
  return out
})()

// street lamps and trees along the avenue
const AV = (() => {
  const lamps = []
  const trees = []
  const r = rng(9)
  for (let i = 6; i < STEPS - 3; i += 7) {
    ;[1, -1].forEach((s) => {
      const x = ROUTE[i][0] + NORM[i][0] * s * 92
      const y = ROUTE[i][1] + NORM[i][1] * s * 92
      if (minDist(RIVER, x, y, 2) > 110) lamps.push([x, y])
    })
  }
  for (let i = 3; i < STEPS - 2; i += 9) {
    ;[1, -1].forEach((s) => {
      const x = ROUTE[i][0] + NORM[i][0] * s * 118
      const y = ROUTE[i][1] + NORM[i][1] * s * 118
      if (minDist(RIVER, x, y, 2) > 120) trees.push([x, y, 10 + r() * 5])
    })
  }
  return { lamps, trees }
})()

// window textures (generated once, shared by every wall as CSS variables)
function winTile(seed, vertical) {
  const r = rng(seed)
  const cols = 8
  const rows = 6
  const pw = 14
  const ph = 20
  let rects = ''
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const v = r()
      if (v > 0.5) continue
      const col = v < 0.06 ? '#bfd8ff' : v < 0.3 ? '#ffd08a' : '#c99a52'
      const op = v < 0.3 ? 0.95 : 0.5
      const x = cx * pw + 3
      const y = cy * ph + 4
      rects += vertical
        ? `<rect x='${y}' y='${x}' width='11' height='8' fill='${col}' fill-opacity='${op}'/>`
        : `<rect x='${x}' y='${y}' width='8' height='11' fill='${col}' fill-opacity='${op}'/>`
    }
  }
  const W = vertical ? rows * ph : cols * pw
  const H = vertical ? cols * pw : rows * ph
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>${rects}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
const WINVARS = (() => {
  const o = {}
  ;[1, 2, 3].forEach((k) => {
    o[`--wa${k}`] = winTile(100 + k, false)
    o[`--wb${k}`] = winTile(200 + k, true)
  })
  return o
})()

const DUST = (() => {
  const r = rng(5)
  return Array.from({ length: 44 }, () => ({
    x: r() * 100,
    y: r() * 100,
    s: 1 + r() * 2.6,
    d: -r() * 14,
    t: 9 + r() * 12,
  }))
})()

/* -------------------------------------------------- static 3D world */

const Block = ({ b }) => (
  <div
    className={`bk ${b.c} v${b.v || 1} ${b.g ? 'gold' : ''}`}
    style={{
      '--x': `${b.x.toFixed(0)}px`,
      '--y': `${b.y.toFixed(0)}px`,
      '--w': `${b.w.toFixed(0)}px`,
      '--d': `${b.d.toFixed(0)}px`,
      '--h': `${b.h.toFixed(0)}px`,
      '--z': `${b.z}px`,
      '--ox': `${b.ox || 0}px`,
      '--oy': `${b.oy || 0}px`,
    }}
  >
    {!b.z && <i className="sd" />}
    <i className="t" />
    <i className="s" />
    <i className="n" />
    <i className="e" />
    <i className="w" />
  </div>
)

const Blocks = memo(function Blocks() {
  return (
    <>
      {BLOCKS.map((b, i) => (
        <Block key={i} b={b} />
      ))}
    </>
  )
})

const LABELS = [
  ['OLD QUARTER', 520, 640],
  ['THE ARCADE', 1900, 520],
  ['NORTH WHARF', 1300, 220],
  ['SOUTH GATE', 1700, 2760],
  ['THE GARDENS', 2260, 2400],
]

const MapSvg = memo(function MapSvg({ glowRef, lineRef, dotRef }) {
  return (
    <svg className="fl-svg" viewBox={`0 0 ${MAP} ${MAP}`} width={MAP} height={MAP} aria-hidden="true">
      <defs>
        <radialGradient id="mbg" cx="50%" cy="50%" r="70%">
          <stop offset="0" stopColor="#1d1810" />
          <stop offset="1" stopColor="#0a0908" />
        </radialGradient>
        <radialGradient id="lamp">
          <stop offset="0" stopColor="#ffd9a0" stopOpacity=".5" />
          <stop offset="1" stopColor="#ffd9a0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tree" cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#3b5030" />
          <stop offset="1" stopColor="#141b11" />
        </radialGradient>
        <filter id="noise" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <pattern id="ng" width="300" height="300" patternUnits="userSpaceOnUse">
          <rect width="300" height="300" filter="url(#noise)" opacity=".55" />
        </pattern>
        <filter id="mblur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {/* asphalt */}
      <rect width={MAP} height={MAP} fill="#15120e" />

      {/* city blocks: sidewalk, then lot (or park) */}
      {CITY.cells.map((c, i) => (
        <g key={i}>
          <rect x={c[0] - 9} y={c[1] - 9} width={c[2] + 18} height={c[3] + 18} rx="6" fill="#272119" />
          <rect x={c[0]} y={c[1]} width={c[2]} height={c[3]} rx="3" fill={c[4] ? '#0f150e' : '#100e0b'} />
        </g>
      ))}

      {/* centre lines on the main roads */}
      {XS.map((x, i) =>
        rw(i, XS.length) >= 44 ? (
          <line key={`vx${i}`} x1={x} y1="0" x2={x} y2={MAP} stroke="#c9a35b" strokeOpacity=".35" strokeWidth="2.5" strokeDasharray="20 24" />
        ) : null,
      )}
      {YS.map((y, i) =>
        rw(i, YS.length) >= 44 ? (
          <line key={`hy${i}`} x1="0" y1={y} x2={MAP} y2={y} stroke="#c9a35b" strokeOpacity=".35" strokeWidth="2.5" strokeDasharray="20 24" />
        ) : null,
      )}

      <rect width={MAP} height={MAP} fill="url(#ng)" opacity=".5" />

      {/* trees in parks */}
      {CITY.trees.map((t, i) => (
        <g key={i}>
          <circle cx={t[0] + 6} cy={t[1] + 7} r={t[2]} fill="#000" opacity=".45" />
          <circle cx={t[0]} cy={t[1]} r={t[2]} fill="url(#tree)" />
        </g>
      ))}

      {LABELS.map(([t, x, y]) => (
        <text key={t} x={x} y={y} fill="#c9a35b" fillOpacity=".3" fontSize="46" letterSpacing="22" fontFamily="Archivo Variable, sans-serif">
          {t}
        </text>
      ))}

      {/* river */}
      <path d={RIVER_D} fill="none" stroke="#2a2218" strokeWidth="190" strokeLinecap="round" strokeLinejoin="round" />
      <path d={RIVER_D} fill="none" stroke="#0c161c" strokeWidth="150" strokeLinecap="round" strokeLinejoin="round" />
      <path d={RIVER_D} fill="none" stroke="#14303a" strokeOpacity=".7" strokeWidth="90" strokeLinecap="round" strokeLinejoin="round" />
      <path className="rv" d={RIVER_D} fill="none" stroke="#a8dcee" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round" strokeDasharray="46 120" />

      {/* the avenue the camera follows */}
      <path d={ROUTE_D} fill="none" stroke="#2b251c" strokeWidth="210" strokeLinecap="round" strokeLinejoin="round" />
      <path d={ROUTE_D} fill="none" stroke="#16130f" strokeWidth="150" strokeLinecap="round" strokeLinejoin="round" />
      <path d={ROUTE_D} fill="none" stroke="#c9a35b" strokeOpacity=".5" strokeWidth="3" strokeDasharray="22 22" />
      {BRIDGE && (
        <g transform={`translate(${BRIDGE.x.toFixed(1)} ${BRIDGE.y.toFixed(1)}) rotate(${BRIDGE.ang.toFixed(1)})`}>
          <rect x="-150" y="-86" width="300" height="172" fill="#1c1812" stroke="#c9a35b" strokeOpacity=".4" />
          <line x1="-150" y1="-80" x2="150" y2="-80" stroke="#e3c98a" strokeOpacity=".7" strokeWidth="5" />
          <line x1="-150" y1="80" x2="150" y2="80" stroke="#e3c98a" strokeOpacity=".7" strokeWidth="5" />
        </g>
      )}

      {/* traffic: headlights one way, tail lights the other */}
      <path className="tr1" d={LANE_A} fill="none" stroke="#fff1cf" strokeWidth="6" strokeLinecap="round" strokeDasharray="4 92" />
      <path className="tr2" d={LANE_B} fill="none" stroke="#ff5a46" strokeWidth="6" strokeLinecap="round" strokeDasharray="4 92" />

      {/* trees + street lamps along the avenue */}
      {AV.trees.map((t, i) => (
        <g key={i}>
          <circle cx={t[0] + 5} cy={t[1] + 6} r={t[2]} fill="#000" opacity=".45" />
          <circle cx={t[0]} cy={t[1]} r={t[2]} fill="url(#tree)" />
        </g>
      ))}
      {AV.lamps.map((l, i) => (
        <g key={i}>
          <circle cx={l[0]} cy={l[1]} r="46" fill="url(#lamp)" />
          <circle cx={l[0]} cy={l[1]} r="4.5" fill="#fff0cc" />
        </g>
      ))}

      {/* the glowing route that is drawn as you scroll */}
      <path ref={glowRef} d={ROUTE_D} pathLength="1" fill="none" stroke="#e3c98a" strokeWidth="26" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset="1" filter="url(#mblur)" opacity=".7" />
      <path ref={lineRef} d={ROUTE_D} pathLength="1" fill="none" stroke="#f4e2b2" strokeWidth="7" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset="1" />
      <circle ref={dotRef} r="20" fill="#fff4d6" cx={WP[0][0]} cy={WP[0][1]} />
    </svg>
  )
})

function Pins({ active }) {
  return (
    <>
      {WP.map((w, i) => (
        <div key={i} className={`pin ${active === i ? 'on' : ''}`} style={{ left: w[0], top: w[1], '--ph': `${PH[i]}px` }}>
          <i className="pin-base" />
          <div className="pin-bb">
            <span className="pin-stem" />
            <span className="pin-dot">{i + 1}</span>
            <div className="pin-card">
              <b>{CH[i].place}</b>
              <small>{CH[i].k}</small>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

/* ------------------------------------------------------------ page */

export default function About() {
  const ref = useReveal()
  const secRef = useRef(null)
  const stageRef = useRef(null)
  const worldRef = useRef(null)
  const glowRef = useRef(null)
  const lineRef = useRef(null)
  const dotRef = useRef(null)
  const introRef = useRef(null)
  const outroRef = useRef(null)
  const capRef = useRef(null)
  const progRef = useRef(null)
  const coordRef = useRef(null)
  const ptr = useRef({ x: 0, y: 0 })
  const idxRef = useRef(-1)
  const [idx, setIdx] = useState(-1) // -1 intro, 0..4 chapter, 5 outro

  useEffect(() => {
    const sec = secRef.current
    const stage = stageRef.current
    const world = worldRef.current
    const sc = sec.closest('.page')
    if (!sc) return

    let p = 0
    const readP = () => {
      const range = Math.max(1, sec.offsetHeight - stage.offsetHeight)
      p = clamp((sc.scrollTop - sec.offsetTop) / range)
    }
    sc.addEventListener('scroll', readP, { passive: true })
    window.addEventListener('resize', readP)
    readP()

    const cam = { cx: MAP / 2, cy: MAP / 2, rz: 0, tilt: 0, dz: -2100, u: 0, sx: 0, sy: 0 }
    let raf
    let last = performance.now()

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      // ---- where the camera wants to be for this scroll position
      const intro = smooth(clamp(p / 0.14))
      const outro = smooth(clamp((p - 0.92) / 0.08))
      const q = clamp((p - 0.14) / 0.78)
      const seg = q * 4
      const i = Math.min(3, Math.floor(seg))
      const uT = q >= 1 ? 4 : i + smooth(seg - i) // lingers at every waypoint
      const [rx, ry] = routePoint(uT)
      const [ax, ay] = routePoint(Math.min(4, uT + 0.05))
      const [bx, by] = routePoint(Math.max(0, uT - 0.05))
      const heading = (-Math.atan2(ax - bx, -(ay - by)) * 180) / Math.PI

      let tx = lerp(MAP / 2, rx, intro)
      let ty = lerp(MAP / 2, ry, intro)
      let tilt = lerp(0, 57 + Math.sin(uT * 2.1) * 3, intro)
      let dz = lerp(-2100, 110 + Math.sin(uT * 1.7) * 60, intro)
      let rz = heading * intro
      tx = lerp(tx, 1420, outro)
      ty = lerp(ty, 1640, outro)
      tilt = lerp(tilt, 34, outro)
      dz = lerp(dz, -1150, outro)
      rz = lerp(rz, -12, outro)
      rz = cam.rz + wrap(rz - cam.rz)

      // ---- ease the real camera toward it (this is the cinematic inertia)
      const k = 1 - Math.exp(-dt * 3.4)
      cam.cx += (tx - cam.cx) * k
      cam.cy += (ty - cam.cy) * k
      cam.tilt += (tilt - cam.tilt) * k
      cam.dz += (dz - cam.dz) * k
      cam.rz += (rz - cam.rz) * k
      cam.u += (uT - cam.u) * k
      const kp = 1 - Math.exp(-dt * 4)
      cam.sx += (ptr.current.x - cam.sx) * kp
      cam.sy += (ptr.current.y - cam.sy) * kp

      const tiltE = cam.tilt - cam.sy * 2.6
      const rzE = cam.rz + cam.sx * 2.4
      world.style.transform = `translate3d(0,0,${cam.dz.toFixed(1)}px) rotateX(${tiltE.toFixed(2)}deg) rotateZ(${rzE.toFixed(2)}deg) translate3d(${(-cam.cx).toFixed(1)}px,${(-cam.cy).toFixed(1)}px,0)`
      world.style.setProperty('--tilt', `${tiltE.toFixed(2)}deg`)
      world.style.setProperty('--rz', `${rzE.toFixed(2)}deg`)

      // ---- route drawing + beacon
      const off = (1 - arcAt(cam.u) * intro).toFixed(4)
      if (glowRef.current) glowRef.current.style.strokeDashoffset = off
      if (lineRef.current) lineRef.current.style.strokeDashoffset = off
      if (dotRef.current) {
        const [dx, dy] = routePoint(cam.u)
        dotRef.current.setAttribute('cx', dx.toFixed(1))
        dotRef.current.setAttribute('cy', dy.toFixed(1))
        dotRef.current.style.opacity = intro.toFixed(2)
      }

      // ---- overlays
      const introOp = 1 - clamp(p / 0.085)
      if (introRef.current) {
        introRef.current.style.opacity = introOp.toFixed(3)
        introRef.current.style.transform = `translate3d(0,${(p * -260).toFixed(1)}px,0) scale(${(1 + p * 1.2).toFixed(3)})`
        introRef.current.style.pointerEvents = introOp > 0.4 ? 'auto' : 'none'
      }
      const outroOp = clamp((p - 0.945) / 0.045)
      if (outroRef.current) {
        outroRef.current.style.opacity = outroOp.toFixed(3)
        outroRef.current.style.pointerEvents = outroOp > 0.5 ? 'auto' : 'none'
      }
      const d = Math.abs(cam.u - Math.round(cam.u))
      const phase = clamp((p - 0.13) / 0.03) * (1 - clamp((p - 0.925) / 0.02))
      const capOp = clamp((0.4 - d) / 0.2) * phase
      if (capRef.current) {
        capRef.current.style.opacity = capOp.toFixed(3)
        capRef.current.style.transform = `translate3d(0,${((1 - capOp) * 24).toFixed(1)}px,0)`
      }

      // ---- HUD
      if (progRef.current) progRef.current.style.transform = `scaleX(${p.toFixed(4)})`
      if (coordRef.current) {
        coordRef.current.textContent = `X ${String(Math.round(cam.cx)).padStart(4, '0')}  ·  Y ${String(Math.round(cam.cy)).padStart(4, '0')}  ·  ALT ${String(Math.round(2100 + cam.dz)).padStart(4, '0')}`
      }

      // ---- which chapter is on screen
      const a = p < 0.13 ? -1 : p > 0.93 ? 5 : Math.round(cam.u)
      if (a !== idxRef.current) {
        idxRef.current = a
        setIdx(a)
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      sc.removeEventListener('scroll', readP)
      window.removeEventListener('resize', readP)
    }
  }, [])

  const goChapter = (i) => {
    const sec = secRef.current
    const sc = sec.closest('.page')
    const range = sec.offsetHeight - stageRef.current.offsetHeight
    sc.scrollTo({ top: sec.offsetTop + range * (0.14 + (i / 4) * 0.78), behavior: 'smooth' })
  }

  const onMove = (e) => {
    ptr.current.x = e.clientX / window.innerWidth - 0.5
    ptr.current.y = e.clientY / window.innerHeight - 0.5
  }

  const c = idx >= 0 && idx <= 4 ? CH[idx] : null

  return (
    <div ref={ref} className="pg about">
      <section className="fl" ref={secRef} style={{ '--n': SCROLL_SCREENS }}>
        <div className="fl-stage" ref={stageRef} onPointerMove={onMove}>
          <div className="fl-sky" />

          <div className="fl-cam">
            <div className="fl-world" ref={worldRef} style={WINVARS}>
              <MapSvg glowRef={glowRef} lineRef={lineRef} dotRef={dotRef} />
              <Blocks />
              <Pins active={idx} />
            </div>
          </div>

          <div className="fl-fog" />
          <div className="fl-pool" />
          <div className="fl-dof" />
          <div className="fl-leak a" />
          <div className="fl-leak b" />
          <div className="fl-dust" aria-hidden="true">
            {DUST.map((d, i) => (
              <i key={i} style={{ left: `${d.x}%`, top: `${d.y}%`, '--s': `${d.s}px`, animationDelay: `${d.d}s`, animationDuration: `${d.t}s` }} />
            ))}
          </div>
          <div className="fl-vig" />
          <div className="fl-grain" />
          <i className="fl-flare" key={`f${idx}`} />

          <div className="fl-bar top" />
          <div className="fl-bar bot" />
          <div className="fl-frame" aria-hidden="true" />

          <div className="fl-intro" ref={introRef}>
            <p className="fl-eyebrow">The atelier, mapped</p>
            <h1 className="fl-brand">Fancy Clothes</h1>
            <p className="fl-sub">A journey through the five places a piece passes before it ever reaches the rack.</p>
            <button type="button" className="fl-enter" onClick={() => goChapter(0)}>
              <span>Scroll to enter</span>
              <i />
            </button>
          </div>

          <div className="fl-cap" ref={capRef}>
            {c && (
              <div className="fl-cap-in" key={idx}>
                <p className="fl-k" style={{ '--n': 0 }}>
                  <span>{c.k}</span>
                  <i />
                  <span>{c.place}</span>
                </p>
                <h2 style={{ '--n': 1 }}>
                  {c.title[0]} <em>{c.title[1]}</em>
                </h2>
                <p className="fl-t" style={{ '--n': 2 }}>
                  {c.text}
                </p>
                <dl className="fl-facts" style={{ '--n': 3 }}>
                  {c.facts.map(([v, l]) => (
                    <div key={l}>
                      <dt>{v}</dt>
                      <dd>{l}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          <div className="fl-outro" ref={outroRef}>
            <p className="fl-eyebrow">The end of the route</p>
            <h2 className="fl-big">
              Wear it <em>loose.</em>
            </h2>
            <div className="fl-btns">
              <a className="lux-btn" href="#/shop">
                Shop the drop
              </a>
              <a className="lux-btn ghost" href="#/lookbook">
                The lookbook
              </a>
            </div>
          </div>

          <p className="fl-coord" ref={coordRef} aria-hidden="true" />

          <div className="fl-hud">
            <div className="fl-prog">
              <i ref={progRef} />
            </div>
            <ol>
              {CH.map((x, i) => (
                <li key={x.place} className={idx === i ? 'on' : ''}>
                  <button type="button" onClick={() => goChapter(i)}>
                    <b>0{i + 1}</b>
                    <span>{x.place}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
