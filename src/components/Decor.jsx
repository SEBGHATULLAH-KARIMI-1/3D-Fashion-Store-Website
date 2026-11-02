import { memo } from 'react'
import { useCutout } from '../lib/cutout'
// `?url` makes Vite treat these as plain assets whatever the extension (.jfif included)
import plantSrc from '../flowerhome.jpg?url'
import shoeSrc from '../shoeshome.png?url'

// Showroom decoration for the home page: window light, floor, plants, a sneaker on
// stone plinths and a chalkboard. The two photos get their white background removed
// (and are upscaled) in the browser by lib/cutout.js.

const Board = () => (
  <div className="dc-board">
    <div className="dc-board-in">
      <span>Wear</span>
      <span>Your</span>
      <span>Style</span>
      <i />
    </div>
  </div>
)

export default memo(function Decor({ hidden }) {
  const plant = useCutout(plantSrc, { thr: 232, holeMax: 14000 })
  const shoe = useCutout(shoeSrc, { thr: 238 })
  return (
    <div className={`decor ${hidden ? 'is-hidden' : ''}`} aria-hidden="true">
      <div className="dc-light" />
      <div className="dc-floor" />
      {plant && <img className="dc-plant" src={plant} alt="" draggable="false" />}
      <div className="dc-plinths">
        <div className="dc-block a" />
        <div className="dc-block b" />
        {shoe && <img className="dc-shoe" src={shoe} alt="" draggable="false" />}
      </div>
      <Board />
      {plant && <img className="dc-plant-br" src={plant} alt="" draggable="false" />}
    </div>
  )
})
