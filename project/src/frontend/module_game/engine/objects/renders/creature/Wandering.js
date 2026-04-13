import { drawCreatureBody } from './drawCreatureBody.js'

export const WANDERING = (creature, ctx, timestamp) => {
  if (timestamp - creature.lastFrameTime > creature.frameInterval) {
    creature.currentFrame = (creature.currentFrame + 1) % 8
    creature.lastFrameTime = timestamp
  }
  const yOffset = creature.frameOffsets[creature.currentFrame]
  drawCreatureBody(creature, ctx, yOffset)
}
