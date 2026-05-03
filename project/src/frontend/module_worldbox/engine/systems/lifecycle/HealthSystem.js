import System from '../../core/System.js';

/**
 * 🏥 HealthSystem
 * 모든 엔티티의 체력 상태 업데이트, 피격 효과 타이머 관리, 자가 치유(Regeneration) 등을 담당합니다.
 * 렌더러에 분산되어 있던 로직을 중앙 집중화하여 성능과 일관성을 높입니다.
 */
export default class HealthSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
    }

    update(dt, time) {
        const em = this.entityManager;
        
        // 모든 엔티티 순회 (체력 컴포넌트가 있는 개체 대상)
        for (const [id, entity] of em.entities) {
            const health = entity.components.get('Health');
            if (!health) continue;

            // 1. 🤕 피격 타이머 업데이트 (시각 효과용)
            if (health.hitTimer > 0) {
                health.hitTimer = Math.max(0, health.hitTimer - dt);
            }

            // 2. 🌱 자가 치유 (선택 사항: 나중에 종별 스탯에 따라 조정 가능)
            if (health.currentHp > 0 && health.currentHp < health.maxHp) {
                // 초당 최대 체력의 1% 회복 (전투 중이 아닐 때만 등 조건 추가 가능)
                if (health.hitTimer <= 0) {
                    const regenAmount = health.maxHp * 0.01 * dt;
                    health.currentHp = Math.min(health.maxHp, health.currentHp + regenAmount);
                }
            }

            // 3. 💀 사망 이벤트 트리거링 (이미 DeathProcessor가 하고 있지만, 여기서 상태를 확정할 수도 있음)
            // if (health.currentHp <= 0) { ... }
        }
    }
}
