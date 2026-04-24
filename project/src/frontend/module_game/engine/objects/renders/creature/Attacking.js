import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * ATTACKING — 무기를 휘두르거나 찌르는 모션
 */
export const ATTACKING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.015
  const swing = Math.sin(t * Math.PI) * 15
  
  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, {
    legL: 2, legR: -2,
    armL: -swing * 0.2,
    armR: swing,
    bodyTilt: 0.1,
    toolOffset: {
      x: Math.cos(creature.rotation || 0) * 10,
      y: Math.sin(creature.rotation || 0) * 5,
      rotation: (creature.rotation || 0) + (swing * 0.1),
      color: '#c0392b' // 검(Sword) 색상
    }
  })
}
