import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * MATING — 짝짓기 중 모션 (가까이 붙어서 흔들거림)
 */
export const MATING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.005
  const bounce = -Math.abs(Math.sin(t * Math.PI)) * 2
  
  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, bounce, {
    legL: 1, legR: 1,
    armL: 2, armR: 2,
    bodyTilt: 0,
    blinkPhase: (Math.sin(t) + 1) * 0.5
  })

  // 여러 개의 하트 파티클
  for(let i=0; i<3; i++) {
    const off = (t + i * 2) % 3
    const hX = creature.x + Math.sin(off * 5) * 15
    const hY = creature.y - drawSize - 10 - off * 20
    ctx.globalAlpha = 1 - (off / 3)
    ctx.font = '12px Arial'
    ctx.fillText('❤️', hX, hY)
  }
  ctx.globalAlpha = 1.0
}
