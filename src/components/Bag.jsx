import { img, money } from '../data/products'

export default function Bag({ open, items, count, total, onClose, onQty, onCheckout }) {
  return (
    <>
      <div className={`bag-scrim ${open ? 'on' : ''}`} onClick={onClose} />
      <aside className={`bag ${open ? 'on' : ''}`} aria-hidden={!open} aria-label="Shopping bag">
        <header className="bag-head">
          <h3>
            Your bag <span>({count})</span>
          </h3>
          <button type="button" className="bag-close" onClick={onClose} aria-label="Close bag" tabIndex={open ? 0 : -1}>
            ✕
          </button>
        </header>

        {items.length === 0 ? (
          <p className="bag-empty">Nothing here yet.<br />Pick something off the rack.</p>
        ) : (
          <ul className="bag-list">
            {items.map((it, i) => (
              <li key={it.key} className="bag-item" style={{ '--n': i }}>
                <div className="bag-thumb">
                  <img src={img(it.slug, 'front')} alt="" draggable="false" />
                </div>
                <div className="bag-info">
                  <b>{it.name}</b>
                  <span>{it.label} · {it.size}</span>
                  <div className="qty">
                    <button type="button" onClick={() => onQty(it.key, -1)} aria-label="Less" tabIndex={open ? 0 : -1}>−</button>
                    <i>{it.qty}</i>
                    <button type="button" onClick={() => onQty(it.key, 1)} aria-label="More" tabIndex={open ? 0 : -1}>+</button>
                  </div>
                </div>
                <b className="bag-price">{money(it.price * it.qty)}</b>
              </li>
            ))}
          </ul>
        )}

        <footer className="bag-foot">
          <div className="bag-total">
            <span>Total</span>
            <b>{money(total)}</b>
          </div>
          <button type="button" className="checkout" disabled={!items.length} onClick={onCheckout} tabIndex={open ? 0 : -1}>
            Checkout (demo)
          </button>
        </footer>
      </aside>
    </>
  )
}
