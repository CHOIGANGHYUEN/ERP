import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * MATING — 짝짓기 중 모션 (가까이 붙어서 흔들거림)
 */
export const MATING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.005
  // 마주보고 리듬을 타는 바운스
  const bounce = -Math.abs(Math.sin(t * Math.PI)) * 1.5
  const lean   = Math.sin(t) * 2

  const animProps = {
    legL: 1, 
    legR: 1,
    armL: 1, 
    armR: 1,
    bodyTilt: 0,
    lean,
    blinkPhase: (Math.sin(t) + 1) * 0.5 // 수줍은 듯이 눈 깜빡임
  }

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, bounce, animProps)

  if (Math.sin(t * 3) > 0) {
    ctx.fillStyle = '#e91e63'
    ctx.font = '14px Arial'
    ctx.fillText('💕', creature.x, creature.y - drawSize - 10)
  }
}
