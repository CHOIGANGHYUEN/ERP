import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * TRAINING — 제자리 무술/훈련 모션
 */
export const TRAINING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.015
  const punch = Math.sin(t * Math.PI) * 8
  
  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, {
    legL: 2, legR: 2,
    armL: punch, armR: -punch,
    bodyTilt: 0.05,
    blinkPhase: 0
  })

  if (Math.abs(punch) > 6) {
    ctx.font = '10px Arial'
    ctx.fillText('👊', creature.x + (punch > 0 ? 10 : -10), creature.y - drawSize * 0.5)
  }
}
