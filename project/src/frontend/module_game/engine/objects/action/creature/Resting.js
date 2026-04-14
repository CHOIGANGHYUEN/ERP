import { CreatureEmotion } from '../../emotions/CreatureEmotion.js'

export const RESTING = (creature, deltaTime, world) => {
  const house = creature.target
  // 목표가 집이 아니거나, 집이 파괴되었거나, 꽉 찼으면 배회 상태로 전환
  if (
    !house ||
    house.isDead ||
    !house.isConstructed ||
    (house.occupants.length >= house.capacity && !house.occupants.includes(creature))
  ) {
    creature.state = 'WANDERING'
    creature.target = null
    if (house && house.occupants.includes(creature)) {
      house.occupants = house.occupants.filter((o) => o !== creature)
    }
    return
  }

  // 집에 도착하면
  if (creature.distanceTo(house) < creature.size + house.size / 2) {
    // 아직 입실 안했으면 입실 처리
    if (!house.occupants.includes(creature)) {
      house.occupants.push(creature)
    }

    // 피로도 빠르게 회복 (일반 회복보다 5배 빠름)
    CreatureEmotion.fulfillFatigue(creature, deltaTime * 0.5)
    creature.energy = Math.min(creature.maxEnergy, creature.energy + deltaTime * 0.05) // 체력 회복

    // 피로가 다 풀리면 집에서 나와서 배회
    if (creature.needs.fatigue <= 0) {
      creature.state = 'WANDERING'
      creature.target = null
      house.occupants = house.occupants.filter((o) => o !== creature)
    }
  } else {
    // 집으로 이동
    creature.moveToTarget(house.x, house.y, deltaTime, world)
  }
}
