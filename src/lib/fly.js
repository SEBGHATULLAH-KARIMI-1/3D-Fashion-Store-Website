// Fly a ghost copy of the product from `fromEl` into the bag button, with a 3D spin.
export function flyTo(fromEl, toEl, src) {
  if (!fromEl || !toEl || !fromEl.animate) return
  const a = fromEl.getBoundingClientRect()
  const b = toEl.getBoundingClientRect()
  const ghost = document.createElement('img')
  ghost.src = src
  ghost.alt = ''
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${a.left}px`,
    top: `${a.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
    objectFit: 'contain',
    zIndex: 999,
    pointerEvents: 'none',
    transformOrigin: '50% 50%',
    filter: 'drop-shadow(0 18px 20px rgba(0,0,0,.25))',
  })
  document.body.appendChild(ghost)

  const dx = b.left + b.width / 2 - (a.left + a.width / 2)
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  const end = Math.max(0.05, Math.min(0.12, b.width / a.width))
  const p = 'perspective(900px)'

  const anim = ghost.animate(
    [
      { transform: `${p} translate(0,0) scale(1) rotateY(0deg)`, opacity: 1 },
      {
        transform: `${p} translate(${dx * 0.35}px, ${dy * 0.25 - 90}px) scale(0.55) rotateY(200deg) rotateZ(-8deg)`,
        opacity: 1,
        offset: 0.5,
      },
      { transform: `${p} translate(${dx}px, ${dy}px) scale(${end}) rotateY(380deg) rotateZ(0deg)`, opacity: 0.15 },
    ],
    { duration: 850, easing: 'cubic-bezier(.55,0,.25,1)' },
  )
  anim.onfinish = () => ghost.remove()
  anim.oncancel = () => ghost.remove()
}
