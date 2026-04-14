import { drawCreatureBody } from './drawCreatureBody.js'

export const WANDERING = (creature, ctx, _timestamp) => {
  const yOffset = creature.frameOffsets[creature.currentFrame]

  // Walk cycle animation
  const frame = creature.currentFrame % 4
  const animProps = {
    armL: [2, 4, 2, 0][frame],
    armR: [-2, -4, -2, 0][frame],
  }
  drawCreatureBody(creature, ctx, yOffset, animProps)
}
