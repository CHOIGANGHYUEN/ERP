import { FamilySystem } from '../../../systems/FamilySystem.js'

export const MATING = (creature, deltaTime, world) => {
  const partner = creature.target
  // 파트너가 없거나, 죽었거나, 더 이상 짝짓기 상태가 아니면 배회로 전환
  if (!partner || partner.isDead || partner.state !== 'MATING') {
    creature.state = 'WANDERING'
    creature.target = null
    return
  }

  // 파트너에게 이동
  if (creature.distanceTo(partner) > creature.size) {
    creature.moveToTarget(partner.x, partner.y, deltaTime, world)
  } else {
    // 가까워지면 잠시 대기 후 번식
    creature.aiTickTimer += deltaTime
    if (creature.aiTickTimer > 2000) {
      // 2초
      creature.aiTickTimer = 0
      creature.needs.matingUrge = 0

      // 한쪽만 번식을 실행하여 중복 방지 (ID가 더 큰 쪽)
      if (
        creature.id > partner.id &&
        creature.village &&
        (creature.village.inventory.food || 0) >= 10
      ) {
        creature.village.inventory.food -= 10
        world.spawnCreature(
          creature.x + (Math.random() - 0.5) * 30,
          creature.y + (Math.random() - 0.5) * 30,
        )

        // [가문 계승] 신규 크리쳐 생성 직후 마지막으로 소환된 크리쳐에게 성씨 계승
        // world.spawnCreature는 내부적으로 배열 끝에 추가하므로 마지막 원소가 자식
        const child = world.creatures[world.creatures.length - 1]
        if (child) {
          FamilySystem.inheritFamily(creature, partner, child)
          // 이벤트 알림
          const idx = world.creatures.indexOf(creature)
          if (idx !== -1) {
            world.showSpeechBubble(
              idx,
              'creature',
              `👶 ${child.familyName}씨 탄생!`,
              3000,
            )
          }
        }
      }

      // 둘 다 배회 상태로 복귀
      creature.state = 'WANDERING'
      creature.target = null
    }
  }
}
