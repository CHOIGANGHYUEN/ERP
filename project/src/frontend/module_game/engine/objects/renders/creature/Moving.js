import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * MOVING — 중앙 제어 시스템에 의한 고속 보행 렌더링
 */
export const MOVING = (creature, ctx, timestamp, world) => {
  const f = creature.currentFrame
  const t = timestamp * 0.005 // 이동 시 더 빠른 애니메이션

  const legLFrames = [0, 4, 0, -4, 0]
  const legRFrames = [0, -4, 0, 4, 0]
  
  const bounce = -Math.abs(Math.sin(t * Math.PI)) * 2.5

  const animProps = {
    legL: legLFrames[f % 5],
    legR: legRFrames[f % 5],
    armL: 0,
    armR: 0,
    bodyTilt: Math.sin(t * Math.PI) * 0.08,
    blinkPhase: (Math.sin(t * 0.5) + 1) * 0.5,
    lean: Math.sin(t * Math.PI) * 2
  }

  drawCreatureBody(creature, ctx, world, timestamp, bounce, animProps)

  // 이동 방향 화살표 (디버그 모드나 피드백용으로 작게 표시 가능)
  if (world.settings && world.settings.showDebugInfo) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.beginPath()
    ctx.moveTo(creature.x, creature.y)
    ctx.lineTo(creature.x + Math.cos(creature.transform.rotation) * 15, creature.y + Math.sin(creature.transform.rotation) * 15)
    ctx.stroke()
  }
}
