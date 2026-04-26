import { drawAnimalBody } from './drawAnimalBody.js'

/**
 * RESTING — 수면 및 휴식 모션
 * 바닥에 주저앉아 고개를 숙이고, 눈을 감은 채 호흡합니다. Zzz 텍스트가 위로 올라갑니다.
 */
export const RESTING = (animal, ctx, timestamp, world) => {
    const t = timestamp * 0.002
    const breathe = Math.sin(t * Math.PI) * 1.5

    const animProps = {
        legFL: -3, legFR: -3, legBL: -3, legBR: -3, // 다리를 접고 엎드림
        tailAngle: 0.1,
        bodyTilt: 0.15, // 고개를 푹 숙임
        blinkPhase: 1 // 눈 완전히 감음
    }

    // yOffset을 양수로 주어 바닥에 엎드린 효과 제공
    const drawSize = drawAnimalBody(animal, ctx, world, timestamp, 4 + breathe, animProps)

    const zSize = 8 + Math.sin(t * 10) * 2
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = `${zSize}px Arial`
    ctx.fillText('Zzz', animal.x + 10, animal.y - drawSize - 5 - (t % 1 * 12))
}