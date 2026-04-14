import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

export const BUILDING = (creature, ctx, timestamp) => {
  // 망치질하는 듯한 상하 모션
  const yOffset = Math.abs(Math.sin(timestamp * 0.01) * 2)

  // Hammering animation
  const animProps = {
    armR: Math.abs(Math.sin(timestamp * 0.01) * 6), // Swing arm up and down
    bodyTilt: 0.05,
  }
  const drawSize = drawCreatureBody(creature, ctx, yOffset, animProps)

  if (creature.isAdult && creature.target) {
    RenderUtils.drawBar(
      ctx,
      creature.x,
      creature.y - drawSize - 8,
      20,
      3,
      creature.target.progress / creature.target.maxProgress,
    )
  }
}
