// Everything you'd want to edit (brand text, products, prices) lives here.

export const BRAND = {
  name: 'Fancy Clothes',
  marquee: 'FANCY CLOTHES  •  NEW DROP  •  3D SAMPLE STORE  •  NO REAL ORDERS  •  ',
}

export const SIZES = ['S', 'M', 'L', 'XL']

// Order = order on the rack (left to right).
// Each variant: slug (image file name in /products), label, swatch colour, wall tint.
export const PRODUCTS = [
  {
    id: 'crimson-memory',
    name: 'Crimson Memory LS Shirt',
    price: 74,
    desc: 'Heavyweight long-sleeve with a washed crimson print across the chest. Boxy fit, dropped shoulder.',
    variants: [{ slug: 'crimson-memory', label: 'White', color: '#f2f1ee', wall: '#e9e8e4' }],
  },
  {
    id: 'its-us-tee',
    name: 'It’s Us Never Them Tee',
    price: 38,
    desc: 'Everyday 240gsm cotton tee with a cracked slogan print. Pre-washed so it feels broken-in from day one.',
    variants: [
      { slug: 'its-us-tee-black', label: 'Black', color: '#151513', wall: '#d9d8d3' },
      { slug: 'its-us-tee-yellow', label: 'Yellow', color: '#f2d21b', wall: '#efe7bd' },
      { slug: 'its-us-tee-bubblegum', label: 'Bubblegum', color: '#f4a6c8', wall: '#f0d6e0' },
    ],
  },
  {
    id: 'tank',
    name: 'Distressed Painted Logo Tank',
    price: 34,
    desc: 'Rib-knit tank with a hand-painted, distressed logo. Cut long, made to be layered.',
    variants: [
      { slug: 'tank-black', label: 'Black', color: '#151513', wall: '#d9d8d3' },
      { slug: 'tank-sand', label: 'Sand', color: '#d8c9a8', wall: '#e8dfca' },
    ],
  },
  {
    id: 'varsity',
    name: 'Logo Varsity Jacket',
    price: 165,
    desc: 'Wool-blend body, faux-leather sleeves, snap front. Chenille logo on the chest, quilted lining.',
    variants: [{ slug: 'varsity', label: 'Black', color: '#151513', wall: '#d9d8d3' }],
  },
  {
    id: 'distressed-logo-t',
    name: 'Distressed Logo Print Tee',
    price: 40,
    desc: 'Faded blue tee with an oversized cracked logo print. Relaxed through the body.',
    variants: [{ slug: 'distressed-logo-t', label: 'Blue', color: '#2a4fb8', wall: '#ced7ec' }],
  },
  {
    id: 'jersey',
    name: 'Football Jersey',
    price: 82,
    desc: 'Mesh football jersey with stitched numbers and contrast side panels. Runs roomy.',
    variants: [
      { slug: 'jersey-yellow', label: 'Yellow', color: '#f2d21b', wall: '#efe7bd' },
      { slug: 'jersey-blue', label: 'Blue', color: '#2a4fb8', wall: '#ced7ec' },
    ],
  },
  {
    id: 'silicone-tee',
    name: 'Silicone Logo Print Tee',
    price: 42,
    desc: 'Soft cotton tee with a raised silicone logo you can feel from across the room.',
    variants: [{ slug: 'silicone-tee', label: 'White', color: '#f2f1ee', wall: '#e9e8e4' }],
  },
]

export const img = (slug, view) => `/products/${slug}-${view}.webp`
export const money = (n) => `$${n}`
export const pad = (n) => String(n).padStart(2, '0')
