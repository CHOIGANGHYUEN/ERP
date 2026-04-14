import { drawAnimalBody } from './drawAnimalBody.js'

export const WANDERING = (animal, ctx, _timestamp) => {
  const yOffset = animal.frameOffsets[animal.currentFrame]
  drawAnimalBody(animal, ctx, yOffset)
}
