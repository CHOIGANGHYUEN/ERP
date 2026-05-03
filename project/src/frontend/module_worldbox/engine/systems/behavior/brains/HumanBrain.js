import { AnimalStates } from '../../../components/behavior/State.js';
import { JobTypes } from '../../../config/JobTypes.js';
import PredatorSensor from '../sensors/PredatorSensor.js';
import FoodSensor from '../sensors/FoodSensor.js';

/**
 * 🧠 HumanBrain
 * 인간 개체의 고도화된 행동 우선순위를 결정합니다.
 */
export default class HumanBrain {
    constructor(entityManager, eventBus, engine, spatialHash) {
        this.em = entityManager;
        this.eventBus = eventBus;
        this.engine = engine;
        this.spatialHash = spatialHash;
        
        // 🧠 전용 센서 초기화 (블랙리스트 연동 지원)
        this.predatorSensor = new PredatorSensor(entityManager, spatialHash);
        this.foodSensor = new FoodSensor(entityManager, spatialHash);
    }

    /**
     * 인간의 현재 상태를 기반으로 최적의 행동(State)을 결정합니다.
     */
    decide(entity, state, stats, emotion, inventory, dt) {
        // 🛑 [Drag & Drop Protection] 플레이어에게 잡힌 상태면 어떤 판단도 하지 않음
        if (state.mode === AnimalStates.GRABBED) return AnimalStates.GRABBED;

        const civ = entity.components.get('Civilization');
        
        // 🚨 0. 생존 직결: 주변의 포식자 감지 시 최우선 도망
        const nearbyPredator = this.predatorSensor.findNearestPredator(entity, state, 150);
        if (nearbyPredator) {
            state.targetId = nearbyPredator;
            return AnimalStates.FLEE;
        }

        // 1. 생존 우선순위 (허기, 피로)
        if (stats.hunger < 35) {
            return this._tryForage(entity, state, stats);
        }

        // 2. 현재 진행 중인 핵심 생존/작업 상태 방어
        if (state.mode === AnimalStates.EAT && stats.hunger < 90) return AnimalStates.EAT;
        if (state.mode === AnimalStates.FORAGE && state.targetId) return AnimalStates.FORAGE;
        if (state.mode === AnimalStates.SLEEP) return AnimalStates.SLEEP;

        // 🚀 Deposit(반납) 중이더라도 건설 자원이 있고 건설지가 있다면 건설로 전향할 수 있게 함
        // (단, 인벤토리가 꽉 찼다면 반납 강제)
        const totalInInv = inventory ? inventory.getTotal() : 0;
        const isFull = inventory && totalInInv >= inventory.capacity;
        
        if (state.mode === 'deposit' && !isFull) {
            // 건축가이거나 촌장인데 나무가 있다면 건설지로 가는 것이 더 효율적 (강제 반납 해제)
            const isWorker = civ?.jobType === 'architect' || civ?.jobType === 'chief';
            if (isWorker && (inventory?.items['wood'] || 0) >= 5) {
                // 아래 직업 판단 로직을 타게 함
            } else {
                if (totalInInv > 0) return 'deposit';
            }
        }

        // 배회(Wander) 중이더라도 진행 중인 이동은 보장
        let baseDecision = (state.mode === AnimalStates.WANDER) ? AnimalStates.WANDER : AnimalStates.IDLE;

        // 3. 피로도가 높으면 수면
        if (stats.fatigue > 70) return AnimalStates.SLEEP;

        // ------------------ 생존 욕구 충족 완료 ------------------ //

        // 🚀 [Resource Scarcity Logic] - 최우선 순위로 격상
        // 건축가(Architect), 촌장(Chief), 또는 직업이 없는 경우
        const isBuilder = state.mode === 'build' || civ?.jobType === 'architect' || civ?.jobType === 'chief';
        const isUnemployed = !civ?.jobType || civ?.jobType === 'unemployed' || civ?.jobType === 'none';

        if (isBuilder || isUnemployed) {
            const woodInInv = (inventory?.items && inventory.items['wood']) || 0;
            
            // 💡 [Persistence] 이미 나무를 캐는 중이라면, 최소 15개는 모을 때까지 계속 캡니다. (왔다갔다 방지)
            const isAlreadyGathering = state.mode === 'gather_wood';
            const gatherThreshold = isAlreadyGathering ? 15 : 5;

            if (woodInInv < gatherThreshold) {
                const storages = this.engine.systemManager.blackboard.storages || [];
                const totalWoodInVillage = storages.reduce((sum, s) => sum + (s.items['wood'] || 0), 0);
                
                if (storages.length === 0 || totalWoodInVillage < 5) {
                    return 'gather_wood';
                } else {
                    // 창고에 나무가 있다면 직접 가지러 가도록 건설 모드 제안
                    return 'build';
                }
            }
        }

        // 4. [Individual Judgment] 부여받은 직업(Role) 내에서 능동적으로 할 일을 찾음
        if (civ && civ.role) {
            const roleDecision = civ.role.decide(entity, dt);
            if (roleDecision) return roleDecision;
        }

        // 5. 건설 우선순위 절대화 (창고보다 우선)
        const blackboard = this.engine.systemManager.blackboard;
        const blueprints = blackboard.blueprints || [];
        const storages = blackboard.storages || [];
        const totalWoodInVillage = storages.reduce((sum, s) => sum + (s.items['wood'] || 0), 0);
        
        let hasBlueprints = blueprints.length > 0;
        if (!hasBlueprints) {
            const nearestBP = this.em.findNearestEntityWithComponent(
                entity.components.get('Transform').x, 
                entity.components.get('Transform').y, 
                10000, 
                (ent) => {
                    const struc = ent.components.get('Structure');
                    return struc && struc.isBlueprint && !struc.isComplete;
                },
                this.engine.spatialHash
            );
            if (nearestBP) hasBlueprints = true;
        }

        const woodInInv = (inventory?.items['wood'] || 0);

        if (hasBlueprints) {
            if (woodInInv >= 5 || totalWoodInVillage >= 5) return 'build';
            return 'gather_wood';
        }

        // 6. 인벤토리가 꽉 찼고, 더 이상 지을 건물도 없을 때만 창고에 보관
        if (inventory && inventory.getTotal() >= inventory.capacity) {
            if (storages.length > 0) return 'deposit';
        }

        if (isUnemployed || civ?.jobType === 'chief' || baseDecision === AnimalStates.IDLE) {
            if (stats.hunger > 35) { 
                if (hasBlueprints) {
                    if (woodInInv >= 5 || totalWoodInVillage >= 5) return 'build';
                    return 'gather_wood';
                }
                if (civ?.jobType === 'chief') return AnimalStates.WANDER;
                return 'gather_wood';
            }
        }

        return baseDecision;
    }

    /**
     * 가장 가까운 음식을 찾아 targetId를 설정한 뒤 FORAGE 상태를 반환합니다.
     */
    _tryForage(entity, state, stats) {
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        if (!transform || !animal) return AnimalStates.IDLE;

        const searchRadius = 500 + (100 - stats.hunger) * 3;
        
        // 🥩 [Expert Optimization] FoodSensor를 사용하여 블랙리스트 연동
        const foodId = this.foodSensor.findFood(stats, transform.x, transform.y, searchRadius, state);
        if (foodId) {
            state.targetId = foodId;
            return AnimalStates.FORAGE;
        }

        return AnimalStates.WANDER;
    }
}
