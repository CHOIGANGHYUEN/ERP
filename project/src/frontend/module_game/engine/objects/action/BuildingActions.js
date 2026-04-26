export const BuildingActions = {
  update: (building, deltaTime, world) => {
    try {
      // 완성된 건물 효과
      if (building.isConstructed) {
        building.effectTimer += deltaTime
        if (building.effectTimer >= 5000) {
          building.effectTimer = 0
          BuildingActions.applyEconomicEffect(building)
        }

        // 티어 자동 업그레이드 조건 체크
        if (building.village && building.tier < building.maxTier) {
          building.upgradeTimer += deltaTime
          if (building.upgradeTimer >= 5000) {
            building.upgradeTimer = 0
            BuildingActions.tryUpgrade(building)
          }
        }
      }
    } catch (e) {
      console.error(`[Building Action Error] ID ${building?.id}:`, e)
    }
  },

  applyEconomicEffect: (building) => {
    if (!building.village || !building.village.inventory) return
    const inv = building.village.inventory
    const tier = building.tier || 1

    switch (building.type) {
      case 'FARM':
        // 💡 [농사 시뮬레이션] 각 칸의 작물 성장 및 토양 수분 증발
        if (building.crops) {
          building.crops.forEach(crop => {
            if (crop.status === 'GROWING' || crop.status === 'PLANTED') {
              if (crop.moisture > 0) {
                crop.status = 'GROWING'
                crop.growth += 0.2 // 성장 속도
                if (crop.growth >= 100) {
                  crop.status = 'RIPE'
                  crop.growth = 100
                }
              }
              // 초당 수분 증발
              crop.moisture = Math.max(0, crop.moisture - 0.025)
            }
          })
        }
        break
      case 'SMITHY':
        if (inv.iron >= 1) {
          inv.iron -= 1
          inv.knowledge = (inv.knowledge || 0) + 1
        }
        break
      case 'MARKET':
        inv.gold = (inv.gold || 0) + tier * 2
        if (Math.random() < 0.3) {
          inv.food = (inv.food || 0) + tier
        }
        break
    }
  },

  tryUpgrade: (building) => {
    const inv = building.village.inventory
    if (!inv) return

    const tier = building.tier
    const type = building.type

    if (type === 'HOUSE' && tier === 1) {
      if ((inv.wood || 0) >= 50 && (inv.biomass || 0) >= 20) {
        inv.wood -= 50
        inv.biomass -= 20
        BuildingActions.startUpgrade(building, 2, '#c0392b', 28)
      }
    } else if (type === 'HOUSE' && tier === 2) {
      if ((inv.wood || 0) >= 80 && (inv.stone || 0) >= 30) {
        inv.wood -= 80
        inv.stone -= 30
        BuildingActions.startUpgrade(building, 3, '#8e44ad', 32)
      }
    } else if (type === 'FARM' && tier === 1) {
      if ((inv.wood || 0) >= 60 && (inv.stone || 0) >= 20) {
        inv.wood -= 60
        inv.stone -= 20
        BuildingActions.startUpgrade(building, 2, '#2ecc71', 40)
      }
    } else if (type === 'SCHOOL' && tier === 1) {
      if ((inv.wood || 0) >= 100 && (inv.knowledge || 0) >= 50) {
        inv.wood -= 100
        inv.knowledge -= 50
        BuildingActions.startUpgrade(building, 2, '#2980b9', 40)
      }
    }
  },

  startUpgrade: (building, newTier, newColor, newSize) => {
    building.tier = newTier
    building.color = newColor
    building.size = newSize
    building.isConstructed = false
    building.progress = 0
    building.maxProgress *= 1.5
    if (building.type === 'HOUSE') {
      building.capacity = 2 * building.tier
    }
  },
}
