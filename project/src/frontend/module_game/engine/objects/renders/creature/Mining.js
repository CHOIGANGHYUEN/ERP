import { drawCreatureBody } from './drawCreatureBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * MINING — 곡괭이질 모션 (강한 위아래 팔 스윙)
 * Layer2: 다리 벌리고 고정 (안정된 자세), Layer3: 오른팔 크게 올렸다 내리기
 * Layer5: 채광 불꽃 스파크 + 진척 바
 */
export const MINING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.012

  // 2단 모션: 크게 올리고 → 빠르게 내리기 (비대칭 이징)
  const phase  = (t % (Math.PI * 2))
  const swing  = phase < Math.PI
    ? Math.sin(phase) * -10        // 올리기 (느리게)
    : Math.sin(phase) * 8          // 내리기 (빠르게)

  // 충격 순간 (swing 최대치) 스파크
  if (swing > 6) {
    const P = Math.max(1, Math.round((creature.size || 16) / 8))
    const sx = creature.x + 12
    const sy = creature.y - 2
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(sx,       sy,     P*2, P)
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(sx + 4,   sy - 3, P,   P)
    ctx.fillStyle = '#f39c12'; ctx.fillRect(sx - 2,   sy + 2, P,   P*2)
  }

  // 몸이 충격에 따라 앞으로 틸트
  const tilt = swing > 4 ? 0.15 : 0.05

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, Math.abs(swing) * 0.15, {
    legL: -2,
    legR: -2,
    armL: -swing * 0.3,
    armR: swing,
    bodyTilt: tilt,
  })

  // 진척 바 (광맥 체력)
  if (creature.isAdult && creature.target && creature.target.energy !== undefined) {
    RenderUtils.drawBar(
      ctx,
      creature.x,
      creature.y - drawSize - 8,
      22, 3,
      creature.target.energy / (creature.target.maxEnergy || 100),
      '#aab7b8', '#f1c40f',
    )
  }
}
