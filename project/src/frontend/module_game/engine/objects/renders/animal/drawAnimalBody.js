import { RenderUtils } from '../../../utils/RenderUtils.js'

export const drawAnimalBody = (animal, ctx, yOffset) => {
  RenderUtils.drawShadow(ctx, animal.x, animal.y, animal.size, 4)

  ctx.fillStyle = animal.color
  ctx.fillRect(
    animal.x - animal.size,
    animal.y - animal.size / 2 + yOffset,
    animal.size * 2,
    animal.size,
  )

  ctx.fillStyle = '#000'
  ctx.fillRect(animal.x + animal.size / 2, animal.y - 2 + yOffset, 2, 2)
}
