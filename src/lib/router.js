import { useEffect, useState } from 'react'

// Tiny hash router: #/shop, #/lookbook, ... No dependency needed.
export const LINKS = [
  ['/shop', 'Shop'],
  ['/lookbook', 'Lookbook'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
]
const VALID = ['/', ...LINKS.map(([p]) => p)]

const read = () => {
  const h = window.location.hash.replace(/^#/, '')
  return VALID.includes(h) ? h : '/'
}

export function useRoute() {
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
