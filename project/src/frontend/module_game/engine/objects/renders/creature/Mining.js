import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * MINING — 곡괭이질 모션 (강한 위아래 팔 스윙)
 * Layer2: 다리 벌리고 고정 (안정된 자세), Layer3: 오른팔 크게 올렸다 내리기
 * Layer5: 채광 불꽃 스파크 + 진척 바
 */
export const MINING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.012
  const phase = (t % (Math.PI * 2))
  const swing = phase < Math.PI ? Math.sin(phase) * -10 : Math.sin(phase) * 8

  // 타겟 방향으로 몸 돌리기
  if (creature.target && creature.transform) {
    const dx = creature.target.x - creature.x
    const dy = creature.target.y - creature.y
    creature.transform.rotation = Math.atan2(dy, dx)
  }

  // 충격 순간 스파크 (방향 반영)
  if (swing > 6) {
    const angle = creature.transform.rotation + (Math.random() - 0.5) * 0.5
    for(let i=0; i<3; i++) {
       RenderUtils.drawPixel(ctx, 
         creature.x + Math.cos(angle) * 14, 
         creature.y + Math.sin(angle) * 10, 
         i % 2 === 0 ? '#f1c40f' : '#e67e22', 2)
    }
  }

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, {
    legL: -1, legR: -1,
    armL: 0,
    armR: swing,
    bodyTilt: swing * 0.02,
    toolOffset: {
      x: Math.cos(creature.transform.rotation) * 6,
      y: Math.sin(creature.transform.rotation) * 2,
      rotation: creature.transform.rotation + (swing * 0.1),
      color: '#5d6d7e' // 곡괭이 색상
    }
  })

  if (creature.target && creature.target.energy !== undefined) {
    RenderUtils.drawBar(ctx, creature.x, creature.y - drawSize - 10, 20, 3, 
      creature.target.energy / (creature.target.maxEnergy || 100), '#f1c40f')
  }
}
