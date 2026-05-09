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
        
        // 🚀 [Optimization] 고정된 세트를 사용하여 Includes 체크 비용 절감
        this.busyStates = new Set([
            'hunt', 'pickup', 'build', 'deposit', 'withdraw',
            'gather_wood', 'gather_plant', 'gather_stone'
        ]);
    }

    /**
     * 인간의 현재 상태를 기반으로 최적의 행동(State)을 결정합니다.
     */
    decide(entity, state, stats, emotion, inventory, dt) {
        if (state.mode === AnimalStates.GRABBED) return AnimalStates.GRABBED;

        // 🧠 [Responsiveness Fix] IDLE 상태이거나 할일이 없을 때는 더 빠르게 판단 (1.0s -> 0.2s)
        const isIdle = !state.mode || state.mode === AnimalStates.IDLE || state.mode === AnimalStates.WANDER;
        const thinkThreshold = isIdle ? 0.2 : 1.0;

        state.thinkTimer = (state.thinkTimer || 0) + dt;
        if (state.thinkTimer < thinkThreshold && state.mode) return state.mode;
        state.thinkTimer = 0;

        // 🛡️ [Busy Protection] 현재 작업을 수행 중이고 타겟이 유효하면 상태 유지
        if (state.targetId && this.busyStates.has(state.mode)) {
            if (this.em.entities.has(state.targetId)) return state.mode;
        }

        const civ = entity.components.get('Civilization');

        // ========================================================================
        // 🚨 LEVEL 1: PERSONAL SURVIVAL
        // ========================================================================

        // 1. 위협 회피 (최우선)
        const nearbyPredator = this.predatorSensor.findNearestPredator(entity, state, 150);
        if (nearbyPredator) {
            state.targetId = nearbyPredator;
            return AnimalStates.FLEE;
        }

        // 2. 극한 생존 욕구 (허기, 피로)
        const jobSuffix = civ?.jobType ? ` (${civ.jobType})` : '';
        if (stats.hunger < 30) {
            const foodId = this._findFoodTarget(entity, state, stats);
            if (foodId) {
                state.targetId = foodId;
                GlobalLogger.info(`🍎 SURVIVAL: Citizen ${entity.id}${jobSuffix} is searching for food (Hunger: ${Math.floor(stats.hunger)}%).`);
                return AnimalStates.FORAGE;
            }
        }
        if (stats.fatigue > 90) {
            GlobalLogger.info(`😴 FATIGUE: Citizen ${entity.id}${jobSuffix} is exhausted and seeking rest.`);
            return AnimalStates.SLEEP;
        }

        // 3. 현재 진행 중인 생존 행동 보호
        if (state.mode === AnimalStates.EAT && stats.hunger < 90) return AnimalStates.EAT;
        if (state.mode === AnimalStates.SLEEP && stats.fatigue > 10) return AnimalStates.SLEEP;
        if (state.mode === AnimalStates.FORAGE && state.targetId) {
            if (this.em.entities.has(state.targetId)) return AnimalStates.FORAGE;
        }

        // ========================================================================
        // 🏘️ LEVEL 2: VILLAGE & JOB (마을 및 직업 활동 - 공적 할일)
        // ========================================================================
        // 4. 부여받은 직업(Role) 기반 행동 결정
        const warTargetId = this.engine.systemManager?.combat?.findNearestWarEnemy(entity, 260);
        if (warTargetId !== null && warTargetId !== undefined) {
            state.targetId = warTargetId;
            return AnimalStates.HUNT;
        }

        if (civ && civ.role) {
            const roleDecision = civ.role.decide(entity, dt);
            if (roleDecision) return roleDecision;
        }

        // 5. [Fallback] 할일이 없는 경우 주변 아이템 줍기 시도
        const totalInInv = inventory ? inventory.getTotal() : 0;
        const isFull = inventory && totalInInv >= inventory.capacity;

        if (!isFull) {
            const pickupId = this._getBestPickupTarget(entity, state);
            if (pickupId) {
                state.targetId = pickupId;
                return AnimalStates.PICKUP;
            }
        }

        // 6. 진짜 아무것도 할 게 없으면 배회
        return AnimalStates.WANDER;
    }

    _findFoodTarget(entity, state, stats) {
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        if (!transform || !animal) return null;

        const searchRadius = 500 + (100 - stats.hunger) * 3;
        return this.foodSensor.findFood(stats, transform.x, transform.y, searchRadius, state);
    }

    _getBestPickupTarget(entity, state) {
        const transform = entity.components.get('Transform');
        const civ = entity.components.get('Civilization');
        const stats = entity.components.get('BaseStats');
        if (!transform) return null;

        const searchRadius = 400; // 수집 범위 상향
        let bestTargetId = null;
        let bestScore = -1;

        this.spatialHash.eachInRange(transform.x, transform.y, searchRadius, (otherId) => {
            if (state.unreachableTargets && state.unreachableTargets.has(otherId)) return;

            const other = this.em.entities.get(otherId);
            if (!other) return;

            const item = other.components.get('DroppedItem');
            if (!item || (item.claimedBy && item.claimedBy !== entity.id)) return;

            const tPos = other.components.get('Transform');
            if (!tPos) return;

            let score = 100;
            const dx = transform.x - tPos.x;
            const dy = transform.y - tPos.y;
            const distSq = dx * dx + dy * dy;

            // 거리 기반 점수 (제곱근 연산 회피)
            score -= (distSq / (searchRadius * searchRadius)) * 80;

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
        });

        if (bestTargetId) {
            if (state.unreachableTargets) state.unreachableTargets.clear();
        }

        return bestTargetId;
    }
}
