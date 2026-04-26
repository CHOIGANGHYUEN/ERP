import { MoveTask } from '../../tasks/MoveTask.js'
import { BuildTask } from '../../tasks/BuildTask.js'
import { findPath, PATH_THROTTLED } from '../../../systems/PathSystem.js'
import { JobAssigner } from '../JobAssigner.js'

export const BUILDER = (creature, world) => {
  // 0. 기초 검증
  if (!creature.village) {
    return creature.wander(world)
  }

  // 💡 [자동 복구] 30초 이상 isUnreachable 상태인 건물을 재시도 가능 상태로 복구
  const staleThreshold = 30000
  creature.village.buildings.forEach((b) => {
    if (b.isUnreachable && b._unreachableAt && Date.now() - b._unreachableAt > staleThreshold) {
      b.isUnreachable = false
      b._unreachableAt = null
    }
  })

  // 💡 [프리징 차단] 부지 탐색에 연달아 실패한 건축가는 5초간 탐색을 쉬게 하여 길찾기 연산 폭주를 차단
  const now = Date.now()
  if (creature._buildCooldown && now - creature._buildCooldown < 5000) {
    return creature.wander(world)
  }

  // 1. 기존에 짓고 있는 건물이 있는지 확인 (우선순위 최고)
  let targetBuilding = creature.village.buildings.find((b) => !b.isConstructed && !b.isUnreachable)

  if (!targetBuilding) {
    // 신규 기획 단계 (Town Planning) 진입
    const inv = creature.village.inventory
    const wood = inv.wood || 0
    const stone = inv.stone || 0
    const gold = inv.gold || 0

    const bList = creature.village.buildings
    const population = creature.village.creatures.length

    const housingCapacity = bList
      .filter((b) => b.type === 'HOUSE' && b.isConstructed)
      .reduce((sum, b) => sum + (b.capacity || 2), 0)

    let type = null
    let costWood = 0
    let costStone = 0
    let costGold = 0

    // Town Planning 우선순위 결정
    if (!bList.some((b) => b.type === 'TOWN_HALL') && wood >= 100 && stone >= 50) {
      type = 'TOWN_HALL'
      costWood = 100
      costStone = 50
    } else if (population > housingCapacity && wood >= 30) {
      type = 'HOUSE'
      costWood = 30
    } else if (bList.filter((b) => b.type === 'FARM').length < population / 5 && wood >= 40) {
      type = 'FARM'
      costWood = 40
    } else if (!bList.some((b) => b.type === 'MARKET') && population >= 15 && wood >= 120 && stone >= 40) {
      type = 'MARKET'
      costWood = 120
      costStone = 40
    } else if (!bList.some((b) => b.type === 'BARRACKS') && population >= 10 && wood >= 80 && stone >= 40) {
      type = 'BARRACKS'
      costWood = 80
      costStone = 40
    } else if (!bList.some((b) => b.type === 'SMITHY') && wood >= 60 && stone >= 40) {
      type = 'SMITHY'
      costWood = 60
      costStone = 40
    } else if (wood >= 60) {
      type = 'HOUSE'
      costWood = 30
    }

    if (type) {
      let success = false
      let spawnX, spawnY
      
      // 💡 [Advanced Town Planning] 무작위 스폰 대신 '격자(Grid)형 구획' 시스템 도입
      // 마을 중심점으로부터 일정 간격(48px)으로 빈 공간을 탐색합니다.
      const gridSize = 48
      const villageX = creature.village.x
      const villageY = creature.village.y
      
      // 나선형 탐색 (Spiral Search)으로 중심에서 가장 가까운 빈 공간 찾기
      let foundSlot = false
      const maxSearchRadius = 15 // 15바퀴 (더 넓게 탐색)
      const vId = world.villages.indexOf(creature.village) + 1

      for (let r = 1; r <= maxSearchRadius && !foundSlot; r++) {
        for (let ix = -r; ix <= r && !foundSlot; ix++) {
          for (let iy = -r; iy <= r && !foundSlot; iy++) {
            // 가장자리(외곽)부터 탐색
            if (Math.abs(ix) !== r && Math.abs(iy) !== r) continue
            
            const candX = villageX + ix * gridSize
            const candY = villageY + iy * gridSize
            
            // 기존 건물과 겹치는지 체크 (간격 유지)
            const isOverlap = bList.some(b => 
              Math.sqrt(Math.pow(b.x - candX, 2) + Math.pow(b.y - candY, 2)) < gridSize * 0.8
            )
            
            if (!isOverlap) {
              // 💡 [Grid Validation] 지형 및 영토 체크
              let validTerrain = true
              if (world.terrain && world.territory) {
                const cols = Math.ceil(world.width / 16)
                const tx = Math.floor(candX / 16)
                const ty = Math.floor(candY / 16)
                const tidx = ty * cols + tx

                // 1. 내 영토가 맞는지 확인!
                if (tx < 0 || tx >= cols || ty < 0 || ty >= Math.ceil(world.height / 16)) {
                  validTerrain = false
                } else if (world.territory[tidx] !== vId) {
                  // 타운홀 건물은 첫 건물이므로 예외적으로 빈 공간 허용
                  if (type !== 'TOWN_HALL' || world.territory[tidx] !== 0) {
                    validTerrain = false
                  }
                }
                
                // 2. 바다/산맥인지 확인
                if (validTerrain) {
                  const t = world.terrain[tidx]
                  if (t === 2 || t >= 4) validTerrain = false
                }
              }
              
              if (validTerrain) {
                const path = findPath(world, creature, { x: candX, y: candY })
                if (path && path !== PATH_THROTTLED) {
                  spawnX = candX
                  spawnY = candY
                  foundSlot = true
                  success = true
                }
              }
            }
          }
        }
      }

      if (success) {
        if (costWood) inv.wood -= costWood
        if (costStone) inv.stone -= costStone
        if (costGold) inv.gold -= costGold
        
        world.spawnBuilding(spawnX, spawnY, type, creature.village)
        if (type === 'TOWN_HALL') {
          world.broadcastEvent(`[${creature.village.name}]의 중심 건물인 마을 회관(Town Hall) 건설을 시작합니다!`, '#f1c40f')
        }
      } else {
        // 부지를 찾지 못한 경우 휴식
        creature._buildCooldown = now
        creature.wander(world)
      }
      return
    } else {
      // 업그레이드 로직 (기존 건물 중 완공된 건물의 레벨업 시도)
      const upgradeable = bList.find(b => b.isConstructed && (b.level || 1) < 2 && wood >= 50)
      if (upgradeable) {
        // TODO: 레벨업 태스크 추가 가능 (지금은 인벤토리 차감 및 상태 변경으로 간소화)
        inv.wood -= 50
        upgradeable.level = (upgradeable.level || 1) + 1
        upgradeable.capacity = (upgradeable.capacity || 2) * 2 // 수용량 체감
        world.broadcastEvent(`[${creature.village.name}]의 건물이 레벨 2로 업그레이드되었습니다!`, '#2ecc71')
        return
      }
      
      if (wood < 30 && creature.village.creatures.length > 3) {
        JobAssigner.changeProfession(creature, 'LUMBERJACK', true)
        const idx = world.creatures.indexOf(creature)
        if (idx !== -1) world.showSpeechBubble(idx, 'creature', '🪓건축 자원 수집 전환', 2000)
        return
      }
      creature.wander(world)
    }
  } else {
    // 2. 기존 미완공 건물이 발견됨.
    const path = findPath(world, creature, targetBuilding)

    if (path && path !== PATH_THROTTLED) {
      if (creature.taskQueue.length === 0) {
        creature.taskQueue.push(new MoveTask(targetBuilding))
        creature.taskQueue.push(new BuildTask(targetBuilding))
      }
    } else if (path === PATH_THROTTLED) {
      creature.wander(world)
    } else {
      // 도달 불가능 마킹 (바다 너머 등)
      targetBuilding.isUnreachable = true
      targetBuilding._unreachableAt = Date.now()
      
      // 💡 [Fallback] 도달할 수 없는 상황이면 계속 빌더를 고집하지 않고 우선 채집가 등으로 전환
      const fallbackJob = Math.random() > 0.5 ? 'GATHERER' : 'LUMBERJACK'
      JobAssigner.changeProfession(creature, fallbackJob, true)
      
      creature.wander(world)
    }
  }
}
