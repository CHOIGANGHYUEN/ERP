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

    /**
     * 🧠 [Decide Pattern] 상태를 직접 변경하지 않고 권장 모드와 타겟을 제안합니다.
     */
    decide(id, state, transform, animal, stats, dt) {
        // 🛑 [Drag & Drop Protection] 플레이어에게 잡힌 상태면 AI 판단 중단
        if (state.mode === AnimalStates.GRABBED) return { mode: AnimalStates.GRABBED };

        // 🧠 [Decision Throttling] 판단 주기를 1초로 제한 (단, 도망 상태는 즉시 반응)
        state.thinkTimer = (state.thinkTimer || 0) + dt;
        if (state.thinkTimer < 1.0 && state.mode && state.mode !== AnimalStates.IDLE && state.mode !== AnimalStates.FLEE) {
            return { mode: state.mode, targetId: state.targetId };
        }
        state.thinkTimer = 0;

        // 1. 생존 본능 (포식자 감지 시 최우선 도망) - 인터럽트 허용
        const searchRadiusPred = 80; // 🚨 [Reduced] 120 -> 80
        const predatorId = this.predatorSensor.findNearestPredator(this.entityManager.entities.get(id), state, searchRadiusPred);
        if (predatorId) {
            state.searchRange = searchRadiusPred;
            return { mode: AnimalStates.FLEE, targetId: predatorId };
        }

        // 2. 현재 상태 유지 판단 (이미 식사/채집 중이면 해당 작업 완수 우선)
        const isBusy = (state.mode === AnimalStates.EAT || state.mode === AnimalStates.FORAGE || state.mode === AnimalStates.GRAZE) && state.targetId;
        if (isBusy) {
            return { mode: state.mode, targetId: state.targetId };
        }

        // 3. 허기 관리 (도망 중이 아닐 때만)
        if (state.mode !== AnimalStates.FLEE) {
            // 💡 [Stability] 번식 가능성 확보를 위해 허기 임계치 대폭 상향 (30/50 -> 70)
            const hungerThreshold = 70;
            
            if (stats.hunger < hungerThreshold) { 
                const isEatingPlant = (state.mode === AnimalStates.EAT || state.mode === AnimalStates.FORAGE) && state.targetId;
                
                if (!isEatingPlant) {
                    const searchRadius = 150; // 🥗 [Reduced] 400 -> 150
                    state.searchRange = searchRadius;
                    const plantId = this.findPlantItem(id, state, transform, searchRadius);
                    if (plantId) {
                        return { mode: AnimalStates.FORAGE, targetId: plantId };
                    }
                } else {
                    return { mode: state.mode, targetId: state.targetId };
                }

                if (state.mode !== AnimalStates.GRAZE) {
                    return { mode: AnimalStates.GRAZE, targetId: state.targetId };
                }
            }
        }

        // 4. 상태 유지 및 전이
        if (state.mode === AnimalStates.IDLE || !state.mode) {
            state.idleTimer = (state.idleTimer || 0) + dt;
            if (state.idleTimer >= (2.0 + Math.random() * 3.0)) {
                state.idleTimer = 0;
                return { mode: AnimalStates.WANDER, targetId: null };
            } else {
                return { mode: AnimalStates.IDLE, targetId: null };
            }
        }

        return { mode: state.mode, targetId: state.targetId };
    }

    findPlantItem(id, state, transform, radius) {
        return this.entityManager.findNearestEntityWithComponent(
            transform.x,
            transform.y,
            radius,
            (ent) => {
                const item = ent.components.get('DroppedItem');
                // 🏷️ [Standardized] 하드코딩 리스트 대신 카테고리(food, plant, grass) 활용
                const isEdible = item && (item.category === 'food' || item.category === 'plant' || item.category === 'grass');
                return isEdible && (!item.claimedBy || item.claimedBy === id);
            },
            this.spatialHash
        );
    }
}
