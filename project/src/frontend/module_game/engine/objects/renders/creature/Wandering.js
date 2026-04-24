import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * WANDERING — 8프레임 보행 사이클 도트 애니메이션
 * Layer2: 다리 교차 보행, Layer3: 몸 좌우 기울기, Layer4: 눈 깜빡임
 */
export const WANDERING = (creature, ctx, timestamp, world) => {
  const speed = creature.movement?.speed || 50
  const t = timestamp * 0.006 * (speed / 50) // 이동 속도에 비례한 애니메이션 속도
  
  const bounce = Math.abs(Math.sin(t * Math.PI))
  const swing = Math.sin(t * Math.PI)
  
  const animProps = {
    legL: swing * 4,
    legR: -swing * 4,
    armL: -swing * 5,
    armR: swing * 5,
    bodyTilt: swing * 0.05,
    bounce: bounce * 1,
    squash: 1 + bounce * 0.05,
    blinkPhase: (Math.sin(timestamp * 0.001 + creature.id) > 0.98) ? 1 : 0
  }
  
  drawCreatureBody(creature, ctx, world, timestamp, 0, animProps)
}
