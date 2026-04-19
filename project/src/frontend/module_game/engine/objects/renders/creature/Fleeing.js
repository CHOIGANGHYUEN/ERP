import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * FLEEING — 도망치는 모션 (보폭 크게, 팔을 뒤로, 빠른 속도)
 */
export const FLEEING = (creature, ctx, timestamp, world) => {
  const f = creature.currentFrame % 5
  const t = timestamp * 0.008

  // 5프레임 역동적 보류 사이클
  const legLFrames = [0, 5, 0, -5, 0]
  const legRFrames = [0, -5, 0, 5, 0]
  const armLFrames = [0, -6, 0, 6, 0]
  const armRFrames = [0, 6, 0, -6, 0]

  const bounce = -Math.abs(Math.sin(t * Math.PI)) * 4 // 바운스 심함
  const lean   = Math.sin(t * Math.PI) * 3

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, bounce, {
    legL: legLFrames[f],
    legR: legRFrames[f],
    armL: armLFrames[f],
    armR: armRFrames[f],
    bodyTilt: 0.2, // 앞으로 치우침
    lean,
    blinkPhase: 0 // 공포에 질려 항상 눈 뜸
  })

  // 땀 / 공포 이펙트
  if (Math.sin(t * 4) > 0) {
    ctx.fillStyle = '#3498db'
    ctx.fillText('💦', creature.x + 8, creature.y - drawSize - 5)
  }
}
