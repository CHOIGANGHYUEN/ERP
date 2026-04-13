import { drawAnimalBody } from './drawAnimalBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

export const HUNTING = (animal, ctx, timestamp) => {
  if (timestamp - animal.lastFrameTime > animal.frameInterval) {
    animal.currentFrame = (animal.currentFrame + 1) % 8
    animal.lastFrameTime = timestamp
  }
  const yOffset = animal.frameOffsets[animal.currentFrame] * 1.5
  drawAnimalBody(animal, ctx, yOffset)

  if (animal.target) {
    RenderUtils.drawBar(
      ctx,
      animal.x - 10 + animal.size / 2,
      animal.y - animal.size - 8,
      20,
      3,
      animal.energy / 100,
      '#e74c3c',
      '#f1c40f',
    )
  }
}
