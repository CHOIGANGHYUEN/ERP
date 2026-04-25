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
  if (creature.distanceTo(partner) > creature.size + 5) {
    creature.moveToTarget(partner.x, partner.y, deltaTime, world)
    creature._matingProgress = 0 // 멀어지면 진행도 초기화
  } else {
    // 가까워지면 잠시 대기 후 번식 (공용 aiTickTimer와 충돌 방지를 위해 전용 변수 사용)
    creature._matingProgress = (creature._matingProgress || 0) + deltaTime
    if (creature._matingProgress > 2000) {
      // 2초 도달
      creature._matingProgress = 0
      creature.needs.matingUrge = 0

      // 한쪽만 번식을 실행하여 중복 방지 (ID가 더 큰 쪽)
      if (creature.id > partner.id) {
        if (creature.village && (creature.village.inventory.food || 0) >= 5) {
          creature.village.inventory.food -= 5
          world.spawnCreature(
            creature.x + (Math.random() - 0.5) * 30,
            creature.y + (Math.random() - 0.5) * 30,
          )

          // [가문 계승] 신규 크리쳐 생성 직후 마지막으로 소환된 크리쳐에게 성씨 계승
          const child = world.creatures[world.creatures.length - 1]
          if (child) {
            FamilySystem.inheritFamily(creature, partner, child)
            const idx = world.creatures.indexOf(creature)
            if (idx !== -1) {
              world.showSpeechBubble(idx, 'creature', `👶 ${child.familyName}씨 탄생!`, 3000)
            }
          }
        } else {
          // 식량 부족 피드백
          const idx = world.creatures.indexOf(creature)
          if (idx !== -1) {
            world.showSpeechBubble(idx, 'creature', `🍱 식량이 부족해! (5개 필요)`, 2000)
          }
        }
      }

      // 둘 다 배회 상태로 복귀
      creature.state = 'WANDERING'
      creature.target = null
      partner.state = 'WANDERING' // 파트너도 함께 해제
      partner.target = null
    }
  }
}
