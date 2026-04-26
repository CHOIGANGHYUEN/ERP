import { drawAnimalBody } from './drawAnimalBody.js'

/**
 * MATING — 구애 및 번식 모션
 * 제자리에서 가볍게 방방 뛰며 하트(💖)가 머리 위에서 피어오릅니다.
 */
export const MATING = (animal, ctx, timestamp, world) => {
    const t = timestamp * 0.008
    const bounce = -Math.abs(Math.sin(t * Math.PI)) * 3

    const animProps = {
        legFL: 0, legFR: 0, legBL: 0, legBR: 0,
        tailAngle: Math.sin(t * 5) * 0.5, // 꼬리를 빠르게 살랑살랑 흔듦
        bodyTilt: Math.sin(t * 2) * 0.1,
        blinkPhase: (Math.sin(t * 0.5) + 1) * 0.5 // 흥분해서 눈을 깜빡임
    }

    const drawSize = drawAnimalBody(animal, ctx, world, timestamp, bounce, animProps)

    if (Math.sin(t * 4) > 0.5) {
        ctx.font = '12px Arial'
        ctx.fillText('💖', animal.x, animal.y - drawSize - 10 - bounce)
    }
}