import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * RESTING — 휴식 중. 바닥에 누워있거나 고개를 떨군 상태.
 */
export const RESTING = (creature, ctx, timestamp, world) => {
  const animProps = {
    legL: -1, 
    legR: -1,
    armL: 2, 
    armR: 2, // 팔 늘어뜨림
    bodyTilt: 0.2, // 앞으로 고개 숙임
    blinkPhase: 1.0 // 항상 눈 감음
  }
  
  // 바운스 없음
  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, animProps)

  ctx.fillStyle = '#fff'
  ctx.font = '12px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('Zzz..', creature.x, creature.y - drawSize - 5)
}
