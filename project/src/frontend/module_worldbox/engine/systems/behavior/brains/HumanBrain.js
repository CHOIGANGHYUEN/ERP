import { AnimalStates } from '../../../components/behavior/State.js';
import { JobTypes } from '../../../config/JobTypes.js';

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
    decide(entity, state, stats, emotion, inventory, dt) {
        // 0. 극단적 생존 위협: 배가 너무 고프면 하던 일 중단
        // 0. 생존 우선순위 (허기, 피로)
        if (stats.hunger < 35) {
            return this._tryForage(entity, state, stats);
        }

        // 1. 현재 진행 중인 핵심 생존/작업 상태 방어
        if (state.mode === AnimalStates.EAT && stats.hunger < 90) return AnimalStates.EAT;
        if (state.mode === AnimalStates.FORAGE && state.targetId) return AnimalStates.FORAGE;
        if (state.mode === AnimalStates.SLEEP) return AnimalStates.SLEEP;
        
        // 배회(Wander) 중이더라도 진행 중인 이동은 보장
        let baseDecision = (state.mode === AnimalStates.WANDER) ? AnimalStates.WANDER : AnimalStates.IDLE;
        
        // 2. 생존 직결: 배가 많이 고프면 음식 탐색 최우선
        if (stats.hunger < 30) {
            return this._tryForage(entity, state, stats);
        }

        // 3. 피로도가 높으면 수면
        if (stats.fatigue > 70) return AnimalStates.SLEEP;

        // ------------------ 생존 욕구 충족 완료 ------------------ //

        const civ = entity.components.get('Civilization');
        
        // 4. [Individual Judgment] 부여받은 직업(Role) 내에서 능동적으로 할 일을 찾음
        // IDLE 상태여도 3초를 다 기다리지 않고, 직업 로직상 할 일이 있다면 즉시 작업으로 전환
        if (civ && civ.role) {
            const roleDecision = civ.role.decide(entity, dt);
            if (roleDecision) {
                // 직업 로직이 명확한 행동 지침(나무 발견, 건설지 발견 등)을 주었다면 즉시 수행
                return roleDecision;
            }
        }

        // 5. 인벤토리가 꽉 찼다면 보관
        if (inventory && inventory.getTotal() >= inventory.capacity) {
            return 'deposit';
        }

        // 6. 아무 할 일이 없다면 기본 상태(IDLE 또는 진행 중인 WANDER) 반환
        return baseDecision;
    }

    /**
     * 가장 가까운 음식을 찾아 targetId를 설정한 뒤 FORAGE 상태를 반환합니다.
     */
    _tryForage(entity, state, stats) {
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        if (!transform || !animal) return AnimalStates.IDLE;

        const searchRadius = 250 + (100 - stats.hunger) * 3;
        const humanBehaviorSystem = this.engine.systemManager?.humanBehavior;
        if (humanBehaviorSystem) {
            const foodId = humanBehaviorSystem.foodSensor.findFood(animal, transform.x, transform.y, searchRadius);
            if (foodId) {
                state.targetId = foodId;
                return AnimalStates.FORAGE;
            }
        }
        return AnimalStates.IDLE;
    }
}
