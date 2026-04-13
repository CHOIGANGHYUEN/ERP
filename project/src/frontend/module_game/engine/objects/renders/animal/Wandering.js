import { drawAnimalBody } from './drawAnimalBody.js'

export const WANDERING = (animal, ctx, timestamp) => {
  if (timestamp - animal.lastFrameTime > animal.frameInterval) {
    animal.currentFrame = (animal.currentFrame + 1) % 8
    animal.lastFrameTime = timestamp
  }
  const yOffset = animal.frameOffsets[animal.currentFrame]
  drawAnimalBody(animal, ctx, yOffset)
}
