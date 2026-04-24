import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * STUDYING — 집중하는 모션, 책을 읽는 듯한 자세
 */
export const STUDYING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.005
  const flip = Math.sin(t) > 0.9 ? 1 : 0
  
  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, {
    legL: 1, legR: 1,
    armL: -3, armR: -3,
    bodyTilt: 0.15,
    toolOffset: {
      x: Math.cos(creature.rotation || 0) * 6,
      y: Math.sin(creature.rotation || 0) * 3,
      rotation: (creature.rotation || 0) + (flip * 0.2),
      color: '#ecf0f1' // 책(Book) 색상
    }
  })

  if (flip) {
    ctx.fillStyle = '#f1c40f'
    ctx.font = '10px Arial'
    ctx.fillText('💡', creature.x, creature.y - drawSize - 12)
  }
}
