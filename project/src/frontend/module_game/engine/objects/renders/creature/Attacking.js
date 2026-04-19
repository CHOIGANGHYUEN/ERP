import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * ATTACKING — 무기를 휘두르거나 찌르는 모션
 */
export const ATTACKING = (creature, ctx, timestamp, world) => {
  const f = creature.currentFrame % 5
  const t = timestamp * 0.015

  // 빠른 전진 모션
  const lungeOffset = Math.sin(t * Math.PI) * 5

  // 팔을 교차로 빠르게 휘두름
  const armSwingL = Math.sin(t * Math.PI) * 10
  const armSwingR = -Math.sin(t * Math.PI) * 10

  const animProps = {
    legL: 2, 
    legR: -2,
    armL: armSwingL,
    armR: armSwingR,
    bodyTilt: 0.15,
    lean: lungeOffset,
    blinkPhase: 0 // 화난 상태로 눈 크게 뜸
  }
  
  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, animProps)

  if (creature.isAdult) {
    ctx.fillStyle = '#e74c3c'
    ctx.font = '12px Arial'
    ctx.fillText('💢', creature.x - 10 + lungeOffset, creature.y - drawSize)
  }
}
