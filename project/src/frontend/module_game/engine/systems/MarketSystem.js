/**
 * MarketSystem — 마을 간 자원 교역 시스템
 * 주기적으로 각 마을의 자원 과잉/부족량을 계산하여 교역을 처리합니다.
 * (하네스 원칙: engine/ 내부이므로 Vue 의존성을 주입받지 않습니다.)
 */

const TRADE_INTERVAL = 10000 // 10초마다 교역 연산
const TRADE_AMOUNT = 20      // 1회 교역 물량
const SURPLUS_THRESHOLD = 80 // 이 이상이면 과잉으로 판단
const DEFICIT_THRESHOLD = 20 // 이 이하면 부족으로 판단

const TRADEABLE_RESOURCES = ['food', 'wood', 'stone', 'iron', 'gold']

export class MarketSystem {
  constructor() {
    this.tradeTimer = 0
  }

  update(deltaTime, world) {
    this.tradeTimer += deltaTime
    if (this.tradeTimer < TRADE_INTERVAL) return
    this.tradeTimer = 0

    const villages = world.villages
    if (villages.length < 2) return

    // 과잉 마을과 부족 마을을 찾아 교역 수행
    for (const resource of TRADEABLE_RESOURCES) {
      const surplus = []
      const deficit = []

      for (const v of villages) {
        if (v.isDead) continue
        const hasMarket = v.buildings.some(
          (b) => b.type === 'MARKET' && b.isConstructed,
        )
        if (!hasMarket) continue

        const amount = v.inventory[resource] || 0
        if (amount > SURPLUS_THRESHOLD) surplus.push({ village: v, amount })
        if (amount < DEFICIT_THRESHOLD) deficit.push({ village: v, amount })
      }

      // 과잉 마을 → 부족 마을 자원 이전
      for (const src of surplus) {
        for (const dst of deficit) {
          if (src.village === dst.village) continue
          const transfer = Math.min(TRADE_AMOUNT, src.amount - SURPLUS_THRESHOLD)
          if (transfer <= 0) continue

          this._transferResource(src.village, dst.village, resource, transfer, world)
          src.amount -= transfer
          dst.amount += transfer

          world.broadcastEvent(
            `[교역] ${src.village.name} → ${dst.village.name}: ${resource} ${transfer}개 이전`,
            '#f39c12',
          )
        }
      }
    }
  }

  /**
   * 두 마을 간 자원을 이전합니다.
   */
  _transferResource(fromVillage, toVillage, type, amount, _world) {
    const actual = Math.min(fromVillage.inventory[type] || 0, amount)
    if (actual <= 0) return
    fromVillage.inventory[type] = (fromVillage.inventory[type] || 0) - actual
    toVillage.inventory[type] = (toVillage.inventory[type] || 0) + actual
  }

  /**
   * 가장 가까운 교역 가능한 타 마을을 찾습니다.
   * @param {Creature} creature
   * @param {World} world
   * @returns {Village|null}
   */
  static findTradePartner(creature, world) {
    if (!creature.village) return null
    const villages = world.villages.filter(
      (v) =>
        !v.isDead &&
        v !== creature.village &&
        v.buildings.some((b) => b.type === 'MARKET' && b.isConstructed),
    )
    if (villages.length === 0) return null

    // 가장 가까운 교역 마을 반환
    let closest = null
    let minDist = Infinity
    for (const v of villages) {
      const dx = v.x - creature.x
      const dy = v.y - creature.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < minDist) {
        minDist = d
        closest = v
      }
    }
    return closest
  }
}
