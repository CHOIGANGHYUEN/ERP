import { drawCreatureBody } from './drawCreatureBody.js'

export const MATING = (creature, ctx, timestamp) => {
  // 제자리에서 부드럽게 움직이는 애니메이션
  const yOffset = Math.sin(timestamp * 0.005) * 2
  const drawSize = drawCreatureBody(creature, ctx, yOffset)

  // 하트 이펙트
  ctx.fillStyle = '#e74c3c'
  ctx.font = '16px Arial'
  ctx.textAlign = 'center'
  const heartY = creature.y - drawSize - 15 + Math.sin(timestamp * 0.01) * 3
  ctx.fillText('❤️', creature.x, heartY)
}
