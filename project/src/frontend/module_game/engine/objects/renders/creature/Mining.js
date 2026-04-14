import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

export const MINING = (creature, ctx, timestamp) => {
  // 채광하는 듯한 상하 모션
  const yOffset = Math.abs(Math.sin(timestamp * 0.015) * 2)

  // Pickaxe swinging animation
  const animProps = {
    armR: Math.abs(Math.sin(timestamp * 0.015) * 8),
    bodyTilt: 0.1,
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
