import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * HARVESTING — 낫질/수확 모션 (좌우 팔 스윙)
 * Layer2: 다리 고정 (무릎 살짝 굽힘), Layer3: 한쪽 팔 크게 스윙
 * Layer5: 수확 진척 바 + 수확물 파티클
 */
export const HARVESTING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.008

  // 오른팔 크게 위아래 스윙 (낫질)
  const swingR  = Math.sin(t * Math.PI) * 7
  const swingL  = -swingR * 0.3   // 왼팔은 반대로 약하게

  // 몸 스윙따라 살짝 기울기
  const tilt = Math.sin(t * Math.PI) * 0.08

  // 수확 파티클 (초록 잎사귀 느낌)
  if (Math.sin(t * 4) > 0.6) {
    const leafX = creature.x + 10 + Math.cos(t * 2) * 6
    const leafY = creature.y - 4 + Math.sin(t * 3) * 4
    ctx.fillStyle = '#2ecc71'
    ctx.fillRect(leafX, leafY, 3, 2)
    ctx.fillStyle = '#f1c40f'
    ctx.fillRect(leafX - 3, leafY + 2, 2, 2)
  }

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, {
    legL: 2,
    legR: 3,
    armL: swingL,
    armR: swingR,
    bodyTilt: tilt,
  })

  // 진척 바 (수확 대상 체력)
  if (creature.isAdult && creature.target && creature.target.energy !== undefined) {
    RenderUtils.drawBar(
      ctx,
      creature.x,
      creature.y - drawSize - 8,
      22, 3,
      creature.target.energy / (creature.target.maxEnergy || 100),
      '#27ae60', '#f1c40f',
    )
  }
}
