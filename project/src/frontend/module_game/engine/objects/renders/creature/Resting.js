import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * RESTING — 휴식 중. 바닥에 누워있거나 고개를 떨군 상태.
 */
export const RESTING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.002
  const breathe = Math.sin(t * Math.PI) * 2
  
  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 4, { // 4px 아래로 내려가서 앉은 느낌
    legL: -2, legR: -2,
    armL: 3, armR: 3,
    bodyTilt: 0.1,
    blinkPhase: 1.0 // 잠듦
  })

  // Zzz 파티클
  const zSize = 8 + Math.sin(t * 10) * 2
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.font = `${zSize}px Arial`
  ctx.fillText('Zzz', creature.x + 10 + breathe, creature.y - drawSize - 5 - (t % 1 * 20))
}
