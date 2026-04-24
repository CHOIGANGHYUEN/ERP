import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * HARVESTING — 낫질/수확 모션 (좌우 팔 스윙)
 * Layer2: 다리 고정 (무릎 살짝 굽힘), Layer3: 한쪽 팔 크게 스윙
 * Layer5: 수확 진척 바 + 수확물 파티클
 */
export const HARVESTING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.01
  const swing = Math.sin(t * Math.PI) * 0.8
  
  // 타겟 방향으로 몸 돌리기
  if (creature.target && creature.transform) {
    const dx = creature.target.x - creature.x
    const dy = creature.target.y - creature.y
    creature.transform.rotation = Math.atan2(dy, dx)
  }

  // 나뭇잎 파티클
  if (Math.random() < 0.2) {
    const angle = creature.transform.rotation + (Math.random() - 0.5)
    RenderUtils.drawPixel(ctx, 
      creature.x + Math.cos(angle) * 12, 
      creature.y + Math.sin(angle) * 12, 
      '#2ecc71', 2)
  }

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, {
    legL: 1, legR: -1,
    armL: -swing * 5,
    armR: swing * 12,
    bodyTilt: swing * 0.1,
    toolOffset: {
      x: Math.cos(creature.transform.rotation) * 8,
      y: Math.sin(creature.transform.rotation) * 4,
      rotation: creature.transform.rotation + swing,
      color: '#27ae60' // 낫(Scythe) 색상
    }
  })

  // 진척 바
  if (creature.target && creature.target.energy !== undefined) {
    RenderUtils.drawBar(ctx, creature.x, creature.y - drawSize - 10, 20, 3, 
      creature.target.energy / (creature.target.maxEnergy || 100), '#27ae60')
  }
}
