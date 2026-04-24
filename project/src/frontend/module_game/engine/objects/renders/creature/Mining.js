import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * MINING — 곡괭이질 모션 (강한 위아래 팔 스윙)
 * Layer2: 다리 벌리고 고정 (안정된 자세), Layer3: 오른팔 크게 올렸다 내리기
 * Layer5: 채광 불꽃 스파크 + 진척 바
 */
export const MINING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.015
  const phase = (t % (Math.PI * 2))
  
  // 🔨 강한 타격감: 내리칠 때 가속, 올릴 때 감속
  const isDown = phase < Math.PI * 0.5
  const swing = isDown 
    ? Math.pow(Math.sin(phase * 2), 2) * 20 - 10 
    : Math.sin(phase * 0.6 + 1.5) * 10 - 10

  const isImpact = phase < 0.3 // 타격 순간
  const squash = isImpact ? 0.8 : 1.0 + Math.sin(t) * 0.05
  const bounce = isImpact ? 0.5 : 0

  // 타겟 방향으로 몸 정렬
  if (creature.target && creature.transform) {
    const dx = creature.target.x - creature.x
    const dy = creature.target.y - creature.y
    creature.transform.rotation = Math.atan2(dy, dx)
  }

  // 1. 임팩트 파티클 및 이모지
  if (isImpact) {
    const angle = creature.transform.rotation + (Math.random() - 0.5) * 0.8
    for(let i=0; i<4; i++) {
       RenderUtils.drawPixel(ctx, 
         creature.x + Math.cos(angle) * 15, 
         creature.y + Math.sin(angle) * 10, 
         ['#ffffff', '#f1c40f', '#bdc3c7'][i%3], 2 + Math.random() * 2)
    }
    ctx.font = '12px Arial'
    ctx.fillText('⛏️', creature.x - 10, creature.y - 25 - Math.sin(t) * 5)
  }

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, {
    legL: -1, legR: -1,
    armL: 0, armR: swing,
    bodyTilt: isImpact ? 0.1 : -0.05,
    squash, bounce,
    toolOffset: {
      x: Math.cos(creature.transform.rotation) * 8,
      y: Math.sin(creature.transform.rotation) * 4,
      rotation: creature.transform.rotation + (swing * 0.15),
      color: '#7f8c8d'
    }
  })

  if (creature.target && creature.target.energy !== undefined) {
    RenderUtils.drawBar(ctx, creature.x, creature.y - drawSize - 12, 22, 4, 
      creature.target.energy / (creature.target.maxEnergy || 100), '#f1c40f')
  }
}
