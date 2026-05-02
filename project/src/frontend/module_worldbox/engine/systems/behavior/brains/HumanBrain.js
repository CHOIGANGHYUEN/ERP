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
    decide(entity, state, stats, emotion, inventory, dt) {
        // 0. 극단적 생존 위협: 배가 너무 고프면 하던 일 중단
        if (stats.hunger < 20) {
            return this._tryForage(entity, state, stats);
        }

        // 1. 현재 진행 중인 핵심 생존/작업 상태 방어
        if (state.mode === AnimalStates.EAT && stats.hunger < 90) return AnimalStates.EAT;
        if (state.mode === AnimalStates.FORAGE && state.targetId) return AnimalStates.FORAGE;
        if (state.mode === AnimalStates.SLEEP) return AnimalStates.SLEEP;
        
        // 배회(Wander) 중이더라도 진행 중인 이동은 보장 (목적지에 도착하면 WanderState 내부에서 IDLE로 전환됨)
        // 단, 아래에서 직업(Role) 관련 긴급 할 일이 생기면 오버라이드 됨
        let baseDecision = (state.mode === AnimalStates.WANDER) ? AnimalStates.WANDER : AnimalStates.IDLE;
        
        // 2. 생존 직결: 배가 많이 고프면 음식 탐색 최우선
        if (stats.hunger < 30) {
            return this._tryForage(entity, state, stats);
        }

        // 3. 피로도가 높으면 수면
        if (stats.fatigue > 70) return AnimalStates.SLEEP;

        // ------------------ 생존 욕구 충족 완료 ------------------ //

        const civ = entity.components.get('Civilization');
        
        // 4. 개별 부여받은 직업(Role)이 있다면 직업 고유 행동 우선 수행
        if (civ && civ.role) {
            const roleDecision = civ.role.decide(entity, dt);
            if (roleDecision) {
                // 직업 로직이 명확한 행동 지침을 주었다면 수행
                return roleDecision;
            }
        }

        // 5. 인벤토리가 꽉 찼다면 (직업이 딱히 처리 안 했을 경우 대비) 보관
        if (inventory && inventory.getTotal() >= inventory.capacity) {
            return 'deposit';
        }

        // 6. 직업이 없거나(UNEMPLOYED) 현재 직업 로직상 할 일이 없다면, 기본 상태(IDLE 또는 진행중인 WANDER) 반환
        return baseDecision;
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
