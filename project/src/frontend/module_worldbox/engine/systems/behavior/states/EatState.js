import State from './State.js';
import { GlobalLogger } from '../../../utils/Logger.js';
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
        const resource = target.components.get('Resource');

        if (droppedItem || storage || resource) {
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
                        
                        GlobalLogger.info(`Entity ${entityId} consumed 1 ${itemType}. (Hunger: ${Math.floor(stats.hunger)})`);

                        if (droppedItem.amount <= 0) {
                            this.system.entityManager.removeEntity(state.targetId);
                            state.targetId = null;
                        }
                    } else {
                        this.system.entityManager.removeEntity(state.targetId);
                        state.targetId = null;
                        return AnimalStates.IDLE;
                    }
                } else if (storage) {
                    // 창고 자원 소모 (인간용)
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
                        
                        const config = this.system.engine.resourceConfig?.[itemType] || {};
                        nutrition = Number(config.nutrition) || 15;
                    }
                } else if (resource) {
                    // 🌿 살아있는 자원(식물 등) 직접 섭취
                    if (resource.value > 0) {
                        resource.value -= 1;
                        itemType = resource.type || 'plant';
                        success = true;
                        
                        // 영양가 (식물은 보통 낮음)
                        nutrition = resource.nutrition || 5;

                        // Tick-by-tick log removed for performance and noise reduction

                        if (resource.value <= 0) {
                            this.system.entityManager.removeEntity(state.targetId);
                            state.targetId = null;
                        }
                    }
                }

                if (success) {
                    const oldHunger = stats.hunger;
                    stats.hunger = Math.min(stats.maxHunger || 100, stats.hunger + nutrition);
                    stats.storedFertility = Math.min(stats.maxWaste || 100, (stats.storedFertility || 0) + nutrition * 0.5);
                    
                    if (this.system.eventBus && transform) {
                        this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                            x: transform.x, y: transform.y - 5, count: 2, type: 'DUST', color: '#fff'
                        });
                    }

                    if (stats.hunger >= (stats.maxHunger || 100) * 0.98) {
                        state.targetId = null;
                        return AnimalStates.IDLE;
                    }
                } else {
                    state.targetId = null;
                    return AnimalStates.IDLE;
                }
            }
        } else {
            console.warn(`⚠️ [EatState] Target ${state.targetId} is missing edible components.`);
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
