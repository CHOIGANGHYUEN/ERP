import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * SUFFERING — 부상, 질병, 혹은 재난으로 인한 고통 모션
 * 몸이 심하게 흔들리고 고꾸라짐
 */
export const SUFFERING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.02
  const shake = (Math.random() - 0.5) * 4
  
  // 고통 붉은색 플래시
  if (Math.sin(t * 10) > 0) {
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.fillStyle = '#ff0000'
    ctx.beginPath()
    ctx.arc(creature.x, creature.y - 8, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 2, {
    legL: 2, legR: 2,
    armL: 4, armR: 4,
    bodyTilt: 0.2,
    lean: shake,
    blinkPhase: 0
  })
}
