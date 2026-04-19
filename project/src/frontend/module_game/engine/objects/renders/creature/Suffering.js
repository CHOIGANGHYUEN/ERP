import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * SUFFERING — 부상, 질병, 혹은 재난으로 인한 고통 모션
 * 몸이 심하게 흔들리고 고꾸라짐
 */
export const SUFFERING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.01
  const shake = (Math.random() - 0.5) * 3
  const bounce = Math.abs(Math.sin(t)) * 4

  const animProps = {
    legL: 2,
    legR: 2,
    armL: 3,
    armR: 3,
    bodyTilt: 0.1 + Math.sin(t * 2) * 0.1,
    blinkPhase: 0,
    lean: shake
  }
  
  // drawCreatureBody 내부에서 world와 timestamp를 받아 수영 상태를 자동 판별함
  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, bounce, animProps)

  // 고통 이펙트
  ctx.fillStyle = '#c0392b'
  ctx.font = 'bold 12px Arial'
  ctx.fillText('💢', creature.x + shake, creature.y - drawSize - 10)
}
