import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * BUILDING — 건설/망치질 모션
 * Layer2: 다리 다소 벌리기, Layer3: 팔 위아래 빠른 망치 스윙
 * Layer5: 망치 이펙트 + 먼지 파티클 + 진척 바
 */
export const BUILDING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.012
  const hammerCycle = (t % Math.PI)
  const isHit = hammerCycle < 0.4
  const hammer = isHit ? Math.sin(hammerCycle * 4) * 12 : Math.abs(Math.sin(t)) * 4

  // 타겟 방향으로 몸 정렬
  if (creature.target && creature.transform) {
    const dx = creature.target.x - creature.x
    const dy = creature.target.y - creature.y
    creature.transform.rotation = Math.atan2(dy, dx)
  }

  // 1. 타격 먼지 및 이모지
  if (isHit && Math.random() < 0.5) {
    const angle = creature.transform.rotation + (Math.random() - 0.5) * 0.6
    RenderUtils.drawPixel(ctx, 
      creature.x + Math.cos(angle) * 14, 
      creature.y + Math.sin(angle) * 8, 
      '#ecf0f1', 2 + Math.random() * 2)
    
    ctx.font = '12px Arial'
    ctx.fillText('🔨', creature.x - 8, creature.y - 28)
  }

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, {
    legL: 1, legR: -1,
    armL: 0, armR: -hammer,
    bodyTilt: isHit ? 0.05 : -0.02,
    squash: isHit ? 0.85 : 1,
    bounce: isHit ? 0.3 : 0,
    toolOffset: {
      x: Math.cos(creature.transform.rotation) * 6,
      y: Math.sin(creature.transform.rotation) * 2,
      rotation: creature.transform.rotation - (hammer * 0.1),
      color: '#bdc3c7'
    }
  })

  if (creature.target && creature.target.progress !== undefined) {
    RenderUtils.drawBar(ctx, creature.x, creature.y - drawSize - 12, 22, 4, 
      creature.target.progress / (creature.target.maxProgress || 100), '#e67e22')
  } else if (creature.isWorking) {
    // Fallback indicator when building without explicit target progress
    const buildProgressPhase = (timestamp % 2000) / 2000
    RenderUtils.drawBar(ctx, creature.x, creature.y - drawSize - 12, 22, 4, buildProgressPhase, '#e67e22')
  }
}
