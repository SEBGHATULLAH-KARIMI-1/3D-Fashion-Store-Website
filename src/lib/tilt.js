// Pointer-driven 3D tilt. Spread onto a wrapper; inner elements read
// --rx / --ry (rotation) and --gx / --gy (glare position) from CSS.
export const tilt = (max = 12) => ({
  onPointerMove(e) {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty('--ry', `${((x - 0.5) * 2 * max).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${((0.5 - y) * 2 * max).toFixed(2)}deg`)
    el.style.setProperty('--gx', `${(x * 100).toFixed(0)}%`)
    el.style.setProperty('--gy', `${(y * 100).toFixed(0)}%`)
  },
  onPointerLeave(e) {
    const el = e.currentTarget
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--gx', '50%')
    el.style.setProperty('--gy', '50%')
  },
})
