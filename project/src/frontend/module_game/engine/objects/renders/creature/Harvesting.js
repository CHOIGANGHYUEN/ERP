import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

export const HARVESTING = (creature, ctx, timestamp) => {
  // 수확하는 듯한 상하 모션
  const yOffset = Math.abs(Math.sin(timestamp * 0.008) * 3)

  // Scythe swinging animation
  const animProps = {
    armL: Math.sin(timestamp * 0.008) * 4,
    armR: Math.sin(timestamp * 0.008) * 4,
    bodyTilt: Math.sin(timestamp * 0.008) * 0.1,
  }
  const drawSize = drawCreatureBody(creature, ctx, yOffset, animProps)

  if (creature.isAdult && creature.target) {
    RenderUtils.drawBar(
      ctx,
      creature.x,
      creature.y - drawSize - 8,
      20,
      3,
      creature.target.energy / creature.target.maxEnergy,
    )
  }
}
