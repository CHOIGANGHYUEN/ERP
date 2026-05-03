import { AnimalStates } from '../../../components/behavior/State.js';
import PredatorSensor from '../sensors/PredatorSensor.js';

export default class HerbivoreBrain {
    constructor(entityManager, eventBus, engine, spatialHash) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.engine = engine;
        this.spatialHash = spatialHash;
        this.predatorSensor = new PredatorSensor(entityManager, spatialHash);
    }

    update(id, state, transform, animal, stats, dt) {
        // 🛑 [Drag & Drop Protection] 플레이어에게 잡힌 상태면 AI 판단 중단
        if (state.mode === AnimalStates.GRABBED) return;

        // 1. 생존 본능 (포식자 감지 시 최우선 도망)
        const predatorId = this.predatorSensor.findNearestPredator(this.entityManager.entities.get(id), state, 120);
        if (predatorId) {
            state.targetId = predatorId;
            state.mode = AnimalStates.FLEE;
            return;
        }

        // 2. 허기 관리 (도망 중이 아닐 때만)
        if (state.mode !== AnimalStates.FLEE) {
            if (stats.hunger < 75) { // 임계값 소폭 조정 (기회주의적 섭취 유도)
                // 🍎 [Scavenging] 
                // 이미 식물 아이템을 대상으로 FORAGE 또는 EAT 중이면 중복 판단 방지
                const isEatingPlant = (state.mode === AnimalStates.EAT || state.mode === AnimalStates.FORAGE) && state.targetId;
                
                if (!isEatingPlant) {
                    const plantId = this.findPlantItem(id, state, transform, 400);
                    if (plantId) {
                        state.targetId = plantId;
                        state.mode = AnimalStates.FORAGE;
                        return;
                    }
                } else {
                    // 이미 아이템 식사 중이면 그대로 유지 (GRAZE로 넘어가지 않도록)
                    return;
                }

                if (state.mode !== AnimalStates.GRAZE) {
                    state.mode = AnimalStates.GRAZE; // 전용 GrazeState 사용
                }
            }
        }

        // 3. 상태 유지 및 전이
        if (state.mode === AnimalStates.IDLE || !state.mode) {
            state.mode = AnimalStates.WANDER;
        }
    }

    findPlantItem(id, state, transform, radius) {
        return this.entityManager.findNearestEntityWithComponent(
            transform.x,
            transform.y,
            radius,
            (ent) => {
                const item = ent.components.get('DroppedItem');
                const isPlant = item && ['fruit', 'grass', 'flower', 'wheat'].includes(item.itemType);
                return isPlant && (!item.claimedBy || item.claimedBy === id);
            },
            this.spatialHash
        );
    }
}
