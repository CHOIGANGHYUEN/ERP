import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';

/**
 * 🍽️ EatState
 * 아이템 기반 식사 행동: 바닥에 드랍된 아이템(DroppedItem)이나 창고의 자원을 소모하여 허기를 채웁니다.
 * 살아있는 자원은 더 이상 직접 먹지 않으며, 반드시 드랍된 아이템 상태여야 합니다.
 */
export default class EatState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const stats = entity.components.get('BaseStats');

        const target = this.system.entityManager.entities.get(state.targetId);

        // 1. 타겟 소멸 시 복귀
        if (!target) {
            state.targetId = null;
            state.timer = 0;
            return AnimalStates.IDLE;
        }

        const tPos = target.components.get('Transform');
        const droppedItem = target.components.get('DroppedItem');
        const storage = target.components.get('Storage');

        // 2. 사거리 체크 (너무 멀어지면 다시 추적)
        if (tPos) {
            const dx = tPos.x - transform.x;
            const dy = tPos.y - transform.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > 625) { // 25px 이상이면 다시 추적 (FORAGE)
                return AnimalStates.FORAGE;
            }
        }

        // 3. 포만감 체크
        if (stats && stats.hunger >= stats.maxHunger * 0.98) {
            state.targetId = null;
            state.timer = 0;
            return AnimalStates.IDLE;
        }

        // 4. 섭취 루프
        if (droppedItem || storage) {
            state.timer = (state.timer || 0) + dt;
            const eatInterval = 0.5; // 0.5초마다 1개씩 섭취

            if (state.timer >= eatInterval) {
                state.timer = 0;
                
                let success = false;
                let itemType = '';

                if (droppedItem) {
                    // 바닥 아이템 소모
                    if (droppedItem.amount > 0) {
                        droppedItem.amount -= 1;
                        itemType = droppedItem.itemType;
                        success = true;
                        
                        if (droppedItem.amount <= 0) {
                            this.system.entityManager.removeEntity(state.targetId);
                            state.targetId = null;
                        }
                    }
                } else if (storage) {
                    // 창고 자원 소모 (나중에 구현 가능)
                }

                if (success) {
                    // 🍖 허기 회복
                    const nutrition = this._getNutritionValue(itemType);
                    stats.hunger = Math.min(stats.maxHunger, stats.hunger + nutrition);
                    stats.waste = Math.min(stats.maxWaste, (stats.waste || 0) + nutrition * 0.5);
                    
                    // 시각 효과 파티클 (입가에 가루 등)
                    if (this.system.eventBus && transform) {
                        this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                            x: transform.x, y: transform.y - 5, count: 2, type: 'DUST', color: '#fff'
                        });
                    }

                    // 충분히 배부르면 종료
                    if (stats.hunger >= stats.maxHunger * 0.98) {
                        state.targetId = null;
                        return AnimalStates.IDLE;
                    }
                } else {
                    // 먹을 게 없으면 포기
                    state.targetId = null;
                    return AnimalStates.IDLE;
                }
            }
        } else {
            // 타겟이 음식이 아님
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        return null;
    }

    _getNutritionValue(itemType) {
        const config = this.system.engine.resourceBalance[itemType] || {};
        return config.nutrition || 10;
    }
}
