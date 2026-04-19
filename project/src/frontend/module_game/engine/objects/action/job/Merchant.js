import { MarketSystem } from '../../../systems/MarketSystem.js'

/**
 * MERCHANT 직업 행동 — 전략 패턴(Strategy Pattern) 구현
 * 시장 건물이 있는 마을들 사이를 오가며 자원을 교환합니다.
 */
export const MERCHANT = (creature, world, _candidates) => {
  if (!creature.village) return creature.wander(world)

  // 본인 마을에 시장이 없으면 배회
  const hasOwnMarket = creature.village.buildings.some(
    (b) => b.type === 'MARKET' && b.isConstructed,
  )
  if (!hasOwnMarket) return creature.wander(world)

  // 이미 교역 중이면 액션에 위임 (CreatureActions.TRADING이 처리)
  if (creature.state === 'TRADING') return

  // 타 마을 시장 탐색
  const partner = MarketSystem.findTradePartner(creature, world)
  if (partner) {
    creature.target = partner
    creature.state = 'TRADING'
    creature.tradeTimer = 0
  } else {
    // 교역 파트너가 없으면 본인 마을 배회하며 상업 활성화
    if (Math.random() < 0.3 && creature.village.inventory.gold > 0) {
      // 시장 순찰로 골드 생성 보조
      creature.village.inventory.gold = (creature.village.inventory.gold || 0) + 1
    }
    creature.wander(world, creature.village.radius * 0.5)
  }
}
