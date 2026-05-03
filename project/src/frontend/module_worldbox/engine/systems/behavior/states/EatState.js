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

        // 🚀 [User Request] 관성 제거: 식사 중에는 이동 정지
        if (transform) {
            transform.vx = 0;
            transform.vy = 0;
        }

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
                let nutrition = 10;

                if (droppedItem) {
                    // 바닥 아이템 소모
                    const currentAmount = Number(droppedItem.amount);
                    if (!isNaN(currentAmount) && currentAmount > 0) {
                        droppedItem.amount = currentAmount - 1;
                        itemType = droppedItem.itemType;
                        success = true;
                        
                        // 영양가 계산
                        const config = this.system.engine.resourceConfig?.[itemType] || {};
                        nutrition = Number(config.nutrition) || 10;
                        
                        console.log(`🍴 [EatTick] Entity ${entityId} consumed 1 ${itemType}. Remaining: ${droppedItem.amount}`);

                        if (droppedItem.amount <= 0) {
                            console.log(`🗑️ [EatAction] Item ${state.targetId} exhausted. Removing.`);
                            this.system.entityManager.removeEntity(state.targetId);
                            state.targetId = null;
                        }
                    } else {
                        console.warn(`🍴 [EatAction] Item ${state.targetId} has invalid amount or exhausted: ${droppedItem.amount}`);
                        this.system.entityManager.removeEntity(state.targetId);
                        state.targetId = null;
                        return AnimalStates.IDLE;
                    }
                } else if (storage) {
                    // 창고 자원 소모 (인간용) - 다양한 식량 자원 지원
                    const foodTypes = ['food', 'fruit', 'berry', 'meat', 'wheat'];
                    let foundType = null;
                    
                    for (const type of foodTypes) {
                        if ((storage.items[type] || 0) > 0) {
                            foundType = type;
                            break;
                        }
                    }

                    if (foundType) {
                        storage.items[foundType] -= 1;
                        itemType = foundType;
                        success = true;
                        
                        // 영양가 계산
                        const config = this.system.engine.resourceConfig?.[itemType] || {};
                        nutrition = Number(config.nutrition) || 15;
                        
                        console.log(`🏠 [EatTick] Entity ${entityId} ate ${itemType} from storage. Remaining: ${storage.items[itemType]}`);
                    }
                }

                if (success) {
                    // 🍖 허기 회복
                    const oldHunger = stats.hunger;
                    stats.hunger = Math.min(stats.maxHunger || 100, stats.hunger + nutrition);
                    
                    // 💩 배설물 포인트 축적 (MetabolismSystem과 이름 통일: storedFertility)
                    stats.storedFertility = Math.min(stats.maxWaste || 100, (stats.storedFertility || 0) + nutrition * 0.5);
                    
                    console.log(`✅ [EatSuccess] Entity ${entityId} ate ${itemType}. Hunger: ${oldHunger.toFixed(1)} -> ${stats.hunger.toFixed(1)} (+${nutrition})`);

                    // 시각 효과 파티클
                    if (this.system.eventBus && transform) {
                        this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                            x: transform.x, y: transform.y - 5, count: 2, type: 'DUST', color: '#fff'
                        });
                    }

                    // 충분히 배부르면 종료
                    if (stats.hunger >= (stats.maxHunger || 100) * 0.98) {
                        console.log(`😋 [EatState] Entity ${entityId} is FULL.`);
                        state.targetId = null;
                        return AnimalStates.IDLE;
                    }
                } else {
                    console.log(`🚫 [EatState] Nothing to consume at target ${state.targetId}.`);
                    state.targetId = null;
                    return AnimalStates.IDLE;
                }
            }
        } else {
            console.warn(`⚠️ [EatState] Target ${state.targetId} is neither DroppedItem nor Storage.`);
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        return null;
    }

    _getNutritionValue(itemType) {
        const config = this.system.engine.resourceConfig[itemType] || {};
        return config.nutrition || 10;
    }
}
