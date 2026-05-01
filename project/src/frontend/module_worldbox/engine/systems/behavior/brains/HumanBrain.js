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
        // 1. 생존 직결: 매우 배고프면 식사 우선
        if (stats.hunger < 20) return AnimalStates.FORAGE;

        // 2. 마을 과업 확인 (건설 우선순위)
        const civ = entity.components.get('Civilization');
        const vs = this.engine.systemManager.villageSystem;
        
        if (civ && civ.villageId !== -1 && vs) {
            const village = vs.getVillage(civ.villageId);
            if (village && village.currentTask) {
                if (village.currentTask.type === 'build') {
                    // 건설 목표 설정 및 상태 전이
                    state.targetId = village.currentTask.targetId;
                    return 'build'; 
                }
            }
        }

        // 3. 자원 채집: 건설 과업이 없고 배가 고프지 않다면 자원 채집 시도
        if (stats.hunger < 60) {
            return AnimalStates.FORAGE; // 배고프기 시작하면 수집/사냥
        }

        // 4. 휴식: 피로도가 높으면 수면/휴식
        if (stats.fatigue > 70) return AnimalStates.IDLE;

        // 5. 기본 행동: 건축 혹은 방황
        const builder = entity.components.get('Builder');
        if (builder && builder.isBuilding) return 'build';

        // 마을에 소속되어 있고 할 일이 없다면 주변 자원 채집 (Gathering)
        if (civ && civ.villageId !== -1) {
            return 'gather_wood'; 
        }

        return AnimalStates.WANDER;
    }
}
