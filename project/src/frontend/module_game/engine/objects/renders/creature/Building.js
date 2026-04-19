import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * BUILDING — 건설/망치질 모션
 * Layer2: 다리 다소 벌리기, Layer3: 팔 위아래 빠른 망치 스윙
 * Layer5: 망치 이펙트 + 먼지 파티클 + 진척 바
 */
export const BUILDING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.009

  // 망치 swing: 0→위 → 아래 → 위 반복
  const hammer = Math.abs(Math.sin(t * Math.PI)) * 9

  // 망치질 임팩트 순간 먼지 파티클
  if (hammer < 1.5 && Math.floor(t) !== Math.floor(t - 0.016)) {
    const P = Math.max(1, Math.round((creature.size || 16) / 8))
    const dx = creature.x + 10
    const dy = creature.y - 5
    ctx.fillStyle = '#bdc3c7'; ctx.fillRect(dx,     dy,     P*2, P)
    ctx.fillStyle = '#95a5a6'; ctx.fillRect(dx + 4, dy + 2, P,   P)
    ctx.fillStyle = '#7f8c8d'; ctx.fillRect(dx - 2, dy + 1, P,   P*2)
  }

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, hammer * 0.12, {
    legL: 3,
    legR: -1,
    armL: hammer * 0.4,
    armR: -hammer,   // 오른팔이 위로 들림 → 망치질
    bodyTilt: 0.07,
  })

  // 진척 바
  if (creature.isAdult && creature.target && creature.target.progress !== undefined) {
    RenderUtils.drawBar(
      ctx,
      creature.x,
      creature.y - drawSize - 8,
      22, 3,
      creature.target.progress / (creature.target.maxProgress || 100),
      '#e67e22', '#f1c40f',
    )
  }
}
