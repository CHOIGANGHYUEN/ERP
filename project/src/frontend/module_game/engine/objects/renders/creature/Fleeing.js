import { drawCreatureBody } from './drawCreatureBody.js'

export const FLEEING = (creature, ctx, _timestamp) => {
  // Faster bounce for running
  const yOffset = creature.frameOffsets[creature.currentFrame] * 2.0

  // Run cycle animation with more exaggerated arm swing and body tilt
  const frame = creature.currentFrame % 4
  const animProps = {
    armL: [4, 8, 4, 0][frame],
    armR: [-4, -8, -4, 0][frame],
    bodyTilt: 0.1, // Tilt forward
  }
  drawCreatureBody(creature, ctx, yOffset, animProps)

  ctx.fillStyle = '#3498db'
  ctx.font = '12px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('💦', creature.x + creature.size / 2, creature.y - creature.size)
}
