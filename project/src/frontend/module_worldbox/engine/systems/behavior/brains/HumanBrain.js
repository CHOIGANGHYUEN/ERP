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
        if (state.mode === AnimalStates.PICKUP && state.targetId) return AnimalStates.PICKUP;

        // 🚀 [Inventory Management] 주변에 떨어진 아이템 줍기 (최상위 우선순위 중 하나)
        const totalInInv = inventory ? inventory.getTotal() : 0;
        const isFull = inventory && totalInInv >= inventory.capacity;
        
        if (!isFull) {
            const pickupId = this._tryPickup(entity, state);
            if (pickupId) {
                state.targetId = pickupId;
                return AnimalStates.PICKUP;
            }
        }

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
            // 💡 [Smart Gathering] 필요한 자원이 무엇인지 판단
            const targetBPId = nearestBP || (blueprints.length > 0 ? blueprints[0].id : null);
            const targetBP = targetBPId ? this.em.entities.get(targetBPId) : null;
            const struc = targetBP?.components.get('Structure');
            
            let neededRes = 'wood';
            if (struc) {
                // ConstructionSystem의 로직과 동기화
                if (struc.type === 'house' && struc.progress > 50) neededRes = 'stone';
                if (struc.type === 'watchtower') neededRes = 'stone';
                if (struc.type === 'warehouse' || struc.type === 'storage') {
                    if (struc.progress > 70) neededRes = 'iron_ore';
                }
            }

            const resInInv = (inventory?.items && inventory.items[neededRes]) || 0;
            const storages = blackboard.storages || [];
            const totalResInVillage = storages.reduce((sum, s) => sum + (s.items[neededRes] || 0), 0);

            if (resInInv >= 5 || totalResInVillage >= 5) return 'build';
            
            // 필요한 자원 채집 상태로 전환
            state.targetResourceType = neededRes;
            return 'gather_wood'; // GatherWoodState가 이제 동적으로 처리함
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

    /**
     * 주변에 떨어진 아이템이 있는지 탐색합니다.
     * [고도화] 직업(Job)과 현재 상황에 따라 수집 우선순위를 결정합니다.
     */
    _tryPickup(entity, state) {
        const transform = entity.components.get('Transform');
        const civ = entity.components.get('Civilization');
        const stats = entity.components.get('BaseStats');
        const inventory = entity.components.get('Inventory');

        if (!transform) return null;

        const searchRadius = 250; // 수집 탐색 범위 확대
        const nearbyIds = this.spatialHash.query(transform.x, transform.y, searchRadius);
        
        let bestTargetId = null;
        let bestScore = -1;

        for (const otherId of nearbyIds) {
            const other = this.em.entities.get(otherId);
            if (!other) continue;

            const item = other.components.get('DroppedItem');
            if (!item || (item.claimedBy && item.claimedBy !== entity.id)) continue;

            const tPos = other.components.get('Transform');
            if (!tPos) continue;

            // 🧮 우선순위 점수 계산
            let score = 100; // 기본 점수
            const dist = Math.sqrt((transform.x - tPos.x)**2 + (transform.y - tPos.y)**2);
            
            // 거리에 따른 감점 (멀수록 낮은 점수)
            score -= (dist / searchRadius) * 50;

            // 직업 및 상황별 가중치
            const itemType = item.itemType;
            const job = civ?.jobType;

            if (itemType === 'wood') {
                if (job === 'logger') score += 150;
                if (state.mode === 'build') score += 100;
            } else if (itemType === 'stone' || itemType === 'iron_ore') {
                if (job === 'miner') score += 150;
                if (state.mode === 'build') score += 120; // 돌/철은 더 희귀하므로 가중치 상향
            } else if (itemType === 'fruit' || itemType === 'meat' || itemType === 'food') {
                if (job === 'gatherer' || job === 'hunter') score += 150;
                if (stats && stats.hunger < 50) score += 200; // 배고프면 식량이 최우선
            }

            if (score > bestScore) {
                bestScore = score;
                bestTargetId = otherId;
            }
        }

        return bestTargetId;
    }
}
