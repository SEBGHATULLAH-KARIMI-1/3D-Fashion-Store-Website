import { useEffect, useState } from 'react'

// Turns a photo with a white background into a transparent cut-out, and upscales it.
//  1. flood-fills "almost white" from the image border -> that is the background
//  2. optionally also clears enclosed pure-white pockets (gaps between leaves)
//  3. erodes the mask by 1px so no white halo is left, then upscales smoothly
// Runs once per image in the browser; the result is an object URL.
export function makeCutout(src, { thr = 238, holeMax = 0, scale = 0, crop = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g = c.getContext('2d', { willReadFrequently: true })
      g.drawImage(img, 0, 0)
      const data = g.getImageData(0, 0, w, h)
      const px = data.data
      const near = (i) => Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) >= thr
      const bg = new Uint8Array(w * h)
      const stack = []
      const seed = (i) => {
        if (!bg[i] && near(i)) {
          bg[i] = 1
          stack.push(i)
        }
      }
      for (let x = 0; x < w; x++) {
        seed(x)
        seed((h - 1) * w + x)
      }
      for (let y = 0; y < h; y++) {
        seed(y * w)
        seed(y * w + w - 1)
      }
      while (stack.length) {
        const i = stack.pop()
        const x = i % w
        const y = (i / w) | 0
        if (x > 0) seed(i - 1)
        if (x < w - 1) seed(i + 1)
        if (y > 0) seed(i - w)
        if (y < h - 1) seed(i + w)
      }
      if (holeMax) {
        // enclosed light patches (gaps between leaves) are background too, but only
        // small ones: a big light area (a white pot, a sole) is part of the object
        const seen = new Uint8Array(w * h)
        for (let s = 0; s < w * h; s++) {
          if (bg[s] || seen[s] || !near(s)) continue
          const comp = [s]
          seen[s] = 1
          for (let n = 0; n < comp.length; n++) {
            const i = comp[n]
            const x = i % w
            const y = (i / w) | 0
            const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]
            for (const j of nb) {
              if (j >= 0 && !bg[j] && !seen[j] && near(j)) {
                seen[j] = 1
                comp.push(j)
              }
            }
          }
          if (comp.length <= holeMax) for (const i of comp) bg[i] = 1
        }
      }
      // crop the border (many stock photos have a faint frame) + erode by one pixel
      const out = new Uint8Array(w * h)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x
          let keep = !bg[i] && x >= crop && y >= crop && x < w - crop && y < h - crop
          if (keep) {
            if (bg[i - 1] || bg[i + 1] || bg[i - w] || bg[i + w]) keep = false
          }
          out[i] = keep ? 255 : 0
        }
      }
      for (let i = 0; i < w * h; i++) px[i * 4 + 3] = out[i]
      g.putImageData(data, 0, 0)

      // upscale so the longest side is ~1100px (smooth, no new detail, but no pixel blocks)
      const k = scale || Math.max(1, Math.ceil(1100 / Math.max(w, h)))
      const big = document.createElement('canvas')
      big.width = w * k
      big.height = h * k
      const bg2 = big.getContext('2d')
      bg2.imageSmoothingEnabled = true
      bg2.imageSmoothingQuality = 'high'
      bg2.drawImage(c, 0, 0, big.width, big.height)
      big.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('cutout failed'))), 'image/png')
    }
    img.onerror = reject
    img.src = src
  })
}

export function useCutout(src, opts) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let dead = false
    let made = null
    makeCutout(src, opts)
      .then((u) => {
        if (dead) URL.revokeObjectURL(u)
        else {
          made = u
          setUrl(u)
        }
      })
      .catch(() => {})
    return () => {
      dead = true
      if (made) URL.revokeObjectURL(made)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])
  return url
}
