/**
 * FOLLOWING — 부모(target)를 쫓아다니는 아기 동물의 행동
 */
export const FOLLOWING = (animal, deltaTime, world) => {
    if (!animal.target || animal.target.isDead) {
        animal.parent = null // 부모가 죽거나 사라지면 독립
        animal.state = 'WANDERING'
        animal.target = null
        return
    }

    const dist = animal.distanceTo(animal.target)

    if (dist > 80) {
        // 거리가 멀면 부모를 향해 약간 빠르게 쫓아감
        animal.moveToTarget(animal.target.x, animal.target.y, deltaTime, world, 1.2)
    } else if (dist > 30) {
        // 적당한 거리에서는 부모 주변을 약하게 배회
        if (Math.random() < 0.05) {
            animal.targetX = animal.target.x + (Math.random() - 0.5) * 80
            animal.targetY = animal.target.y + (Math.random() - 0.5) * 80
        }
        if (animal.targetX && animal.targetY) {
            animal.moveToTarget(animal.targetX, animal.targetY, deltaTime, world)
        }
    } else {
        // 너무 가까우면 제자리에 머묾 (상태 요동 방지)
        animal.targetX = animal.x
        animal.targetY = animal.y
    }
}