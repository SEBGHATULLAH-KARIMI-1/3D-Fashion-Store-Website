# Fancy Clothes — 3D store sample (React + JS + CSS)

Plain **React + JavaScript + CSS** with Vite. No Tailwind, no Next.js, no 3D library:
all the 3D is real CSS 3D (`perspective`, `preserve-3d`, `rotateY`, `translateZ`) driven by small `requestAnimationFrame` physics loops.
No external links anywhere. Routing is a tiny hash router (`#/shop`, `#/lookbook`, …) with no dependency.

## Run

You need [Node.js](https://nodejs.org) 18+. Then, in this folder:

```bash
npm install
npm run dev
```

Or double-click `start-react.bat`. The site opens at http://localhost:5173.
`npm run dev` first copies the product photos out of `../site/_next` into `public/products/`, so keep `react-app` next to the old `site` folder.

Production build: `npm run build` → `dist/`, preview with `npm run preview`.

## Pages

| Page | Route | 3D highlights |
|---|---|---|
| **Home** | `#/` | **Rack**: garments swing like pendulums, turn to face you on hover, scene tilts with the mouse. **Orbit**: 3D cylinder carousel with reflections. |
| **Shop** | `#/shop` | Tilting 3D cards with glare, front→side flip on hover, filter + sort chips, colour dots, quick-add with fly-to-bag |
| **Lookbook** | `#/lookbook` | Scroll flies the camera forward through 7 looks along the z axis |
| **About** | `#/about` | Rotating cube, count-up stats, tilting timeline cards, fabric swatches that fan out |
| **Contact** | `#/contact` | Form card that flips over on send (with validation), tilting info tiles, FAQ accordion that unfolds in 3D |
| **Product view** | opens from anywhere | Drag-to-spin turntable with inertia, fake thickness, moving sheen, floor shadow, size/colour, add to bag |
| **Bag** | header button | Drawer that swings in, quantities, demo checkout |

On mobile (<980px) the header links collapse into a 3D-flip menu.
Keyboard: `Esc` closes things, `← →` change product (or spin the orbit).

## Where things are

| File | What it does |
|---|---|
| `src/data/products.js` | Brand text, products, prices, colours. **Start here.** |
| `src/App.jsx` | Routing, product view, bag state, menu |
| `src/pages/*.jsx` | Shop, Lookbook, About, Contact |
| `src/components/*.jsx` | Rack, Orbit, Focus (turntable), Bag, Header, Footer, `Title3D` (extruded headline) |
| `src/lib/` | `router.js`, `useReveal.js` (scroll reveal), `tilt.js` (pointer tilt), `fly.js` (fly-to-bag) |
| `src/styles.css` | Shell, header, rack, orbit, product view, bag |
| `src/pages.css` | Navigation, pages, 3D components, footer |

## Notes

- Garments on the rack show the **side** photo; hovering turns them to the **front** photo. The old copy never saved a "back" photo.
- Four colour variants (jersey blue, tank sand, tee yellow / bubblegum) only have a front photo, so their "side" is the front.
- Prices, copy and the contact details are made up for the sample. The contact form and checkout are demos; nothing leaves your browser.
- The product photos belong to the original brand. Replace them before publishing anything.
"# 3D-Fashion-Store-Website" 
