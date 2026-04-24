import { MoveTask } from '../../tasks/MoveTask.js'
import { BuildTask } from '../../tasks/BuildTask.js'
import { findPath, PATH_THROTTLED } from '../../../systems/PathSystem.js'
import { JobAssigner } from '../JobAssigner.js'

export const BUILDER = (creature, world, _candidates) => {
  console.log(`[Builder Debug: ${creature.id}] BUILDER 로직 진입`)
  // 0. 기초 검증
  if (!creature.village) {
    console.log(`[Builder Debug: ${creature.id}] 소속 마을 없음. 배회로 전환`)
    return creature.wander(world)
  }

  // 💡 [자동 복구] 30초 이상 isUnreachable 상태인 건물을 재시도 가능 상태로 복구
  const staleThreshold = 30000
  creature.village.buildings.forEach((b) => {
    if (b.isUnreachable && b._unreachableAt && Date.now() - b._unreachableAt > staleThreshold) {
      b.isUnreachable = false
      b._unreachableAt = null
      console.log(`[Builder] ♻️ 건물(${b.id}) isUnreachable 해제 (30초 경과, 재시도 허용)`)
    }
  })

  // 💡 [프리징 차단] 부지 탐색에 연달아 실패한 건축가는 5초간 탐색을 쉬게 하여 A* 길찾기 연산 폭주를 원천 차단합니다.
  const now = Date.now()
  if (creature._buildCooldown && now - creature._buildCooldown < 5000) {
    return creature.wander(world)
  }

  console.log(`[Builder Debug: ${creature.id}] 소속 마을 확인 완료. 기존 미완공 건물 검색 시작`)

  // 1. 기존에 짓고 있는 건물이 있는지 확인
  let targetBuilding = creature.village.buildings.find((b) => !b.isConstructed && !b.isUnreachable)

  if (!targetBuilding) {
    console.log(`[Builder Debug: ${creature.id}] 기존 미완공 건물 없음. 신규 기획 단계 진입`)
    const inv = creature.village.inventory
    const wood = inv.wood || 0

    // 신규 건설 로직 진입 조건 체크
    if (wood >= 30 && Math.random() < 0.2) {
      console.groupCollapsed(`👷 [Builder: ID ${creature.id}] 신규 건물 기획 변수 추적`)
      try {
        console.log(
          `[변수] 보유 목재: ${wood}, 보유 석재: ${inv.stone || 0}, 보유 금: ${inv.gold || 0}`,
        )

        let type = 'HOUSE'
        const bList = creature.village.buildings
        let costWood = 0,
          costStone = 0,
          costGold = 0

        // 우선순위에 따른 타입 결정 로직 로그
        if (!bList.some((b) => b.type === 'FARM') && wood >= 40) {
          type = 'FARM'
          costWood = 40
          console.log(`[결정] 농장(FARM) 우선순위 채택 (목재 -40)`)
        } else if (
          bList.filter((b) => b.type === 'HOUSE').length < creature.village.creatures.length / 3 &&
          wood >= 30
        ) {
          type = 'HOUSE'
          costWood = 30
          console.log(`[결정] 집(HOUSE) 우선순위 채택 (인구 대비 집 부족, 목재 -30)`)
        } else if (!bList.some((b) => b.type === 'BARRACKS') && wood >= 50 && inv.stone >= 20) {
          type = 'BARRACKS'
          costWood = 50
          costStone = 20
          console.log(`[결정] 병영(BARRACKS) 우선순위 채택 (목재 -50, 석재 -20)`)
        } else if (!bList.some((b) => b.type === 'SMITHY') && wood >= 40 && inv.stone >= 30) {
          type = 'SMITHY'
          costWood = 40
          costStone = 30
          console.log(`[결정] 대장간(SMITHY) 우선순위 채택 (목재 -40, 석재 -30)`)
        } else if (!bList.some((b) => b.type === 'SCHOOL') && wood >= 60) {
          type = 'SCHOOL'
          costWood = 60
          console.log(`[결정] 학교(SCHOOL) 우선순위 채택 (목재 -60)`)
        } else if (
          !bList.some((b) => b.type === 'TEMPLE') &&
          wood >= 100 &&
          inv.stone >= 50 &&
          inv.gold >= 10
        ) {
          type = 'TEMPLE'
          costWood = 100
          costStone = 50
          costGold = 10
          console.log(`[결정] 사원(TEMPLE) 우선순위 채택 (목재 -100, 석재 -50, 금 -10)`)
        } else if (wood >= 30) {
          type = 'HOUSE'
          costWood = 30
          console.log(`[결정] 기본 확장: 집(HOUSE) 채택 (목재 -30)`)
        }

        let attempts = 0
        let success = false
        let spawnX, spawnY

        console.log(`[Builder Debug: ${creature.id}] 건물 타입: ${type}, 부지 탐색 루프 시작`)

        while (attempts < 3) {
          attempts++
          spawnX = creature.village.x + (Math.random() - 0.5) * 180
          spawnY = creature.village.y + (Math.random() - 0.5) * 180

          let validTerrain = true
          let terrainType = '알 수 없음'
          if (world.terrain) {
            const cols = Math.ceil(world.width / 16)
            const tx = Math.floor(spawnX / 16)
            const ty = Math.floor(spawnY / 16)
            terrainType = world.terrain[ty * cols + tx]

            if (terrainType === 2 || terrainType >= 3) {
              validTerrain = false
            }
          }

          console.log(
            `[탐색 ${attempts}/3] 좌표: (${Math.floor(spawnX)}, ${Math.floor(spawnY)}), 지형 코드: ${terrainType}`,
          )

          // 💡 [프리징 방어] NaN 좌표가 시스템에 유입되는 것을 원천 차단
          if (isNaN(spawnX) || isNaN(spawnY)) {
            console.error(`🚨 [Builder: ID ${creature.id}] NaN 좌표 발생! (${spawnX}, ${spawnY})`);
            validTerrain = false;
          }

          if (validTerrain) {
            console.log(`[탐색 ${attempts}/3] 지형 검증 통과. 길찾기(findPath) 시도...`)
            const path = findPath(world, creature, { x: spawnX, y: spawnY })
            if (path && path !== PATH_THROTTLED) {
              success = true
              console.log(
                `[결과 ${attempts}/3] ✅ 지형 유효 & 길찾기 도달 가능 확인! (경로 길이: ${path.length})`,
              )
              break
            } else if (path === PATH_THROTTLED) {
              console.log(`[결과 ${attempts}/3] ⏳ 길찾기 엔진 부하로 판단 보류. 다음 틱에 재시도합니다.`)
            } else {
              console.log(
                `[결과 ${attempts}/3] ❌ 지형은 유효하나, 현재 위치에서 길찾기로 도달 불가능함`,
              )
            }
          } else {
            console.log(`[결과 ${attempts}/3] ❌ 산/바다 등 건설 불가 지형임`)
          }
        }

        console.log(`[Builder Debug: ${creature.id}] 탐색 루프 종료. success: ${success}`)

        if (success) {
          if (costWood) inv.wood -= costWood
          if (costStone) inv.stone -= costStone
          if (costGold) inv.gold -= costGold
          console.log(
            `[최종] 🏠 건물(${type}) 배치 확정! 자원 차감 완료. world.spawnBuilding 호출 직전`,
          )
          world.spawnBuilding(spawnX, spawnY, type, creature.village)
          console.log(`[최종] world.spawnBuilding 호출 성공`)
        } else {
          console.log(`[최종] ❌ 3회 탐색 모두 실패. 배회 상태로 돌아갑니다.`)
          creature._buildCooldown = now // 실패 쿨타임 5초 적용
          creature.wander(world)
        }
      } finally {
        console.groupEnd()
      }
      return
    } else {
      console.log(`[Builder Debug: ${creature.id}] 신규 건설 조건 미달. (wood: ${wood}, 확률 체크)`)
      // 자원이 부족하거나 확률(0.2)에 걸리지 않은 경우
      if (wood < 30) {
        console.log(
          `👷 [Builder: ID ${creature.id}] 목재 부족(${wood}/30)으로 벌목꾼(LUMBERJACK) 임시 전직`,
        )
        JobAssigner.changeProfession(creature, 'LUMBERJACK', true) // 임시 전직

        const idx = world.creatures.indexOf(creature)
        if (idx !== -1) world.showSpeechBubble(idx, 'creature', '🪓나무 구하러 함!', 2000)
        return
      }
      console.log(`[Builder Debug: ${creature.id}] 배회로 전환`)
      creature.wander(world)
    }
  } else {
    // 2. 기존 미완공 건물이 있는 경우
    console.log(
      `[Builder Debug: ${creature.id}] 기존 미완공 건물 발견 (Target ID: ${targetBuilding.id}, Type: ${targetBuilding.type}). 길찾기 시작`,
    )
    const path = findPath(world, creature, targetBuilding)

    if (path && path !== PATH_THROTTLED) {
      // ✅ 경로 찾기 성공
      console.log(
        `[Builder Debug: ${creature.id}] 기존 미완공 건물 도달 가능 (경로 확인). 태스크 큐 길이: ${creature.taskQueue.length}`,
      )
      if (creature.taskQueue.length === 0) {
        console.log(`[Builder Debug: ${creature.id}] MoveTask, BuildTask 추가`)
        creature.taskQueue.push(new MoveTask(targetBuilding))
        creature.taskQueue.push(new BuildTask(targetBuilding))
      } else {
        console.log(`[Builder Debug: ${creature.id}] 이미 태스크 진행 중`)
      }
    } else if (path === PATH_THROTTLED) {
      // ⏳ 스로틀링은 일시적 상태 → isUnreachable 설정 없이 다음 틱에 재시도
      console.log(`[Builder Debug: ${creature.id}] ⏳ 길찾기 엔진 부하. 다음 틱에 재시도합니다.`)
      creature.wander(world)
    } else {
      // ❌ 진짜 도달 불가능 (null) → isUnreachable 설정
      console.log(
        `[Builder Debug: ${creature.id}] ❌ 미완공 건물 도달 불가능. isUnreachable = true 설정 후 배회`,
      )
      targetBuilding.isUnreachable = true
      targetBuilding._unreachableAt = Date.now() // 30초 후 자동 재시도용 타임스탬프
      creature.wander(world)
    }
  }
  console.log(`[Builder Debug: ${creature.id}] BUILDER 로직 종료`)
}
