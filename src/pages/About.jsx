import { memo, useEffect, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import land110 from 'world-atlas/land-110m.json'
import land50 from 'world-atlas/land-50m.json'
import Footer from '../components/Footer.jsx'
import { useReveal } from '../lib/useReveal'

/* ================================================================
   About — "The Atelier, mapped"
   1. A globe turns and zooms toward a city (scroll).
   2. Streets spread out from the centre, buildings rise.
   3. The camera dives in and flies along an avenue through five
      places a piece passes through.
   White + one blue accent.
================================================================ */

const MAP = 3000 // map is MAP x MAP px; 1 map unit = 1 css px
const STEPS = 220
const SCROLL_SCREENS = 7.5 // how many screens tall the whole thing is
const TARGET = { lon: 2.3522, lat: 48.8566 } // where the globe lands
const TAU = Math.PI * 2
const RAD = Math.PI / 180

// The globe and the dive into the city take only the first 10% of the scroll,
// so the road is reached quickly; the five chapters keep the rest.
const WARP_RAW = 0.1
const WARP_TO = 0.3
const warpP = (r) => (r < WARP_RAW ? r * (WARP_TO / WARP_RAW) : WARP_TO + (r - WARP_RAW) * ((1 - WARP_TO) / (1 - WARP_RAW)))
const unwarpP = (q) => (q < WARP_TO ? q * (WARP_RAW / WARP_TO) : WARP_RAW + (q - WARP_TO) * ((1 - WARP_RAW) / (1 - WARP_TO)))

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

// [dx, dy, w, d, h, z, accent]
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
  return { cells, lots, trees }
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
        c: g ? 'c' : h <= 120 ? 'a' : 'b',
        v: g ? 3 : h <= 120 ? 1 : 2,
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
    const q = r()
    const c = q < 0.12 + 0.34 * tall ? 'c' : q < 0.5 + 0.2 * tall ? 'b' : 'a'
    const h = c === 'c' ? 90 + Math.pow(r(), 1.4) * (70 + 300 * tall) : c === 'b' ? 42 + r() * 55 : 62 + r() * 48
    const base = {
      c,
      v: c === 'a' ? 1 : c === 'b' ? 2 : 3,
      ox: Math.floor(r() * 112),
      oy: Math.floor(r() * 120),
    }
    out.push({ x: l.x, y: l.y, w: l.w, d: l.d, h, z: 0, g: 0, ...base })
    if (c === 'a') {
      // zinc mansard roof: the Paris skyline
      out.push({ x: l.x + 4, y: l.y + 4, w: l.w - 8, d: l.d - 8, h: 24, z: h, g: 0, m: 1, ...base })
    } else if (h > 150) {
      const sw = l.w * 0.62
      const sd = l.d * 0.62
      out.push({ x: l.x + (l.w - sw) / 2, y: l.y + (l.d - sd) / 2, w: sw, d: sd, h: h * 0.32, z: h, g: 0, ...base })
      if (h > 250) {
        out.push({ ...base, x: cx - 5, y: cy - 5, w: 10, d: 10, h: 110, z: h + h * 0.32, g: 0, c: 'k' })
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
// Window textures by building type: 1 limestone, 2 brick, 3 glass curtain wall
function winTile(seed, vertical, kind) {
  const r = rng(seed)
  const cols = 8
  const rows = 6
  const pw = 14
  const ph = 20
  let rects = ''
  const put = (x, y, w, h, fill, op) => {
    rects += vertical
      ? `<rect x='${y}' y='${x}' width='${h}' height='${w}' fill='${fill}' fill-opacity='${op}'/>`
      : `<rect x='${x}' y='${y}' width='${w}' height='${h}' fill='${fill}' fill-opacity='${op}'/>`
  }
  for (let cy = 0; cy < rows; cy++) {
    if (kind === 1 && (cy === 1 || cy === 4)) put(0, cy * ph + 16, cols * pw, 1.6, '#23262b', 0.7) // iron balconies
    for (let cx = 0; cx < cols; cx++) {
      const v = r()
      const x = cx * pw
      const y = cy * ph
      const lit = v < 0.09
      if (kind === 1) {
        put(x + 3, y + 3, 8, 13, lit ? '#ffd68a' : '#37404d', lit ? 0.95 : 0.85)
        put(x + 2, y + 16, 10, 1.8, '#a89d86', 0.7)
      } else if (kind === 2) {
        put(x + 3.5, y + 4.5, 7, 11, lit ? '#ffd68a' : '#2e3640', lit ? 0.95 : 0.85)
        put(x + 2.5, y + 3, 9, 1.5, '#e0d6c0', 0.8)
      } else {
        put(x + 1, y + 1.5, 12, 17, lit ? '#ffe3a8' : v < 0.45 ? '#bcd2e4' : v < 0.8 ? '#86a2bc' : '#5f7a95', 0.92)
      }
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
    o[`--wa${k}`] = winTile(100 + k, false, k)
    o[`--wb${k}`] = winTile(200 + k, true, k)
  })
  return o
})()

const DUST = (() => {
  const r = rng(5)
  return Array.from({ length: 36 }, () => ({
    x: r() * 100,
    y: r() * 100,
    s: 1.5 + r() * 2.6,
    d: -r() * 14,
    t: 9 + r() * 12,
  }))
})()

/* ------------------------------------------------------------ globe */

const BLUE = '18,18,16'
const SUN = [-0.5, 0.45, 0.74] // light direction in view space (x right, y up, z towards the viewer)

// [lon, lat, radius in degrees, rgb, alpha, hard edge] rough biomes painted over the land
const BIOMES = [
  [12, 24, 21, '218,184,118', 0.95],
  [15, 10, 14, '170,168,86', 0.6],
  [45, 24, 12, '220,186,120', 0.9],
  [60, 36, 10, '198,172,124', 0.6],
  [102, 43, 14, '204,180,130', 0.8],
  [88, 33, 9, '176,156,132', 0.8],
  [134, -25, 17, '208,152,96', 0.9],
  [22, -23, 10, '210,176,116', 0.8],
  [-69, -45, 9, '170,160,110', 0.6],
  [-69, -22, 6, '176,142,108', 0.8],
  [-110, 35, 9, '208,176,118', 0.7],
  [-100, 42, 10, '160,168,92', 0.6],
  [-104, 27, 7, '206,172,112', 0.7],
  [78, 21, 8, '168,164,84', 0.55],
  [-62, -5, 15, '28,84,42', 0.9],
  [23, 0, 10, '28,84,42', 0.9],
  [112, -1, 9, '30,90,46', 0.8],
  [102, 16, 8, '36,96,50', 0.7],
  [100, 61, 24, '52,88,66', 0.8],
  [-100, 59, 22, '54,88,68', 0.8],
  [15, 56, 10, '80,126,70', 0.5],
  [-80, 36, 8, '50,100,56', 0.7],
  [-95, 73, 10, '200,212,214', 0.7],
  [110, 72, 13, '200,212,214', 0.7],
  [-42, 73, 13, '244,248,255', 1, 1],
  [0, -90, 28, '244,248,255', 1, 1],
]

const CITIES = [
  [2.35, 48.86], [-0.13, 51.5], [-3.7, 40.4], [12.5, 41.9], [13.4, 52.5], [37.6, 55.75], [29, 41],
  [31.2, 30], [3.4, 6.5], [28, -26.2], [36.8, -1.3], [55.3, 25.2], [51.4, 35.7], [77.2, 28.6],
  [72.8, 19], [90.4, 23.8], [100.5, 13.7], [106.8, -6.2], [103.8, 1.35], [116.4, 39.9], [121.5, 31.2],
  [114.2, 22.3], [127, 37.6], [139.7, 35.7], [151.2, -33.9], [-46.6, -23.5], [-58.4, -34.6],
  [-77, -12], [-74, 4.7], [-99.1, 19.4], [-118.2, 34], [-74, 40.7], [-87.6, 41.9], [-79.4, 43.7],
  [-95.4, 29.8], [121, 14.6], [67, 24.9], [88.4, 22.6],
]

const SPRITE_STOPS = {
  soft: [[0, 1], [0.5, 0.8], [1, 0]],
  hard: [[0, 1], [0.8, 1], [1, 0]],
  cloud: [[0, 0.95], [0.4, 0.5], [1, 0]],
  warm: [[0, 1], [0.2, 0.7], [1, 0]],
}

// Everything the globe needs, built once: coastlines, biomes, clouds, city lights.
function buildEarth() {
  const cache = {}
  const sprite = (rgb, kind = 'soft') => {
    const key = `${rgb}|${kind}`
    if (cache[key]) return cache[key]
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 128
    const g = c.getContext('2d')
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    SPRITE_STOPS[kind].forEach(([o, a]) => gr.addColorStop(o, `rgba(${rgb},${a})`))
    g.fillStyle = gr
    g.fillRect(0, 0, 128, 128)
    cache[key] = c
    return c
  }
  const vec = (lon, lat) => [Math.sin(lat * RAD), Math.cos(lat * RAD), Math.sin(lon * RAD), Math.cos(lon * RAD)]

  const toRings = (topo) => {
    const geo = feature(topo, topo.objects.land)
    const feats = geo.type === 'FeatureCollection' ? geo.features : [geo]
    const out = []
    feats.forEach((f) => {
      const geom = f.geometry
      const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []
      polys.forEach((poly) =>
        poly.forEach((ring) => {
          const n = ring.length - 1 // the last point repeats the first
          if (n < 3) return
          const a = new Float32Array(n * 4)
          for (let i = 0; i < n; i++) a.set(vec(ring[i][0], ring[i][1]), i * 4)
          out.push(a)
        }),
      )
    })
    return out
  }

  const r = rng(314)
  const clouds = []
  for (let g = 0; g < 48; g++) {
    const lat = (r() + r() - 1) * 72
    const lon = r() * 360 - 180
    const n = 4 + Math.floor(r() * 6)
    for (let k = 0; k < n; k++) {
      const la = lat + (r() - 0.5) * 8
      const lo = lon + ((r() - 0.5) * 18) / Math.max(0.35, Math.cos(lat * RAD))
      clouds.push({
        sp: Math.sin(la * RAD),
        cp: Math.cos(la * RAD),
        lon: lo * RAD,
        rad: (2.2 + r() * 4.2) * RAD,
        a: 0.3 + r() * 0.4,
      })
    }
  }

  return {
    lo: toRings(land110),
    hi: toRings(land50),
    biomes: BIOMES.map(([lon, lat, deg, rgb, a, hard]) => ({
      v: vec(lon, lat),
      rad: deg * RAD,
      a,
      spr: sprite(rgb, hard ? 'hard' : 'soft'),
    })),
    clouds,
    cloudSpr: sprite('255,255,255', 'cloud'),
    cities: CITIES.map(([lon, lat]) => vec(lon, lat)),
    warm: sprite('255,196,110', 'warm'),
  }
}

const BUF = []

function limbArc(pts, cx, cy, R, a0, a1) {
  let d = a1 - a0
  while (d > Math.PI) d -= TAU
  while (d < -Math.PI) d += TAU
  const m = Math.floor(Math.abs(d) / 0.14)
  for (let k = 1; k <= m; k++) {
    const a = a0 + (d * k) / (m + 1)
    pts.push(cx + R * Math.cos(a), cy - R * Math.sin(a))
  }
}

// Projects one coastline ring onto the visible hemisphere. Parts that go round
// the back are followed along the horizon so the land never gets cut off.
function pushRing(path, ring, V, smooth) {
  const { cx, cy, R, c0, s0, cL, sL } = V
  const pts = BUF
  pts.length = 0
  const n = ring.length / 4
  let pvx = 0
  let pvy = 0
  let pvz = 0
  let lastLimb = false
  let lastAng = 0
  let front = false
  for (let i = 0; i < n; i++) {
    const sp = ring[i * 4]
    const cp = ring[i * 4 + 1]
    const sl0 = ring[i * 4 + 2]
    const cl0 = ring[i * 4 + 3]
    const cl = cl0 * cL + sl0 * sL
    const sl = sl0 * cL - cl0 * sL
    const vx = cp * sl
    const vy = c0 * sp - s0 * cp * cl
    const vz = s0 * sp + c0 * cp * cl
    if (i > 0 && vz >= 0 !== pvz >= 0) {
      const tt = pvz / (pvz - vz)
      let hx = pvx + (vx - pvx) * tt
      let hy = pvy + (vy - pvy) * tt
      const hl = Math.hypot(hx, hy) || 1
      hx /= hl
      hy /= hl
      const ang = Math.atan2(hy, hx)
      if (lastLimb) limbArc(pts, cx, cy, R, lastAng, ang)
      pts.push(cx + R * hx, cy - R * hy)
      lastAng = ang
      lastLimb = true
    }
    if (vz >= 0) {
      pts.push(cx + R * vx, cy - R * vy)
      lastLimb = false
      front = true
    } else {
      const l = Math.hypot(vx, vy) || 1
      const ang = Math.atan2(vy, vx)
      if (lastLimb) limbArc(pts, cx, cy, R, lastAng, ang)
      pts.push(cx + (R * vx) / l, cy - (R * vy) / l)
      lastAng = ang
      lastLimb = true
    }
    pvx = vx
    pvy = vy
    pvz = vz
  }
  if (!front) return
  const m = pts.length / 2
  if (m < 3) return
  if (smooth) {
    path.moveTo((pts[0] + pts[2]) / 2, (pts[1] + pts[3]) / 2)
    for (let i = 1; i < m; i++) {
      const j = (i + 1) % m
      path.quadraticCurveTo(pts[2 * i], pts[2 * i + 1], (pts[2 * i] + pts[2 * j]) / 2, (pts[2 * i + 1] + pts[2 * j + 1]) / 2)
    }
    path.quadraticCurveTo(pts[0], pts[1], (pts[0] + pts[2]) / 2, (pts[1] + pts[3]) / 2)
  } else {
    path.moveTo(pts[0], pts[1])
    for (let i = 1; i < m; i++) path.lineTo(pts[2 * i], pts[2 * i + 1])
  }
  path.closePath()
}

// Draws a soft round sprite lying on the sphere (foreshortened towards the edge).
function placeSprite(ctx, spr, V, sp, cp, sl0, cl0, rad, alpha) {
  const cl = cl0 * V.cL + sl0 * V.sL
  const sl = sl0 * V.cL - cl0 * V.sL
  const vx = cp * sl
  const vy = V.c0 * sp - V.s0 * cp * cl
  const vz = V.s0 * sp + V.c0 * cp * cl
  if (vz < -0.2) return
  const fade = clamp((vz + 0.2) / 0.35)
  const rr = V.R * Math.sin(rad)
  ctx.save()
  ctx.translate(V.cx + V.R * vx, V.cy - V.R * vy)
  ctx.rotate(Math.atan2(-vy, vx))
  ctx.scale(Math.max(0.1, vz), 1)
  ctx.globalAlpha = V.op * alpha * fade
  ctx.drawImage(spr, -rr, -rr, rr * 2, rr * 2)
  ctx.restore()
}

function drawEarth(ctx, cw, ch, dpr, st, earth) {
  const { lon0, lat0, scale, op, t, z } = st
  ctx.clearRect(0, 0, cw, ch)
  if (op <= 0.003) return

  const cx = cw / 2
  const cy = ch * lerp(0.44, 0.5, z)
  const R = Math.min(cw, ch) * 0.27 * scale
  const L0 = lon0 * RAD
  const P0 = lat0 * RAD
  const s0 = Math.sin(P0)
  const c0 = Math.cos(P0)
  const V = { cx, cy, R, op, s0, c0, sL: Math.sin(L0), cL: Math.cos(L0) }
  const sunX = cx + R * SUN[0]
  const sunY = cy - R * SUN[1]

  const proj = (lon, lat) => {
    const l = lon * RAD - L0
    const p = lat * RAD
    const sp = Math.sin(p)
    const cp = Math.cos(p)
    const cl = Math.cos(l)
    return [cx + R * cp * Math.sin(l), cy - R * (c0 * sp - s0 * cp * cl), s0 * sp + c0 * cp * cl]
  }

  // orbit ring: the back half goes behind the planet, the front half in front
  const orbit = (frontHalf) => {
    if (z >= 0.55) return
    ctx.save()
    ctx.globalAlpha = op * (1 - z / 0.55)
    ctx.translate(cx, cy)
    ctx.rotate(-0.32)
    ctx.strokeStyle = `rgba(${BLUE},.4)`
    ctx.lineWidth = Math.max(1, dpr)
    ctx.beginPath()
    ctx.ellipse(0, 0, R * 1.55, R * 0.4, 0, frontHalf ? 0 : Math.PI, frontHalf ? Math.PI : TAU)
    ctx.stroke()
    if (frontHalf) {
      const a = t * 0.6
      const sx = Math.cos(a) * R * 1.55
      const sy = Math.sin(a) * R * 0.4
      if (sy > 0 || Math.abs(sx) > R * 0.92) {
        ctx.fillStyle = `rgb(${BLUE})`
        ctx.beginPath()
        ctx.arc(sx, sy, 4.5 * dpr, 0, TAU)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  ctx.save()
  ctx.globalAlpha = op

  // soft shadow under the globe (only while it is small)
  if (z < 0.45) {
    ctx.save()
    ctx.globalAlpha = op * (1 - z / 0.45)
    ctx.translate(cx, cy + R * 1.32)
    ctx.scale(1, 0.15)
    const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.05)
    sg.addColorStop(0, 'rgba(18,18,16,.3)')
    sg.addColorStop(1, 'rgba(18,18,16,0)')
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.arc(0, 0, R * 1.05, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  orbit(false)

  // outer atmosphere glow
  const ag = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.22)
  ag.addColorStop(0, 'rgba(110,170,255,.55)')
  ag.addColorStop(0.35, 'rgba(110,170,255,.22)')
  ag.addColorStop(1, 'rgba(110,170,255,0)')
  ctx.fillStyle = ag
  ctx.beginPath()
  ctx.arc(cx, cy, R * 1.22, 0, TAU)
  ctx.fill()

  // the sphere
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, TAU)
  ctx.clip()

  // ocean, lit from the upper left
  const oc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, R * 1.8)
  oc.addColorStop(0, '#4aa0ee')
  oc.addColorStop(0.3, '#2a73c8')
  oc.addColorStop(0.62, '#124a9a')
  oc.addColorStop(1, '#06214f')
  ctx.fillStyle = oc
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2)

  // sun glint on the water
  const gx = cx + R * SUN[0] * 0.7
  const gy = cy - R * SUN[1] * 0.7
  const gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 0.34)
  gl.addColorStop(0, 'rgba(255,255,255,.45)')
  gl.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gl
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2)

  // land (real coastlines; the detailed set takes over when we zoom in)
  const smooth = scale < 2.4
  const rings = smooth ? earth.lo : earth.hi
  const landPath = new Path2D()
  for (let i = 0; i < rings.length; i++) pushRing(landPath, rings[i], V, smooth)
  ctx.lineJoin = 'round'
  ctx.lineWidth = R * 0.016
  ctx.strokeStyle = 'rgba(120,205,255,.22)' // shallow water
  ctx.stroke(landPath)
  ctx.lineWidth = R * 0.007
  ctx.strokeStyle = 'rgba(165,230,255,.35)'
  ctx.stroke(landPath)
  ctx.fillStyle = '#5a8a42'
  ctx.fill(landPath)

  // deserts, rainforest, taiga, ice
  ctx.save()
  ctx.clip(landPath)
  for (let i = 0; i < earth.biomes.length; i++) {
    const b = earth.biomes[i]
    placeSprite(ctx, b.spr, V, b.v[0], b.v[1], b.v[2], b.v[3], b.rad, b.a)
  }
  ctx.restore()

  // clouds drift slowly over the ground
  const drift = t * 0.004
  for (let i = 0; i < earth.clouds.length; i++) {
    const c = earth.clouds[i]
    const l = c.lon + drift
    placeSprite(ctx, earth.cloudSpr, V, c.sp, c.cp, Math.sin(l), Math.cos(l), c.rad, c.a)
  }
  ctx.globalAlpha = op

  // day / night: the far side falls into shadow
  const td = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, R * 1.95)
  td.addColorStop(0, 'rgba(3,10,34,0)')
  td.addColorStop(0.55, 'rgba(3,10,34,0)')
  td.addColorStop(0.72, 'rgba(3,10,34,.55)')
  td.addColorStop(0.85, 'rgba(3,10,34,.88)')
  td.addColorStop(1, 'rgba(3,10,34,.93)')
  ctx.fillStyle = td
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2)

  // city lights on the dark side
  for (let i = 0; i < earth.cities.length; i++) {
    const v = earth.cities[i]
    const cl = v[3] * V.cL + v[2] * V.sL
    const sl = v[2] * V.cL - v[3] * V.sL
    const vx = v[1] * sl
    const vy = c0 * v[0] - s0 * v[1] * cl
    const vz = s0 * v[0] + c0 * v[1] * cl
    if (vz <= 0.05) continue
    const lit = vx * SUN[0] + vy * SUN[1] + vz * SUN[2]
    const a = clamp((0.14 - lit) / 0.3) * clamp(vz * 4)
    if (a < 0.03) continue
    const rr = Math.max(3 * dpr, R * 0.02)
    ctx.globalAlpha = op * a
    ctx.drawImage(earth.warm, cx + R * vx - rr, cy - R * vy - rr, rr * 2, rr * 2)
  }
  ctx.globalAlpha = op

  // atmosphere seen from inside, brightest at the edge
  const ig = ctx.createRadialGradient(cx, cy, R * 0.72, cx, cy, R)
  ig.addColorStop(0, 'rgba(120,180,255,0)')
  ig.addColorStop(0.65, 'rgba(120,180,255,.16)')
  ig.addColorStop(1, 'rgba(150,205,255,.6)')
  ctx.fillStyle = ig
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2)
  ctx.restore()

  // rim
  ctx.lineWidth = Math.max(1, dpr)
  ctx.strokeStyle = 'rgba(150,200,255,.45)'
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, TAU)
  ctx.stroke()

  orbit(true)

  // marker on the target city
  const [mx, my, mc] = proj(TARGET.lon, TARGET.lat)
  if (mc > 0.02) {
    const k = (t * 0.8) % 1
    const ms = Math.min(2.2, 0.6 + scale * 0.35)
    ctx.strokeStyle = `rgba(200,255,46,${(1 - k) * 0.9})`
    ctx.lineWidth = Math.max(1.5, dpr * 1.6)
    ctx.beginPath()
    ctx.arc(mx, my, (7 + 26 * k) * dpr * ms, 0, TAU)
    ctx.stroke()
    ctx.fillStyle = '#c8ff2e'
    ctx.strokeStyle = '#121210'
    ctx.lineWidth = Math.max(2, dpr * 2)
    ctx.beginPath()
    ctx.arc(mx, my, 5 * dpr * ms, 0, TAU)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

/* -------------------------------------------------- static 3D world */

const Block = ({ b }) => (
  <div
    className={`bk ${b.c} v${b.v || 1} ${b.g ? 'ac' : ''} ${b.m ? 'mn' : ''}`}
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

// zebra crossings on every arm of every junction
const ZEBRA = (() => {
  const out = []
  for (let i = 1; i < XS.length - 1; i++) {
    for (let j = 1; j < YS.length - 1; j++) {
      const x = XS[i]
      const y = YS[j]
      const wx = rw(i, XS.length)
      const wy = rw(j, YS.length)
      out.push([x - wx / 2 - 24, y - wy / 2, 18, wy, 'H'], [x + wx / 2 + 6, y - wy / 2, 18, wy, 'H'])
      out.push([x - wx / 2, y - wy / 2 - 24, wx, 18, 'V'], [x - wx / 2, y + wy / 2 + 6, wx, 18, 'V'])
    }
  }
  return out
})()

const MapSvg = memo(function MapSvg({ glowRef, lineRef, dotRef }) {
  return (
    <svg className="fl-svg" viewBox={`0 0 ${MAP} ${MAP}`} width={MAP} height={MAP} aria-hidden="true">
      <defs>
        <radialGradient id="lamp">
          <stop offset="0" stopColor="#ffe2a0" stopOpacity=".35" />
          <stop offset="1" stopColor="#ffe2a0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tree" cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#7fa65a" />
          <stop offset="1" stopColor="#3f6b2c" />
        </radialGradient>
        <filter id="noise" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <pattern id="ng" width="300" height="300" patternUnits="userSpaceOnUse">
          <rect width="300" height="300" filter="url(#noise)" opacity=".5" />
        </pattern>
        <filter id="mblur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <pattern id="zebH" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="5" fill="#e9e7df" />
        </pattern>
        <pattern id="zebV" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="5" height="10" fill="#e9e7df" />
        </pattern>
      </defs>

      {/* asphalt */}
      <rect width={MAP} height={MAP} fill="#454749" />

      {/* city blocks: sidewalk, then lot (or park) */}
      {CITY.cells.map((c, i) => (
        <g key={i}>
          <rect x={c[0] - 9} y={c[1] - 9} width={c[2] + 18} height={c[3] + 18} rx="6" fill="#d6d2c8" />
          <rect x={c[0]} y={c[1]} width={c[2]} height={c[3]} rx="3" fill={c[4] ? '#9db97a' : '#bdb8ac'} />
        </g>
      ))}

      {/* centre lines on the main roads */}
      {XS.map((x, i) =>
        rw(i, XS.length) >= 44 ? (
          <line key={`vx${i}`} x1={x} y1="0" x2={x} y2={MAP} stroke="#e6e4dc" strokeOpacity=".95" strokeWidth="3" strokeDasharray="20 24" />
        ) : null,
      )}
      {YS.map((y, i) =>
        rw(i, YS.length) >= 44 ? (
          <line key={`hy${i}`} x1="0" y1={y} x2={MAP} y2={y} stroke="#e6e4dc" strokeOpacity=".95" strokeWidth="3" strokeDasharray="20 24" />
        ) : null,
      )}

      {ZEBRA.map((z, i) => (
        <rect key={`z${i}`} x={z[0]} y={z[1]} width={z[2]} height={z[3]} fill={z[4] === 'H' ? 'url(#zebH)' : 'url(#zebV)'} opacity=".85" />
      ))}

      <rect width={MAP} height={MAP} fill="url(#ng)" opacity=".22" />

      {/* trees in parks */}
      {CITY.trees.map((t, i) => (
        <g key={i}>
          <circle cx={t[0] + 6} cy={t[1] + 7} r={t[2]} fill="#121210" opacity=".22" />
          <circle cx={t[0]} cy={t[1]} r={t[2]} fill="url(#tree)" />
        </g>
      ))}


      {/* river */}
      <path d={RIVER_D} fill="none" stroke="#cbc5b6" strokeWidth="190" strokeLinecap="round" strokeLinejoin="round" />
      <path d={RIVER_D} fill="none" stroke="#6a93a6" strokeWidth="150" strokeLinecap="round" strokeLinejoin="round" />
      <path d={RIVER_D} fill="none" stroke="#5a8499" strokeOpacity=".9" strokeWidth="90" strokeLinecap="round" strokeLinejoin="round" />
      <path className="rv" d={RIVER_D} fill="none" stroke="#ffffff" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round" strokeDasharray="46 120" />

      {/* the avenue the camera follows */}
      <path d={ROUTE_D} fill="none" stroke="#d6d2c8" strokeWidth="210" strokeLinecap="round" strokeLinejoin="round" />
      <path d={ROUTE_D} fill="none" stroke="#3a3c3f" strokeWidth="150" strokeLinecap="round" strokeLinejoin="round" />
      <path d={ROUTE_D} fill="none" stroke="#e6e4dc" strokeWidth="3.5" strokeDasharray="22 22" />
      {BRIDGE && (
        <g transform={`translate(${BRIDGE.x.toFixed(1)} ${BRIDGE.y.toFixed(1)}) rotate(${BRIDGE.ang.toFixed(1)})`}>
          <rect x="-150" y="-86" width="300" height="172" fill="#cbc5b6" stroke="#6f6a5e" strokeOpacity=".5" />
          <rect x="-150" y="-66" width="300" height="132" fill="#3a3c3f" />
          <line x1="-150" y1="-80" x2="150" y2="-80" stroke="#8c867a" strokeWidth="5" />
          <line x1="-150" y1="80" x2="150" y2="80" stroke="#8c867a" strokeWidth="5" />
          <line x1="-150" y1="0" x2="150" y2="0" stroke="#e6e4dc" strokeWidth="3.5" strokeDasharray="22 22" />
        </g>
      )}

      {/* traffic */}
      <path className="cr c1" d={LANE_A} fill="none" stroke="#e9e7e1" strokeWidth="11" strokeDasharray="16 272" />
      <path className="cr c2" d={LANE_A} fill="none" stroke="#2d4f78" strokeWidth="11" strokeDasharray="16 272" />
      <path className="cr c3" d={LANE_B} fill="none" stroke="#b13b30" strokeWidth="11" strokeDasharray="16 272" />
      <path className="cr c4" d={LANE_B} fill="none" stroke="#c9c6be" strokeWidth="11" strokeDasharray="16 272" />

      {/* trees + street lamps along the avenue */}
      {AV.trees.map((t, i) => (
        <g key={i}>
          <circle cx={t[0] + 5} cy={t[1] + 6} r={t[2]} fill="#121210" opacity=".22" />
          <circle cx={t[0]} cy={t[1]} r={t[2]} fill="url(#tree)" />
        </g>
      ))}
      {AV.lamps.map((l, i) => (
        <g key={i}>
          <circle cx={l[0]} cy={l[1]} r="40" fill="url(#lamp)" />
          <circle cx={l[0]} cy={l[1]} r="4" fill="#2b2d30" stroke="#9a968c" strokeWidth="2" />
        </g>
      ))}

      {/* the glowing route that is drawn as you scroll */}
      <path ref={glowRef} d={ROUTE_D} pathLength="1" fill="none" stroke="#c8ff2e" strokeWidth="26" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset="1" filter="url(#mblur)" opacity=".75" />
      <path ref={lineRef} d={ROUTE_D} pathLength="1" fill="none" stroke="#c8ff2e" strokeWidth="8" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset="1" />
      <circle ref={dotRef} r="22" fill="#c8ff2e" stroke="#121210" strokeWidth="7" cx={WP[0][0]} cy={WP[0][1]} />
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
  const camRef = useRef(null)
  const worldRef = useRef(null)
  const globeRef = useRef(null)
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
  const [idx, setIdx] = useState(-1) // -1 globe/intro, 0..4 chapter, 5 outro

  useEffect(() => {
    const sec = secRef.current
    const stage = stageRef.current
    const world = worldRef.current
    const camEl = camRef.current
    const cv = globeRef.current
    const ctx = cv.getContext('2d')
    const svg = world.querySelector('.fl-svg')
    const sc = sec.closest('.page')
    if (!sc) return

    const earth = buildEarth()
    let dpr = 1
    let cw = 0
    let ch = 0
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      cw = Math.round(stage.clientWidth * dpr)
      ch = Math.round(stage.clientHeight * dpr)
      cv.width = cw
      cv.height = ch
    }

    let p = 0
    const readP = () => {
      const range = Math.max(1, sec.offsetHeight - stage.offsetHeight)
      p = warpP(clamp((sc.scrollTop - sec.offsetTop) / range))
    }
    const onResize = () => {
      resize()
      readP()
    }
    sc.addEventListener('scroll', readP, { passive: true })
    window.addEventListener('resize', onResize)
    resize()
    readP()

    const cam = { cx: MAP / 2, cy: MAP / 2, rz: 0, tilt: 0, dz: -2100, u: 0, sx: 0, sy: 0 }
    let lastHs = -1
    let raf
    let last = performance.now()

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000

      /* ---- phase 1: the globe */
      const z = Math.pow(clamp((p - 0.02) / 0.18), 2.2)
      const e = smooth(clamp(p / 0.16))
      const auto = -20 + t * 7
      const lon0 = auto + wrap(TARGET.lon - auto) * e
      const lat0 = lerp(16, TARGET.lat, e)
      const gop = 1 - smooth(clamp((p - 0.15) / 0.07))
      drawEarth(ctx, cw, ch, dpr, { lon0, lat0, scale: 1 + 6 * z, op: gop, t, z }, earth)

      /* ---- phase 2: streets spread out from the centre, buildings rise */
      camEl.style.opacity = smooth(clamp((p - 0.1) / 0.1)).toFixed(3)
      const rev = smooth(clamp((p - 0.1) / 0.13)) * 2400
      svg.style.clipPath = `circle(${rev.toFixed(0)}px at 1500px 1500px)`
      const hs = smooth(clamp((p - 0.16) / 0.14))
      if (Math.abs(hs - lastHs) > 0.004 || ((hs === 0 || hs === 1) && hs !== lastHs)) {
        world.style.setProperty('--hs', hs.toFixed(3))
        lastHs = hs
      }

      /* ---- phase 3: dive in and fly along the avenue */
      const dive = smooth(clamp((p - 0.2) / 0.1))
      const outro = smooth(clamp((p - 0.93) / 0.07))
      const q = clamp((p - 0.3) / 0.63)
      const seg = q * 4
      const i = Math.min(3, Math.floor(seg))
      const uT = q >= 1 ? 4 : i + smooth(seg - i) // lingers at every waypoint
      const [rx, ry] = routePoint(uT)
      const [ax, ay] = routePoint(Math.min(4, uT + 0.05))
      const [bx, by] = routePoint(Math.max(0, uT - 0.05))
      const heading = (-Math.atan2(ax - bx, -(ay - by)) * 180) / Math.PI

      let tx = lerp(MAP / 2, rx, dive)
      let ty = lerp(MAP / 2, ry, dive)
      let tilt = lerp(0, 57 + Math.sin(uT * 2.1) * 3, dive)
      let dz = lerp(-2100, 110 + Math.sin(uT * 1.7) * 60, dive)
      let rz = heading * dive
      tx = lerp(tx, 1420, outro)
      ty = lerp(ty, 1640, outro)
      tilt = lerp(tilt, 34, outro)
      dz = lerp(dz, -1150, outro)
      rz = lerp(rz, -12, outro)
      rz = cam.rz + wrap(rz - cam.rz)

      // ease the real camera toward it (this is the cinematic inertia)
      const k = 1 - Math.exp(-dt * 5)
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

      // route drawing + beacon
      const off = (1 - arcAt(cam.u) * dive).toFixed(4)
      if (glowRef.current) glowRef.current.style.strokeDashoffset = off
      if (lineRef.current) lineRef.current.style.strokeDashoffset = off
      if (dotRef.current) {
        const [dx, dy] = routePoint(cam.u)
        dotRef.current.setAttribute('cx', dx.toFixed(1))
        dotRef.current.setAttribute('cy', dy.toFixed(1))
        dotRef.current.style.opacity = dive.toFixed(2)
      }

      // overlays
      const introOp = 1 - clamp(p / 0.06)
      if (introRef.current) {
        introRef.current.style.opacity = introOp.toFixed(3)
        introRef.current.style.transform = `translate3d(0,${(-p * 500).toFixed(1)}px,0)`
        introRef.current.style.pointerEvents = introOp > 0.4 ? 'auto' : 'none'
      }
      const outroOp = clamp((p - 0.955) / 0.04)
      if (outroRef.current) {
        outroRef.current.style.opacity = outroOp.toFixed(3)
        outroRef.current.style.pointerEvents = outroOp > 0.5 ? 'auto' : 'none'
      }
      const d = Math.abs(cam.u - Math.round(cam.u))
      const phase = clamp((p - 0.29) / 0.03) * (1 - clamp((p - 0.935) / 0.02))
      const capOp = clamp((0.4 - d) / 0.2) * phase
      if (capRef.current) {
        capRef.current.style.opacity = capOp.toFixed(3)
        capRef.current.style.transform = `translate3d(0,${((1 - capOp) * 24).toFixed(1)}px,0)`
      }

      // HUD
      if (progRef.current) progRef.current.style.transform = `scaleX(${p.toFixed(4)})`
      if (coordRef.current) {
        coordRef.current.textContent =
          p < 0.2
            ? `LAT ${lat0.toFixed(2)}°  ·  LON ${wrap(lon0).toFixed(2)}°  ·  ORBIT`
            : `X ${String(Math.round(cam.cx)).padStart(4, '0')}  ·  Y ${String(Math.round(cam.cy)).padStart(4, '0')}  ·  ALT ${String(Math.round(2100 + cam.dz)).padStart(4, '0')}`
      }

      // which chapter is on screen
      const a = p < 0.29 ? -1 : p > 0.94 ? 5 : Math.round(cam.u)
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
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const goChapter = (i) => {
    const sec = secRef.current
    const sc = sec.closest('.page')
    const range = sec.offsetHeight - stageRef.current.offsetHeight
    sc.scrollTo({ top: sec.offsetTop + range * unwarpP(0.3 + (i / 4) * 0.63), behavior: 'smooth' })
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

          <div className="fl-cam" ref={camRef}>
            <div className="fl-world" ref={worldRef} style={WINVARS}>
              <MapSvg glowRef={glowRef} lineRef={lineRef} dotRef={dotRef} />
              <Blocks />
              <Pins active={idx} />
            </div>
          </div>

          <div className="fl-fog" />
          <div className="fl-pool" />
          <div className="fl-dof" />
          <canvas className="fl-globe" ref={globeRef} aria-hidden="true" />
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
            <p className="fl-sub">From the whole world down to one street: the five places a piece passes before it reaches the rack.</p>
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
              <a className="lux-btn solid" href="#/shop">
                Shop the drop
              </a>
              <a className="lux-btn" href="#/lookbook">
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
