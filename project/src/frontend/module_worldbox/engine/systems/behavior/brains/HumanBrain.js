import { AnimalStates } from '../../../components/behavior/State.js';
import { JobTypes } from '../../../config/JobTypes.js';
import { GlobalLogger } from '../../../utils/Logger.js';
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
        // 🛑 [LOD/Optimization] 플레이어에게 잡힌 상태면 어떤 판단도 하지 않음
        if (state.mode === AnimalStates.GRABBED) return AnimalStates.GRABBED;

        const civ = entity.components.get('Civilization');

        // 🧠 [Stable AI Decision] 판단 주기를 조절하여 부하 감소
        state.thinkTimer = (state.thinkTimer || 0) + dt;
        if (state.thinkTimer < 1.0 && state.mode) return state.mode;
        state.thinkTimer = 0;

        // ========================================================================
        // 🚨 LEVEL 1: PERSONAL SURVIVAL (생존 및 위급 상황 - 개인 할일)
        // ========================================================================
        
        // 1. 위협 회피 (최우선)
        const nearbyPredator = this.predatorSensor.findNearestPredator(entity, state, 150);
        if (nearbyPredator) {
            state.targetId = nearbyPredator;
            const job = civ?.jobType ? ` (${civ.jobType})` : '';
            GlobalLogger.warn(`🚨 EMERGENCY: Citizen ${entity.id}${job} is FLEEING from a predator!`);
            return AnimalStates.FLEE;
        }

        // 2. 극한 생존 욕구 (허기, 피로)
        const jobSuffix = civ?.jobType ? ` (${civ.jobType})` : '';
        if (stats.hunger < 30) {
            GlobalLogger.info(`🍎 SURVIVAL: Citizen ${entity.id}${jobSuffix} is searching for food (Hunger: ${Math.floor(stats.hunger)}%).`);
            return this._tryForage(entity, state, stats);
        }
        if (stats.fatigue > 90) {
            GlobalLogger.info(`😴 FATIGUE: Citizen ${entity.id}${jobSuffix} is exhausted and seeking rest.`);
            return AnimalStates.SLEEP;
        }

        // 3. 현재 진행 중인 생존 행동 방어
        if (state.mode === AnimalStates.EAT && stats.hunger < 90) return AnimalStates.EAT;
        if (state.mode === AnimalStates.SLEEP && stats.fatigue > 10) return AnimalStates.SLEEP;
        if (state.mode === AnimalStates.FORAGE && state.targetId) return AnimalStates.FORAGE;

        // ========================================================================
        // 🏘️ LEVEL 2: VILLAGE & JOB (마을 및 직업 활동 - 공적 할일)
        // ========================================================================
        // 4. 부여받은 직업(Role) 기반 행동 결정
        if (civ && civ.role) {
            const roleDecision = civ.role.decide(entity, dt);
            if (roleDecision) return roleDecision;
        }

        // 5. [Fallback] 할일이 없는 경우 주변 아이템 줍기 시도
        const totalInInv = inventory ? inventory.getTotal() : 0;
        const isFull = inventory && totalInInv >= inventory.capacity;

        if (!isFull) {
            const pickupId = this._tryPickup(entity, state);
            if (pickupId) {
                state.targetId = pickupId;
                return AnimalStates.PICKUP;
            }
        }

        // 6. 진짜 아무것도 할 게 없으면 배회
        return AnimalStates.WANDER;
    }

    _tryForage(entity, state, stats) {
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        if (!transform || !animal) return AnimalStates.IDLE;

        const searchRadius = 500 + (100 - stats.hunger) * 3;
        const foodId = this.foodSensor.findFood(stats, transform.x, transform.y, searchRadius, state);
        if (foodId) {
            state.targetId = foodId;
            return AnimalStates.FORAGE;
        }
        return AnimalStates.WANDER;
    }

    _tryPickup(entity, state) {
        const transform = entity.components.get('Transform');
        const civ = entity.components.get('Civilization');
        const stats = entity.components.get('BaseStats');
        if (!transform) return null;

        const searchRadius = 250;
        const nearbyIds = this.spatialHash.query(transform.x, transform.y, searchRadius);
        
        let bestTargetId = null;
        let bestScore = -1;

        for (const otherId of nearbyIds) {
            if (state.unreachableTargets && state.unreachableTargets.has(otherId)) continue;

            const other = this.em.entities.get(otherId);
            if (!other) continue;

            const item = other.components.get('DroppedItem');
            if (!item || (item.claimedBy && item.claimedBy !== entity.id)) continue;

            const tPos = other.components.get('Transform');
            if (!tPos) continue;

            let score = 100;
            const dist = Math.sqrt((transform.x - tPos.x) ** 2 + (transform.y - tPos.y) ** 2);
            score -= (dist / searchRadius) * 50;

            const itemType = item.itemType;
            const job = civ?.jobType;

            if (itemType === 'wood') {
                if (job === 'logger') score += 150;
                if (state.mode === 'build') score += 100;
            } else if (itemType === 'stone' || itemType === 'iron_ore') {
                if (job === 'miner') score += 150;
                if (state.mode === 'build') score += 120;
            } else if (itemType === 'fruit' || itemType === 'meat' || itemType === 'food') {
                if (job === 'gatherer' || job === 'hunter') score += 150;
                if (stats && stats.hunger < 50) score += 200;
            }

            if (score > bestScore) {
                bestScore = score;
                bestTargetId = otherId;
            }
        }

        if (bestTargetId) {
            if (state.unreachableTargets) state.unreachableTargets.clear();
            state.thinkTimer = 5.0;
        }

        return bestTargetId;
    }
}
