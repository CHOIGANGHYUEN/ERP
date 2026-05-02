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
        const predatorId = this.predatorSensor.findNearestPredator(this.entityManager.entities.get(id), 120);
        if (predatorId) {
            state.targetId = predatorId;
            state.mode = AnimalStates.FLEE;
            return;
        }

        // 2. 허기 관리 (도망 중이 아닐 때만)
        if (state.mode !== AnimalStates.FLEE) {
            if (stats.hunger < 60 && state.mode !== AnimalStates.GRAZE) {
                state.mode = AnimalStates.GRAZE; // 전용 GrazeState 사용
            }
        }

        // 3. 상태 유지 및 전이
        if (state.mode === AnimalStates.IDLE || !state.mode) {
            state.mode = AnimalStates.WANDER;
        }
    }
}
