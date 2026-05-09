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
        const sBuffer = em.statsBuffer;
        const items = em.animalIds.items; // 🚀 [Expert Optimization] Raw Array 참조
        
        // 🚀 [Expert Optimization] 개별 엔티티 조회가 아닌 ID 리스트를 기반으로 버퍼 직접 순회
        for (let i = 0; i < items.length; i++) {
            const id = items[i];
            const idx = id * 8; // [hp, maxHp, hunger, maxHunger, fatigue, maxFatigue, str, def]
            
            let hp = sBuffer[idx];
            const maxHp = sBuffer[idx + 1];
            const fatigue = sBuffer[idx + 4];

            // 1. 🌱 자가 치유 (Regeneration)
            if (hp > 0 && hp < maxHp) {
                // 초당 최대 체력의 0.5% 회복 (피로도가 낮을 때 더 잘 회복됨)
                const regenMult = Math.max(0.2, 1.0 - (fatigue / 100));
                const regenAmount = maxHp * 0.005 * regenMult * dt;
                
                hp = Math.min(maxHp, hp + regenAmount);
                sBuffer[idx] = Math.round(hp);
            }

            // 2. 🤕 피격 효과 타이머는 컴포넌트 데이터에 남아있으므로 개별 업데이트 유지
            // (DOD는 데이터 연산 중심이며, 시각 효과 등은 여전히 컴포넌트 프록시를 통해 처리 가능)
            const entity = em.entities.get(id);
            const health = entity?.components.get('Health');
            if (health && health.hitTimer > 0) {
                health.hitTimer = Math.max(0, health.hitTimer - dt);
            }
        }
    }
}
