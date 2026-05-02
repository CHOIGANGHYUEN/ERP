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

        // 🚀 Deposit(반납) 중이라면 인벤토리가 비워지기 전까지 직업 판단에 흔들리지 않고 창고로 직진합니다.
        if (state.mode === 'deposit' && inventory && inventory.getTotal() > 0) return 'deposit';

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

        // 5. 인벤토리가 꽉 찼다면 우선적으로 창고에 보관 (무한 채집 방지)
        if (inventory && inventory.getTotal() >= inventory.capacity) {
            return 'deposit';
        }

        // 🚨 [직업 배정 누락 완벽 보완] 
        // 촌장이 벌목꾼 직업을 안 주더라도(백수 상태), 또는 배정받은 직업에서 할 일이 없어 노는 상태(IDLE)라면 스스로 나무를 캐러 갑니다.
        if (!civ?.role || entity.jobType === 'unemployed' || baseDecision === AnimalStates.IDLE) {
            if (stats.hunger > 45) { // 배가 아주 고픈 상태가 아니라면 노동을 수행합니다.
                return 'gather_wood';
            }
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

        // 🔒 FoodSensor를 대체하여 Claim을 완벽히 존중하는 전용 수동 탐색 로직
        // 1. 식물 먼저 탐색
        const conditionPlant = (ent) => {
            const res = ent.components.get('Resource');
            if (!res || !res.edible || res.value <= 0) return false;

            if (res.claimedBy && res.claimedBy !== entity.id) {
                const claimer = this.em.entities.get(res.claimedBy);
                if (claimer && claimer.components.get('AIState')?.targetId === ent.id) return false;
                res.claimedBy = null;
            }
            if (state.unreachableTargets && state.unreachableTargets.has(ent.id)) return false;
            return true;
        };

        const nearestPlantId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, searchRadius, conditionPlant, this.engine.spatialHash
        );

        if (nearestPlantId !== null) {
            state.targetId = nearestPlantId;
            const targetEnt = this.em.entities.get(nearestPlantId);
            if (targetEnt && targetEnt.components.has('Resource')) {
                targetEnt.components.get('Resource').claimedBy = entity.id;
            }
            return AnimalStates.FORAGE;
        }

        // 2. 식물이 없으면 동물(사냥감) 탐색
        const PREY_TYPES = new Set(['sheep', 'cow']);
        const conditionAnimal = (ent) => {
            if (ent.id === entity.id) return false;
            const a = ent.components.get('Animal');
            if (!a || !PREY_TYPES.has(a.type)) return false;

            if (a.claimedBy && a.claimedBy !== entity.id) {
                const claimer = this.em.entities.get(a.claimedBy);
                if (claimer && claimer.components.get('AIState')?.targetId === ent.id) return false;
                a.claimedBy = null;
            }
            return true;
        };

        const nearestAnimalId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, searchRadius, conditionAnimal, this.engine.spatialHash
        );

        if (nearestAnimalId !== null) {
            state.targetId = nearestAnimalId;
            const targetEnt = this.em.entities.get(nearestAnimalId);
            if (targetEnt && targetEnt.components.has('Animal')) {
                targetEnt.components.get('Animal').claimedBy = entity.id;
            }
            return AnimalStates.FORAGE;
        }

        return AnimalStates.IDLE;
    }
}
