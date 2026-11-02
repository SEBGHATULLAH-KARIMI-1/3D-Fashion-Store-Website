import { memo, useEffect, useRef, useState } from 'react'
import earthImg from '../earth.jpg'
import Footer from '../components/Footer.jsx'
import { img } from '../data/products'
import { useReveal } from '../lib/useReveal'

/* ================================================================
   About — "The Atelier, mapped"
   1. A globe (the photo in src/earth.jpg) zooms toward a city (scroll).
   2. Streets spread out from the centre, buildings rise.
   3. The camera dives in and flies along an avenue through five
      places a piece passes through.
   White + one blue accent.
================================================================ */

const MAP = 3000 // map is MAP x MAP px; 1 map unit = 1 css px
const STEPS = 220
const SCROLL_SCREENS = 7.5 // how many screens tall the whole thing is
const TARGET = { lon: 2.3522, lat: 48.8566 } // where the globe lands

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
    .filter((l) => l.dR < 1050)
    .sort((a, b) => a.dR - b.dR)
    .slice(0, 105)
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
    if (c === 'a' && l.dR < 700) {
      // zinc mansard roof: the Paris skyline (only near the route, where it can be seen)
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
  return Array.from({ length: 14 }, () => ({
    x: r() * 100,
    y: r() * 100,
    s: 1.5 + r() * 2.6,
    d: -r() * 14,
    t: 9 + r() * 12,
  }))
})()

/* ------------------------------------------------------------ globe */
// The globe is the photo in src/earth.jpg, cropped to a circle in CSS (see .fl-orb in about.css).
// Its centre and radius inside the 736 x 1104 photo are baked into the CSS percentages.
// Paris sits a little above and left of the globe's centre, so the zoom aims there:
const PARIS_ON_GLOBE = [-0.0225, -0.195] // offset from the globe centre, in globe diameters
const FLOATERS = [
  // [product image, left %, top % (of the globe box), width %, tilt deg, float delay s]
  ['tank-black', -4, 22, 17, -10, 0],
  ['its-us-tee-bubblegum', 98, 6, 17, 9, -2],
  ['jersey-yellow', -16, 76, 17, -7, -4],
  ['varsity', 94, 74, 18, 8, -6],
]

// The photo is drawn on a sphere with a tiny WebGL shader, so the globe can turn gently.
// It sways about +-18 degrees: the photo only shows one side of the Earth, so a full spin would
// run out of picture. If WebGL is missing, the plain <img> inside the globe stays visible.
// Centre and radius of the globe inside the 736 x 1104 photo (a little inside the real rim):
const PHOTO = { cx: 366, cy: 553, r: 306 }
const GLOBE_VS = 'attribute vec2 aP;varying vec2 vP;void main(){vP=aP;gl_Position=vec4(aP,0.0,1.0);}'
const GLOBE_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vP;
uniform sampler2D uTex;
uniform float uAng;
uniform vec2 uC;
uniform vec2 uR;
void main(){
  float r2 = dot(vP, vP);
  float z = sqrt(max(0.0, 1.0 - r2));
  float c = cos(uAng);
  float s = sin(uAng);
  vec2 q = vec2(vP.x * c + z * s, vP.y);
  float rho = length(q);
  if (rho > 0.96) q *= (0.96 - (rho - 0.96)) / rho;
  vec3 col = texture2D(uTex, uC + vec2(q.x * uR.x, -q.y * uR.y)).rgb;
  vec3 L = normalize(vec3(-0.45, 0.42, 0.78));
  float d = clamp(dot(vec3(vP, z), L), 0.0, 1.0);
  col *= 0.82 + 0.30 * d;
  float rim = clamp((sqrt(r2) - 0.75) / 0.25, 0.0, 1.0);
  rim *= rim;
  col = col * (1.0 - 0.2 * rim) + vec3(0.35, 0.6, 1.0) * 0.25 * rim;
  gl_FragColor = vec4(col, 1.0);
}`

function makeGlobe(canvas, src, onReady) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true }) || canvas.getContext('experimental-webgl')
  if (!gl) return null
  const compile = (type, code) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, code)
    gl.compileShader(s)
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
  }
  const vs = compile(gl.VERTEX_SHADER, GLOBE_VS)
  const fs = compile(gl.FRAGMENT_SHADER, GLOBE_FS)
  if (!vs || !fs) return null
  const prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aP = gl.getAttribLocation(prog, 'aP')
  gl.enableVertexAttribArray(aP)
  gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0)
  const uAng = gl.getUniformLocation(prog, 'uAng')
  const uC = gl.getUniformLocation(prog, 'uC')
  const uR = gl.getUniformLocation(prog, 'uR')
  let ready = false
  const photo = new Image()
  photo.onload = () => {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, photo)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const w = photo.naturalWidth
    const h = photo.naturalHeight
    gl.uniform2f(uC, PHOTO.cx / w, PHOTO.cy / h)
    gl.uniform2f(uR, PHOTO.r / w, PHOTO.r / h)
    ready = true
    onReady()
  }
  photo.src = src
  return {
    resize(px) {
      if (canvas.width !== px) {
        canvas.width = px
        canvas.height = px
      }
    },
    draw(ang) {
      if (!ready) return
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform1f(uAng, ang)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
  }
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
    {!b.z && b.h > 70 && <i className="sd" />}
    <i className="t" />
    <i className="s" />
    <i className="n" />
    <i className="e" />
    <i className="w" />
  </div>
)

// Buildings grow by scaling this one wrapper along Z (a single transform per frame),
// instead of re-laying-out the five faces of every building.
const Blocks = memo(function Blocks({ cityRef }) {
  return (
    <div className="fl-city" ref={cityRef}>
      {BLOCKS.map((b, i) => (
        <Block key={i} b={b} />
      ))}
    </div>
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

// The big static map: painted once, never touched again.
const MapSvg = memo(function MapSvg() {
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

      {/* (the film grain that used to be an feTurbulence filter here is the CSS .fl-grain layer now) */}

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

    </svg>
  )
})

// Everything that moves (river glints, traffic, the glowing route, the beacon) lives in
// its own transparent layer, so repainting it never touches the big map underneath.
const RouteSvg = memo(function RouteSvg({ routeRef, dotRef }) {
  return (
    <svg ref={routeRef} className="fl-svg" viewBox={`0 0 ${MAP} ${MAP}`} width={MAP} height={MAP} aria-hidden="true">
      <path className="rv" d={RIVER_D} fill="none" stroke="#ffffff" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round" strokeDasharray="46 120" />

      {/* traffic */}
      <path className="cr c1" d={LANE_A} fill="none" stroke="#e9e7e1" strokeWidth="11" strokeDasharray="16 272" />
      <path className="cr c2" d={LANE_A} fill="none" stroke="#2d4f78" strokeWidth="11" strokeDasharray="16 272" />
      <path className="cr c3" d={LANE_B} fill="none" stroke="#b13b30" strokeWidth="11" strokeDasharray="16 272" />
      <path className="cr c4" d={LANE_B} fill="none" stroke="#c9c6be" strokeWidth="11" strokeDasharray="16 272" />

      {/* the glowing route that is drawn as you scroll. The glow is two wide, soft strokes
          (no blur filter); the dash offset comes from the --off variable set in the tick. */}
      <path className="rt" d={ROUTE_D} pathLength="1" fill="none" stroke="#c8ff2e" strokeOpacity=".16" strokeWidth="46" strokeLinecap="round" strokeDasharray="1 1" />
      <path className="rt" d={ROUTE_D} pathLength="1" fill="none" stroke="#c8ff2e" strokeOpacity=".3" strokeWidth="28" strokeLinecap="round" strokeDasharray="1 1" />
      <path className="rt" d={ROUTE_D} pathLength="1" fill="none" stroke="#c8ff2e" strokeWidth="8" strokeLinecap="round" strokeDasharray="1 1" />
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
  const earthRef = useRef(null)
  const orbRef = useRef(null)
  const glRef = useRef(null)
  const airRef = useRef(null)
  const ringRef = useRef(null)
  const routeRef = useRef(null)
  const cityRef = useRef(null)
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
    const earthEl = earthRef.current
    const orbEl = orbRef.current
    const airEl = airRef.current
    const ringEl = ringRef.current
    const globe = makeGlobe(glRef.current, earthImg, () => orbEl.classList.add('gl'))
    const maps = world.querySelectorAll('.fl-svg') // the static map + the moving overlay
    const city = cityRef.current
    const routeSvg = routeRef.current
    const pinEls = world.querySelectorAll('.pin-bb')
    const sc = sec.closest('.page')
    if (!sc) return

    let orbD = 500 // diameter of the globe in px (measured in resize)
    let range = 1
    let secTop = 0
    let dirty = true // something outside the tick changed: the next frame must redraw
    const resize = () => {
      orbD = orbEl.offsetWidth || 500
      if (globe) globe.resize(Math.round(orbD * Math.min(1.5, window.devicePixelRatio || 1)))
      // measured here, not on every scroll event (reading layout while scrolling is costly)
      range = Math.max(1, sec.offsetHeight - stage.offsetHeight)
      secTop = sec.offsetTop
      dirty = true
    }

    let p = 0
    const readP = () => {
      p = warpP(clamp((sc.scrollTop - secTop) / range))
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
    let lastP = -1
    let lastEarth = ''
    let lastCoord = ''
    let lastGlobeDraw = 0
    let lastCam = ''
    let lastClip = ''
    let lastRun = null
    let lastGrown = null
    let lastOff = ''
    let lastDotOn = false
    let lastHud = ''
    let wasLive = true
    let raf
    let last = performance.now()

    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      /* ---- where everything wants to be right now (maths only, nothing is written yet) */
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

      // Has the scroll stopped and the camera caught up with its target? Then nothing
      // has to be written to the DOM this frame (only the globe keeps turning).
      const err =
        Math.abs(tx - cam.cx) +
        Math.abs(ty - cam.cy) +
        Math.abs(dz - cam.dz) +
        (Math.abs(tilt - cam.tilt) + Math.abs(rz - cam.rz)) * 10 +
        Math.abs(uT - cam.u) * 100 +
        (Math.abs(ptr.current.x - cam.sx) + Math.abs(ptr.current.y - cam.sy)) * 500
      const settled = !dirty && p === lastP && err < 0.02

      /* ---- phase 1: the globe (the photo) zooms toward Paris, then fades into the city */
      const gop = 1 - smooth(clamp((p - 0.15) / 0.07))
      const live = gop > 0.003
      if (live || wasLive) {
        const z = Math.pow(clamp((p - 0.02) / 0.18), 2.2)
        const e = smooth(clamp(p / 0.16))
        const gs = 1 + 4.6 * z
        // the globe turns gently (a slow sway); it settles as the zoom starts so Paris is where we aim
        if (globe && live && (!settled || now - lastGlobeDraw > 33)) {
          const amp = 0.31 * (1 - smooth(clamp(p / 0.08)))
          globe.draw(Math.sin(now * 0.00022449) * amp)
          lastGlobeDraw = now
        }
        // scale around the centre, and slide so that Paris ends up in the middle
        const gx = -gs * PARIS_ON_GLOBE[0] * orbD * e
        const gy = -gs * PARIS_ON_GLOBE[1] * orbD * e
        const earthT = `translate3d(${gx.toFixed(1)}px,${gy.toFixed(1)}px,0) scale(${gs.toFixed(3)})`
        const key = `${earthT}|${gop.toFixed(3)}|${live}`
        if (key !== lastEarth) {
          lastEarth = key
          earthEl.style.transform = earthT
          earthEl.style.opacity = gop.toFixed(3)
          earthEl.style.visibility = live ? 'visible' : 'hidden'
          airEl.style.opacity = gop.toFixed(3)
          airEl.style.visibility = live ? 'visible' : 'hidden'
          // the ring and the floating pieces melt away early in the zoom
          ringEl.style.opacity = (1 - clamp(z / 0.3)).toFixed(3)
        }
        wasLive = live
        if (live && p < 0.2 && coordRef.current) {
          const lat = lerp(34.6937, TARGET.lat, e)
          const lon = lerp(135.5023, TARGET.lon, e)
          const txt = `LAT ${lat.toFixed(4)}°  ·  LON ${lon.toFixed(4)}°  ·  ORBIT ${gs.toFixed(1)}`
          if (txt !== lastCoord) {
            coordRef.current.textContent = txt
            lastCoord = txt
          }
        }
      }

      if (settled) return
      lastP = p
      dirty = false

      /* ---- phase 2: streets spread out from the centre, buildings rise */
      // the 3D city is not even drawn until it starts to fade in (it is thousands of faces)
      const camOp = smooth(clamp((p - 0.1) / 0.1))
      const camKey = camOp.toFixed(3)
      if (camKey !== lastCam) {
        camEl.style.opacity = camKey
        camEl.style.visibility = camOp > 0.002 ? 'visible' : 'hidden'
        lastCam = camKey
      }
      const rev = smooth(clamp((p - 0.1) / 0.13)) * 2400
      // once the whole map is revealed the clip is removed (a clip mask costs on every frame)
      const clip = rev >= 2399 ? 'none' : `circle(${rev.toFixed(0)}px at 1500px 1500px)`
      if (clip !== lastClip) {
        for (let n = 0; n < maps.length; n++) maps[n].style.clipPath = clip
        lastClip = clip
      }
      const hs = smooth(clamp((p - 0.16) / 0.14))
      if (Math.abs(hs - lastHs) > 0.004 || ((hs === 0 || hs === 1) && hs !== lastHs)) {
        // one transform on the wrapper grows every building at once
        city.style.transform = `scale3d(1,1,${Math.max(hs, 0.0001).toFixed(4)})`
        lastHs = hs
      }
      const grown = hs > 0.6
      if (grown !== lastGrown) {
        city.classList.toggle('grown', grown) // fades the ground shadows in
        lastGrown = grown
      }
      // river glints and traffic only animate while the city is on screen
      const run = p > 0.2 && p < 0.97
      if (run !== lastRun) {
        world.classList.toggle('run', run)
        lastRun = run
      }

      /* ---- phase 3: dive in and fly along the avenue (the targets were worked out above) */

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
      // the pin labels counter-rotate to face the camera. Set on the five pins directly:
      // custom properties on the world would be inherited by every building face.
      const pinT = `rotateZ(${(-rzE).toFixed(2)}deg) rotateX(${(-tiltE).toFixed(2)}deg)`
      for (let n = 0; n < pinEls.length; n++) pinEls[n].style.transform = pinT

      // route drawing + beacon
      const off = (1 - arcAt(cam.u) * dive).toFixed(4)
      if (off !== lastOff) {
        routeSvg.style.setProperty('--off', off)
        lastOff = off
      }
      const dotOn = dive > 0.001
      if (dotRef.current && (dotOn || lastDotOn)) {
        const [dx, dy] = routePoint(cam.u)
        dotRef.current.setAttribute('cx', dx.toFixed(1))
        dotRef.current.setAttribute('cy', dy.toFixed(1))
        dotRef.current.style.opacity = dive.toFixed(2)
      }
      lastDotOn = dotOn

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
      if (coordRef.current && p >= 0.2) {
        const txt = `X ${String(Math.round(cam.cx)).padStart(4, '0')}  ·  Y ${String(Math.round(cam.cy)).padStart(4, '0')}  ·  ALT ${String(Math.round(2100 + cam.dz)).padStart(4, '0')}`
        if (txt !== lastHud) {
          coordRef.current.textContent = txt
          lastHud = txt
        }
      }

      // which chapter is on screen
      const a = p < 0.29 ? -1 : p > 0.94 ? 5 : Math.round(cam.u)
      if (a !== idxRef.current) {
        idxRef.current = a
        setIdx(a)
      }
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

          <div className="fl-cam" ref={camRef} style={{ opacity: 0, visibility: 'hidden' }}>
            <div className="fl-world" ref={worldRef} style={WINVARS}>
              <MapSvg />
              <RouteSvg routeRef={routeRef} dotRef={dotRef} />
              <Blocks cityRef={cityRef} />
              <Pins active={idx} />
            </div>
          </div>

          <div className="fl-fog" />
          <div className="fl-pool" />
          <div className="fl-air" ref={airRef} aria-hidden="true">
            <svg className="fl-arc a" viewBox="0 0 800 600" preserveAspectRatio="none">
              <path d="M-10 560 C 60 300 380 70 810 30" />
            </svg>
            <svg className="fl-arc b" viewBox="0 0 800 600" preserveAspectRatio="none">
              <path d="M810 140 C 560 190 300 380 120 620" />
            </svg>
            <i className="fl-cloud l" />
            <i className="fl-cloud r" />
          </div>

          <div className="fl-earth" ref={earthRef} aria-hidden="true">
            <div className="fl-shadow" />
            <div className="fl-glow" />
            <div className="fl-orb" ref={orbRef}>
              <img src={earthImg} alt="" draggable="false" />
              <canvas className="fl-gl" ref={glRef} />
            </div>
            <div className="fl-ringwrap" ref={ringRef}>
              <svg className="fl-ring" viewBox="0 0 1000 320">
                <defs>
                  <radialGradient id="bead" cx="35%" cy="30%" r="75%">
                    <stop offset="0" stopColor="#f3f7b8" />
                    <stop offset="0.55" stopColor="#b4c63a" />
                    <stop offset="1" stopColor="#6f7f12" />
                  </radialGradient>
                </defs>
                <ellipse cx="500" cy="160" rx="495" ry="155" fill="none" stroke="#8d9a1f" strokeOpacity=".75" strokeWidth="2" />
                {[
                  [118, 11],
                  [-35, 9],
                  [-12, 6],
                ].map(([deg, rad]) => (
                  <circle
                    key={deg}
                    cx={500 + 495 * Math.cos((deg * Math.PI) / 180)}
                    cy={160 + 155 * Math.sin((deg * Math.PI) / 180)}
                    r={rad}
                    fill="url(#bead)"
                  />
                ))}
              </svg>
              {FLOATERS.map(([slug, l, t, w, rot, delay]) => (
                <img
                  key={slug}
                  className="fl-floater"
                  src={img(slug, 'front')}
                  alt=""
                  draggable="false"
                  decoding="async"
                  style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, '--rot': `${rot}deg`, animationDelay: `${delay}s` }}
                />
              ))}
            </div>
          </div>
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
            <div className="fl-titlebox">
              <h1 className="fl-brand" aria-label="Fancy Clothes">
                Fancy Cl<span className="fl-o">o<b aria-hidden="true" /></span>thes
              </h1>
              <p className="fl-sub">
                <i aria-hidden="true" />
                <span>A world of style, curated for you.</span>
                <i aria-hidden="true" />
              </p>
            </div>
            <button type="button" className="fl-enter" onClick={() => goChapter(0)}>
              <em aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 2v10M3 8l4 4 4-4" />
                </svg>
              </em>
              <span>
                <u />
                Scroll to explore
                <u />
              </span>
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
                <li key={x.place} className={idx === i || (idx < 0 && i === 0) ? 'on' : ''}>
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
