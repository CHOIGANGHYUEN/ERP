import { drawCreatureBody } from './drawCreatureBody.js'

export const RETURNING = (creature, ctx, _timestamp) => {
  // Slower, heavier walk
  const yOffset = creature.frameOffsets[creature.currentFrame] * 0.8

  // Walk cycle while holding arms in front as if carrying something
  const animProps = {
    armL: -4,
    armR: -4,
  }
  const drawSize = drawCreatureBody(creature, ctx, yOffset, animProps)

  if (creature.isAdult) {
    ctx.fillStyle = '#fff'
    ctx.fillText('📦', creature.x, creature.y - drawSize - 5)
  }
}
