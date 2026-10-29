import Title3D from './Title3D.jsx'
import { LINKS } from '../lib/router'

export default function Footer() {
  return (
    <footer className="foot" data-reveal>
      <Title3D text="Fancy Clothes" as="p" className="foot-title" />
      <div className="foot-cols">
        <div>
          <h4>Pages</h4>
          <a href="#/">Home</a>
          {LINKS.map(([p, l]) => (
            <a key={p} href={`#${p}`}>
              {l}
            </a>
          ))}
        </div>
        <div>
          <h4>Help</h4>
          <a href="#/contact">Sizing</a>
          <a href="#/contact">Shipping</a>
          <a href="#/contact">Returns</a>
        </div>
        <div>
          <h4>About this site</h4>
          <p>A front-end sample: nothing is sold, nothing ships, no payment is taken.</p>
        </div>
      </div>
      <p className="foot-small">© 2026 Fancy Clothes — built with React, JavaScript and CSS 3D.</p>
    </footer>
  )
}
