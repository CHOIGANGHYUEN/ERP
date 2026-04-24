import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * GATHERING — 허리 숙여 채집하는 모션 (5프레임 사이클)
 * Layer2: 다리 굽힘, Layer3: 몸 앞으로 기울기+팔 아래로
 * Layer5: 채집 파티클 스파크
 */
export const GATHERING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.01
  const cycle = Math.sin(t * Math.PI)
  const armDown = 3 + cycle * 2

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 2, {
    legL: 1, legR: 1,
    armL: armDown, armR: armDown,
    bodyTilt: 0.15,
    toolOffset: {
      x: Math.cos(creature.rotation || 0) * 4,
      y: Math.sin(creature.rotation || 0) * 2 + armDown,
      rotation: 0,
      color: '#f39c12' // 자루(Sack) 색상
    }
  })
}
