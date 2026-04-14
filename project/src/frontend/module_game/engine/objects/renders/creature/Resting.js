import { drawCreatureBody } from './drawCreatureBody.js'

export const RESTING = (creature, ctx, _timestamp) => {
  // 휴식 중에는 애니메이션 없음 (정지)
  const drawSize = drawCreatureBody(creature, ctx, 0)

  // Zzz... 이펙트
  ctx.fillStyle = '#fff'
  ctx.font = '12px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('Zzz..', creature.x, creature.y - drawSize - 5)
}
