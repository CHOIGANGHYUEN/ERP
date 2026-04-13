import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

export const GATHERING = (creature, ctx, timestamp) => {
  if (timestamp - creature.lastFrameTime > creature.frameInterval) {
    creature.currentFrame = (creature.currentFrame + 1) % 8
    creature.lastFrameTime = timestamp
  }
  const yOffset = creature.frameOffsets[creature.currentFrame] * 1.5
  const drawSize = drawCreatureBody(creature, ctx, yOffset)

  if (creature.isAdult && creature.target) {
    RenderUtils.drawBar(
      ctx,
      creature.x,
      creature.y - drawSize - 8 + yOffset,
      20,
      3,
      creature.currentFrame / 8,
    )
  }
}
