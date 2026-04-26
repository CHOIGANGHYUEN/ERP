/**
 * HIDING — 악천후나 밤에 은신처로 이동하여 휴식
 */
export const HIDING = (animal, deltaTime, world) => {
    // 대상이 파괴되었거나, 아침+맑은 날씨가 되면 은신 종료 및 배회로 전환
    const isRaining = world.weather && world.weather.weatherType === 'rain'
    const isNight = world.timeSystem && (world.timeSystem.timeOfDay > 19000 || world.timeSystem.timeOfDay < 5000)

    if (!animal.target || animal.target.isDead || (!isRaining && !isNight)) {
        animal.state = 'WANDERING'
        animal.target = null
        return
    }

    if (animal.distanceTo(animal.target) < (animal.target.size || 16) + 15) {
        // 은신처 도착 시 안전하게 휴식 (피로도 감소)
        animal.needs.fatigue -= (deltaTime / 1000) * 3.0
        if (animal.needs.fatigue < 0) animal.needs.fatigue = 0
    } else {
        animal.moveToTarget(animal.target.x, animal.target.y, deltaTime, world)
    }
}