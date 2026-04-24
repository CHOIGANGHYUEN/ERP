import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * BUILDING — 건설/망치질 모션
 * Layer2: 다리 다소 벌리기, Layer3: 팔 위아래 빠른 망치 스윙
 * Layer5: 망치 이펙트 + 먼지 파티클 + 진척 바
 */
export const BUILDING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.01
  const hammer = Math.abs(Math.sin(t * Math.PI)) * 9

  // 타겟 방향으로 몸 돌리기
  if (creature.target && creature.transform) {
    const dx = creature.target.x - creature.x
    const dy = creature.target.y - creature.y
    creature.transform.rotation = Math.atan2(dy, dx)
  }

  // 임팩트 먼지 파티클
  if (hammer < 2) {
    const angle = creature.transform.rotation + (Math.random() - 0.5)
    RenderUtils.drawPixel(ctx, 
      creature.x + Math.cos(angle) * 12, 
      creature.y + Math.sin(angle) * 10, 
      '#bdc3c7', 3)
  }

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, {
    legL: 1, legR: -1,
    armL: 0,
    armR: -hammer,
    bodyTilt: hammer * 0.01,
    toolOffset: {
      x: Math.cos(creature.transform.rotation) * 6,
      y: Math.sin(creature.transform.rotation) * 2,
      rotation: creature.transform.rotation - (hammer * 0.1),
      color: '#95a5a6' // 망치 색상
    }
  })

  // 진척 바
  if (creature.target && creature.target.progress !== undefined) {
    RenderUtils.drawBar(ctx, creature.x, creature.y - drawSize - 10, 20, 3, 
      creature.target.progress / (creature.target.maxProgress || 100), '#e67e22')
  }
}
