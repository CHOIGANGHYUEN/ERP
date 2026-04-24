import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * HARVESTING — 낫질/수확 모션 (좌우 팔 스윙)
 * Layer2: 다리 고정 (무릎 살짝 굽힘), Layer3: 한쪽 팔 크게 스윙
 * Layer5: 수확 진척 바 + 수확물 파티클
 */
export const HARVESTING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.008
  const swing = Math.sin(t * Math.PI)
  const isBackswing = swing < 0
  
  // 타겟 방향으로 몸 정렬
  if (creature.target && creature.transform) {
    const dx = creature.target.x - creature.x
    const dy = creature.target.y - creature.y
    creature.transform.rotation = Math.atan2(dy, dx)
  }

  // 1. 나뭇잎 및 이모지
  if (!isBackswing && Math.random() < 0.3) {
    const angle = creature.transform.rotation + (Math.random() - 0.5) * 1.5
    RenderUtils.drawPixel(ctx, 
      creature.x + Math.cos(angle) * 12, 
      creature.y + Math.sin(angle) * 12, 
      '#2ecc71', 2)
    
    ctx.font = '12px Arial'
    ctx.fillText('🌾', creature.x - 8, creature.y - 25)
  }

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, {
    legL: 1, legR: -1,
    armL: -swing * 6, armR: swing * 10,
    bodyTilt: swing * 0.1,
    squash: 1 + Math.abs(swing) * 0.05,
    toolOffset: {
      x: Math.cos(creature.transform.rotation) * 8,
      y: Math.sin(creature.transform.rotation) * 4,
      rotation: creature.transform.rotation + swing * 0.8,
      color: '#27ae60' // 낫(Scythe) 색상
    }
  })

  // 진척 바
  if (creature.target && creature.target.energy !== undefined) {
    RenderUtils.drawBar(ctx, creature.x, creature.y - drawSize - 12, 22, 4, 
      creature.target.energy / (creature.target.maxEnergy || 100), '#2ecc71')
  } else if (creature.resourceCarryCount > 0) {
    // 자원을 채집했음을 보여주는 시각적 힌트
    RenderUtils.drawPixel(ctx, creature.x, creature.y - drawSize - 16, '#f1c40f', 3)
  } else if (creature.isWorking) {
    const harvestProgressPhase = (timestamp % 2000) / 2000
    RenderUtils.drawBar(ctx, creature.x, creature.y - drawSize - 12, 22, 4, harvestProgressPhase, '#2ecc71')
  }
}
