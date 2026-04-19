import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * STUDYING — 집중하는 모션, 책을 읽는 듯한 자세
 */
export const STUDYING = (creature, ctx, timestamp) => {
  const t = timestamp * 0.002
  
  // 매우 천천히 호흡하는 바운스
  const bounce = -Math.abs(Math.sin(t * Math.PI)) * 1.5

  const animProps = {
    legL: 1, 
    legR: 1,
    armL: -2, // 팔을 책상에 얹은 듯한
    armR: -2,
    bodyTilt: 0.1, // 책을 들여다보는
    blinkPhase: (Math.sin(t * 1.5) + 1) * 0.5 // 가끔 눈 깜빡임
  }

  const drawSize = drawCreatureBody(creature, ctx, bounce, animProps)

  if (creature.isAdult) {
    if (Math.sin(t * 5) > 0.8) {
      ctx.fillStyle = '#f1c40f'
      ctx.font = '10px Arial'
      ctx.fillText('💡', creature.x - 8, creature.y - drawSize - 12)
    }
  }
}
