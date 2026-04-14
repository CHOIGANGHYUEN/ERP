import { drawCreatureBody } from './drawCreatureBody.js'

export const ATTACKING = (creature, ctx, timestamp) => {
  // 앞뒤로 돌진하는 듯한 모션
  const lungeOffset = Math.sin(timestamp * 0.02) * 5

  // Arm swing animation
  const animProps = {
    armR: Math.abs(Math.sin(timestamp * 0.02) * 8) - 4, // Swing one arm
    bodyTilt: 0.15,
  }
  const drawSize = drawCreatureBody(creature, ctx, 0, animProps) // yOffset은 0으로 고정

  if (creature.isAdult) {
    ctx.fillStyle = '#e74c3c'
    ctx.fillText('💢', creature.x - 10 + lungeOffset, creature.y - drawSize)
  }
}
