import { BRAND } from '../data/products'
import { LINKS } from '../lib/router'

export default function Header({
  route,
  view,
  onView,
  inFocus,
  onBack,
  onNavigate,
  count,
  onBag,
  menuOpen,
  onMenu,
}) {
  return (
    <header className="site-header">
      <div className="hd-left">
        {inFocus ? (
          <button type="button" className="back" onClick={onBack}>
            <span aria-hidden="true">←</span> Back
          </button>
        ) : route === '/' ? (
          <div className="vsw" role="group" aria-label="View">
            <div className="vsw-knob" style={{ transform: view === 'orbit' ? 'translateX(100%)' : 'none' }} />
            <button type="button" className={view === 'rack' ? 'lit' : ''} onClick={() => onView('rack')}>
              Rack
            </button>
            <button type="button" className={view === 'orbit' ? 'lit' : ''} onClick={() => onView('orbit')}>
              Orbit
            </button>
          </div>
        ) : (
          <a className="back" href="#/" onClick={onNavigate}>
            <span aria-hidden="true">←</span> Home
          </a>
        )}
      </div>

      <a href="#/" className="wordmark" onClick={onNavigate} aria-label={BRAND.name}>
        <span>Fancy</span>
        <span>Clothes</span>
      </a>

      <div className="hd-right">
        <nav className="nav" aria-label="Main">
          {LINKS.map(([p, l]) => (
            <a
              key={p}
              href={`#${p}`}
              className={`nav-link ${route === p ? 'on' : ''}`}
              onClick={onNavigate}
              aria-current={route === p ? 'page' : undefined}
            >
              <span>{l}</span>
              <span aria-hidden="true">{l}</span>
            </a>
          ))}
        </nav>

        <button type="button" id="bag-btn" className="bag-btn" onClick={onBag} aria-label={`Bag, ${count} items`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M2.5 5.5h11l-.8 8h-9.4l-.8-8Z" />
            <path d="M5.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" strokeLinecap="round" />
          </svg>
          <span>Bag</span>
          <i key={count} className={count ? 'has' : ''}>
            {count}
          </i>
        </button>

        <button
          type="button"
          className={`menu-btn ${menuOpen ? 'on' : ''}`}
          onClick={onMenu}
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <i />
          <i />
        </button>
      </div>
    </header>
  )
}
