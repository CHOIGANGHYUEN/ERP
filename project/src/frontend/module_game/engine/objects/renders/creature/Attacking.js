import { drawCreatureBody } from './drawCreatureBody.js'

export const ATTACKING = (creature, ctx, timestamp) => {
  if (timestamp - creature.lastFrameTime > creature.frameInterval) {
    creature.currentFrame = (creature.currentFrame + 1) % 8
    creature.lastFrameTime = timestamp
  }
  const yOffset = creature.frameOffsets[creature.currentFrame] * 1.5
  const drawSize = drawCreatureBody(creature, ctx, yOffset)

  if (creature.isAdult) {
    ctx.fillStyle = '#e74c3c'
    ctx.fillText('💢', creature.x - 10, creature.y - drawSize + yOffset)
  }
}
