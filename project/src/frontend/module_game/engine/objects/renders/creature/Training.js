import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * TRAINING — 제자리 무술/훈련 모션
 */
export const TRAINING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.01
  
  // 빠른 주먹질 & 기마 자세
  const punchL = Math.sin(t) > 0 ? -6 : 2
  const punchR = Math.sin(t) <= 0 ? -6 : 2
  const bounce = Math.abs(Math.sin(t * 2)) * 3

  const animProps = {
    legL: 4, 
    legR: 4,  // 다리를 구부려 기마자세
    armL: punchL,
    armR: punchR,
    bodyTilt: 0,
    blinkPhase: 0 // 항상 집중
  }

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, bounce, animProps)

  if (Math.sin(t * 3) > 0.8) {
    ctx.fillStyle = '#e74c3c'
    ctx.font = '10px Arial'
    ctx.fillText('💪', creature.x + 8, creature.y - drawSize - 5)
  }
}
