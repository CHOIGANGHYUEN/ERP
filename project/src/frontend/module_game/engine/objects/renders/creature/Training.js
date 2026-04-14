import { drawCreatureBody } from './drawCreatureBody.js'

export const TRAINING = (creature, ctx, _timestamp) => {
  // Vigorous up-down motion
  const yOffset = creature.frameOffsets[creature.currentFrame] * 2.5

  // Punching animation
  const frame = creature.currentFrame % 4
  const animProps = {
    armL: [0, 4, 0, -2][frame],
    armR: [0, -2, 0, 4][frame],
  }
  const drawSize = drawCreatureBody(creature, ctx, yOffset, animProps)

  // 훈련 이펙트
  ctx.fillStyle = '#e74c3c'
  ctx.font = '12px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('💪', creature.x, creature.y - drawSize - 5)
}
