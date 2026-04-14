import { drawCreatureBody } from './drawCreatureBody.js'

export const GATHERING = (creature, ctx, _timestamp) => {
  // Bending down animation
  const yOffset = 4
  const animProps = {
    armL: 6,
    armR: 6,
    bodyTilt: 0.2,
  }
  drawCreatureBody(creature, ctx, yOffset, animProps)
}
