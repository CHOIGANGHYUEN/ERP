import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * RETURNING — 무거운 물건을 들고 귀환하는 듯한 무거운 걷기
 */
export const RETURNING = (creature, ctx, timestamp, world) => {
  const t = timestamp * 0.005
  const leg = Math.sin(t * Math.PI) * 3
  
  drawCreatureBody(creature, ctx, world, timestamp, 0, {
    legL: leg, legR: -leg,
    armL: -2, armR: -2, // 무거운 짐을 진 팔
    bodyTilt: 0.2, // 무거워서 앞으로 숙임
    toolOffset: {
      x: -Math.cos(creature.rotation || 0) * 4, // 뒤에 봇짐
      y: -6,
      rotation: 0,
      color: '#7d3c1a' // 자루 색상
    }
  })
}
