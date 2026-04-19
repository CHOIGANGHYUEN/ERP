import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * GATHERING — 허리 숙여 채집하는 모션 (5프레임 사이클)
 * Layer2: 다리 굽힘, Layer3: 몸 앞으로 기울기+팔 아래로
 * Layer5: 채집 파티클 스파크
 */
export const GATHERING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.004
  const cycle = Math.sin(t * Math.PI) // -1 ~ 1

  // 허리를 굽혔다 펴는 리듬
  const bendY    = 3 + cycle * 2          // 하체 고정, 상체만 아래로
  const tilt     = 0.18 + cycle * 0.06   // 앞으로 기울어짐

  // 두 팔 아래로 뻗어 채집
  const armDown  = 4 + cycle * 3

  // Layer5: 채집 반짝임 (녹색/노란 스파크)
  const S = creature.size || 16
  const sparkX = creature.x + Math.cos(t * 3.7) * 8
  const sparkY = creature.y + 4 + Math.sin(t * 5.1) * 4
  ctx.fillStyle = cycle > 0 ? '#2ecc71' : '#f1c40f'
  ctx.fillRect(sparkX, sparkY, 2, 2)
  ctx.fillStyle = '#27ae60'
  ctx.fillRect(sparkX + 4, sparkY - 2, 2, 2)

  drawCreatureBody(creature, ctx, world, timestamp, bendY, {
    legL:     2,
    legR:     2,
    armL:     armDown,
    armR:     armDown,
    bodyTilt: tilt,
    blinkPhase: 0, // 집중 = 눈 고정
  })
}
