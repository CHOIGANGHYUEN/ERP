import { drawAnimalBody } from './drawAnimalBody.js'

/**
 * EATING — 먹이 먹는 모션
 * 고개를 푹 숙이고 다리를 접은 상태
 */
export const EATING = (animal, ctx, timestamp, world) => {
  const t = timestamp * 0.005
  // 고개를 흔들며 뜯어먹는 바운스
  const bounce = Math.abs(Math.sin(t * Math.PI)) * 2

  const animProps = {
    legFL: 2, // 다리 약간 낮춤
    legFR: 2,
    legBL: 3, 
    legBR: 3,
    tailAngle: 0.2 + Math.sin(t * 4) * 0.1, // 꼬리 살랑살랑
    bodyTilt: 0.3, // 고개 푹 숙임
    blinkPhase: (Math.sin(t * 0.5) + 1) * 0.5
  }
  
  const drawSize = drawAnimalBody(animal, ctx, world, timestamp, bounce, animProps)

  // 먹는 즐거움 이펙트
  if (Math.sin(t * 2) > 0.5) {
    ctx.fillStyle = '#2ecc71'
    ctx.fillText('🎶', animal.x + 5, animal.y - drawSize)
  }
}
