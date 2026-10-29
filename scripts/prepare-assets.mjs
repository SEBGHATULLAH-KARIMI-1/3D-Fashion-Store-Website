// Copies the product images out of the old saved site (../site/_next/image-*.html,
// which are really .webp files) into public/products/<slug>-<view>.webp.
// Runs automatically before `npm run dev` and `npm run build`.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const imgDir = path.resolve(here, '..', '..', 'site', '_next')
const out = path.resolve(here, '..', 'public', 'products')

// slug -> [front image, side image | null]  (same mapping the old serve.py used)
const IMAGES = {
  'crimson-memory': ['image-c6343cb74a71e8', 'image-4e8640f03d7b6'],
  'distressed-logo-t': ['image-bb6fb99c4b2508', 'image-05f55d455bb558'],
  'its-us-tee-black': ['image-b4ec065a4e66f8', 'image-b542c1d352ef8'],
  'jersey-yellow': ['image-6ae6766896f1d8', 'image-959fe759fcd068'],
  'silicone-tee': ['image-ffce5fea8389f8', 'image-97e6e1449d26b'],
  'tank-black': ['image-0af2db7b4647a8', 'image-9efcd9db49e648'],
  varsity: ['image-84bdfd6756b51', 'image-d2f85dbbd1b6c8'],
  'jersey-blue': ['image-2406692edfcaf', null],
  'tank-sand': ['image-246e6ad4aa26a8', null],
  'its-us-tee-yellow': ['image-277d32b1ca5e88', null],
  'its-us-tee-bubblegum': ['image-ad7c33cd14d518', null],
}

if (!existsSync(imgDir)) {
  if (existsSync(out)) {
    console.log('[assets] ../site not found, using images already in public/products')
    process.exit(0)
  }
  console.error(`[assets] Cannot find ${imgDir}. Keep react-app next to the old "site" folder.`)
  process.exit(1)
}

mkdirSync(out, { recursive: true })
let n = 0
for (const [slug, [front, side]] of Object.entries(IMAGES)) {
  copyFileSync(path.join(imgDir, front + '.html'), path.join(out, `${slug}-front.webp`))
  copyFileSync(path.join(imgDir, (side ?? front) + '.html'), path.join(out, `${slug}-side.webp`))
  n += 2
}
console.log(`[assets] copied ${n} product images`)
