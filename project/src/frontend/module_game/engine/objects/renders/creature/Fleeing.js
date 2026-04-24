import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * FLEEING — 도망치는 모션 (보폭 크게, 팔을 뒤로, 빠른 속도)
 */
export const FLEEING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.02
  const bounce = -Math.abs(Math.sin(t * Math.PI)) * 4 
  
  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, bounce, {
    legL: Math.sin(t * Math.PI) * 5,
    legR: -Math.sin(t * Math.PI) * 5,
    armL: 4, armR: 4, // 도망칠 때 팔을 허둥댐
    bodyTilt: 0.3, // 상체를 앞으로 크게 숙임
    blinkPhase: 0
  })

  // 땀방울 파티클
  if (Math.sin(t * 5) > 0.5) {
    ctx.font = '10px Arial'
    ctx.fillText('💦', creature.x + (Math.random() - 0.5) * 10, creature.y - drawSize - 5)
  }
}
