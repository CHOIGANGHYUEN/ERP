import { AnimalStates } from '../../../components/behavior/State.js';

/**
 * 🧠 HumanBrain
 * 인간 개체의 고도화된 행동 우선순위를 결정합니다.
 */
export default class HumanBrain {
    constructor(entityManager, eventBus, engine) {
        this.em = entityManager;
        this.eventBus = eventBus;
        this.engine = engine;
    }

    /**
     * 인간의 현재 상태를 기반으로 최적의 행동(State)을 결정합니다.
     */
    decide(entity, state, stats, emotion, inventory) {
        // 0. 현재 진행 중인 상태 방어 (외부에서 끼어들어 상태를 망치는 것 방지)
        if (state.mode === AnimalStates.EAT && stats.hunger < 90) return AnimalStates.EAT;
        if (state.mode === AnimalStates.FORAGE && state.targetId) return AnimalStates.FORAGE;
        if (state.mode === 'build' && state.targetId) return 'build';
        if (state.mode === AnimalStates.SLEEP) return AnimalStates.SLEEP;
        if (state.mode === 'deposit' && state.targetId) return 'deposit';

        // 1. 생존 직결: 배가 많이 고프면 음식 탐색 최우선
        if (stats.hunger < 30) {
            return this._tryForage(entity, state, stats);
        }

        // 1.5. 인벤토리가 꽉 찼으면 창고에 보관
        if (inventory && inventory.getTotal() >= inventory.capacity) {
            return 'deposit';
        }

        // 2. 마을 과업 확인 (건설 우선순위)
        const civ = entity.components.get('Civilization');
        const vs = this.engine.systemManager.villageSystem;

        if (civ && civ.villageId !== -1 && vs) {
            const village = vs.getVillage(civ.villageId);
            if (village && village.currentTask && village.currentTask.type === 'build') {
                const blueprintTarget = this.em.entities.get(village.currentTask.targetId);
                // 청사진이 아직 유효한 경우에만 건설 지시
                if (blueprintTarget) {
                    state.targetId = village.currentTask.targetId;
                    return 'build';
                }
            }
        }

        // 3. 조금 배고파지기 시작하면 음식 탐색
        if (stats.hunger < 60) {
            return this._tryForage(entity, state, stats);
        }

        // 4. 피로도가 높으면 수면
        if (stats.fatigue > 70) return AnimalStates.SLEEP;

        // 5. 마을에 소속되어 있고 할 일이 없다면 자원 채집
        if (civ && civ.villageId !== -1) {
            return 'gather_wood';
        }

        return AnimalStates.IDLE;
    }

    /**
     * 가장 가까운 음식을 찾아 targetId를 설정한 뒤 FORAGE 상태를 반환합니다.
     * 음식을 찾지 못하면 IDLE을 반환합니다.
     */
    _tryForage(entity, state, stats) {
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        if (!transform || !animal) return AnimalStates.IDLE;

        // 배고플수록 더 넓은 범위 탐색
        const searchRadius = 250 + (100 - stats.hunger) * 3;

        const humanBehaviorSystem = this.engine.systemManager?.humanBehavior;
        if (humanBehaviorSystem) {
            const foodId = humanBehaviorSystem.foodSensor.findFood(animal, transform.x, transform.y, searchRadius);
            if (foodId) {
                state.targetId = foodId;
                return AnimalStates.FORAGE;
            }
        }

        // 음식을 못 찾으면 배회
        return AnimalStates.IDLE;
    }
}
