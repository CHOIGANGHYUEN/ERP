import { RenderUtils } from '../../../utils/RenderUtils.js'
import { JobIcons } from '../../job/JobIcons.js'

export const drawCreatureBody = (creature, ctx, yOffset) => {
  let drawSize = creature.size
  if (!creature.isAdult) drawSize = creature.size * 0.6
  else if (creature.age >= 60) drawSize = creature.size * 0.9

  RenderUtils.drawShadow(ctx, creature.x, creature.y, drawSize, 4)

  ctx.fillStyle = creature.color
  ctx.fillRect(creature.x - drawSize / 2, creature.y - drawSize / 2 + yOffset, drawSize, drawSize)

  ctx.fillStyle = '#fff'
  ctx.fillRect(creature.x - drawSize / 4, creature.y - drawSize / 4 + yOffset, 4, 4)
  ctx.fillRect(creature.x + drawSize / 4 - 4, creature.y - drawSize / 4 + yOffset, 4, 4)

  ctx.fillStyle = '#000'
  ctx.fillRect(creature.x - drawSize / 4 + 1, creature.y - drawSize / 4 + 1 + yOffset, 2, 2)
  ctx.fillRect(creature.x + drawSize / 4 - 3, creature.y - drawSize / 4 + 1 + yOffset, 2, 2)

  if (creature.isAdult) {
    ctx.fillStyle = '#fff'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(
      JobIcons[creature.profession] || '',
      creature.x,
      creature.y - drawSize - 12 + yOffset,
    )
  }
  return drawSize
}
