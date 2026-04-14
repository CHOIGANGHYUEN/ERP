import { RenderUtils } from '../../../utils/RenderUtils.js'
import { JobIcons } from '../../behavior/JobIcons.js'
/**
 * Draws a pixel-art style human character with limbs.
 * @param {Creature} creature The creature to draw.
 * @param {CanvasRenderingContext2D} ctx The rendering context.
 * @param {number} yOffset Vertical offset for the body, used for bouncing animations.
 * @param {object} [animProps={}] Animation properties for limbs.
 * @param {number} [animProps.armL=0] Left arm vertical offset.
 * @param {number} [animProps.armR=0] Right arm vertical offset.
 * @param {number} [animProps.bodyTilt=0] Body tilt in radians.
 */
export const drawCreatureBody = (creature, ctx, yOffset, animProps = {}) => {
  let drawSize = creature.size
  if (!creature.isAdult) drawSize = creature.size * 0.6
  else if (creature.age >= 60) drawSize = creature.size * 0.9
  RenderUtils.drawShadow(ctx, creature.x, creature.y, drawSize * 0.8, 4)

  const headSize = drawSize * 0.7
  const bodyWidth = drawSize * 0.8
  const bodyHeight = drawSize
  const limbWidth = drawSize * 0.25
  const armHeight = drawSize * 0.7
  const legHeight = drawSize * 0.6

  const skinColor = '#f3c29b'
  const pantsColor = '#34495e'

  const { armL = 0, armR = 0, bodyTilt = 0 } = animProps

  ctx.save()
  ctx.translate(creature.x, creature.y)
  ctx.rotate(bodyTilt)

  // Legs
  ctx.fillStyle = pantsColor
  ctx.fillRect(-bodyWidth / 2, bodyHeight / 2 - legHeight / 2, limbWidth, legHeight) // Left Leg
  ctx.fillRect(bodyWidth / 2 - limbWidth, bodyHeight / 2 - legHeight / 2, limbWidth, legHeight) // Right Leg

  // Body (clothing)
  ctx.fillStyle = creature.color
  ctx.fillRect(-bodyWidth / 2, -bodyHeight / 2 + yOffset, bodyWidth, bodyHeight)

  // Arms
  ctx.fillStyle = skinColor
  ctx.fillRect(-bodyWidth / 2 - limbWidth, -bodyHeight / 2 + yOffset + armL, limbWidth, armHeight) // Left Arm
  ctx.fillRect(bodyWidth / 2, -bodyHeight / 2 + yOffset + armR, limbWidth, armHeight) // Right Arm

  // Head
  ctx.fillStyle = skinColor
  ctx.fillRect(-headSize / 2, -bodyHeight / 2 - headSize * 0.9 + yOffset, headSize, headSize)

  // Eyes
  ctx.fillStyle = '#000'
  ctx.fillRect(-3, -bodyHeight / 2 - headSize * 0.5 + yOffset, 2, 2)
  ctx.fillRect(1, -bodyHeight / 2 - headSize * 0.5 + yOffset, 2, 2)

  ctx.restore()

  if (creature.isAdult) {
    ctx.fillStyle = '#fff'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(
      JobIcons[creature.profession] || '',
      creature.x, // Text is drawn in original coordinate space
      creature.y - drawSize - 12 + yOffset,
    )
  }
  return drawSize
}
