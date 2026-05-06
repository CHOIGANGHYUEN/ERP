import { AnimalStates } from '../../../components/behavior/State.js';

export default class CarnivoreBrain {
    constructor(entityManager, eventBus, engine, spatialHash) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.engine = engine;
        this.spatialHash = spatialHash;
    }

    /**
     * 🧠 [Decide Pattern] 상태를 직접 변경하지 않고 권장 모드와 타겟을 제안합니다.
     * @returns {{mode: string, targetId: string|null}}
     */
    decide(id, state, transform, animal, stats, dt) {
        // 🛑 [Drag & Drop Protection] 플레이어에게 잡힌 상태면 AI 판단 중단
        if (state.mode === AnimalStates.GRABBED) return { mode: AnimalStates.GRABBED };

        // 🧠 [Decision Throttling] 판단 주기를 1초로 제한하여 부하 감소 및 행동 안정성 확보
        state.thinkTimer = (state.thinkTimer || 0) + dt;
        if (state.thinkTimer < 1.0 && state.mode && state.mode !== AnimalStates.IDLE) {
            return { mode: state.mode, targetId: state.targetId };
        }
        state.thinkTimer = 0; // 주기 도달 시 초기화

        // 1. 생존 위기 방어 (이미 식사 중이거나 사냥 중이면 해당 작업 완수를 우선함)
        const isBusy = (state.mode === AnimalStates.EAT || state.mode === AnimalStates.HUNT) && state.targetId;
        if (isBusy) {
            // 타겟 유효성 검사 (시스템에서도 하지만 브레인에서도 판단 유지 여부를 위해 체크)
            const targetEnt = this.entityManager.entities.get(state.targetId);
            if (targetEnt) {
                const tStats = targetEnt.components.get('BaseStats');
                if (!tStats || tStats.health > 0) return { mode: state.mode, targetId: state.targetId };
            }
        }

        // 2. 사냥 및 섭취 본능 (허기 기반)
        if (stats.hunger < 80) { 
            // 🥩 [Scavenging] 
            const isEatingMeat = (state.mode === AnimalStates.EAT || state.mode === AnimalStates.FORAGE) && state.targetId;
            
            if (!isEatingMeat) {
                const meatId = this.findMeat(id, state, transform, 400);
                if (meatId) {
                    return { mode: AnimalStates.FORAGE, targetId: meatId };
                }
            } else {
                return { mode: state.mode, targetId: state.targetId };
            }

            // ⚔️ [Hunting] 떨어진 고기가 없으면 사냥 시도
            if (state.mode !== AnimalStates.HUNT) {
                const preyId = this.findPrey(id, state, transform, 600);
                if (preyId) {
                    return { mode: AnimalStates.HUNT, targetId: preyId };
                }
            }
        }

        // 3. 수면 및 휴식
        if (stats.fatigue > 80 && state.mode !== AnimalStates.SLEEP) {
            return { mode: AnimalStates.SLEEP, targetId: null };
        }

        // 4. 상태 유지
        if (state.mode === AnimalStates.IDLE || !state.mode) {
            return { mode: AnimalStates.WANDER, targetId: null };
        }

        return { mode: state.mode, targetId: state.targetId };
    }

    findMeat(id, state, transform, radius) {
        return this.entityManager.findNearestEntityWithComponent(
            transform.x,
            transform.y,
            radius,
            (ent) => {
                const item = ent.components.get('DroppedItem');
                return item && item.itemType === 'meat' && (!item.claimedBy || item.claimedBy === id);
            },
            this.spatialHash
        );
    }

    findPrey(id, state, transform, radius) {
        // 🚀 [Expert Optimization] query() + Math.sqrt() 루프 대신 최적화된 findNearestEntityWithComponent 사용
        return this.entityManager.findNearestEntityWithComponent(
            transform.x,
            transform.y,
            radius,
            (ent) => {
                if (ent.id === id) return false;

                // 🚫 [Expert Optimization] 블랙리스트 필터링
                if (state.blacklist.has(ent.id)) {
                    if (Date.now() < state.blacklist.get(ent.id)) return false;
                    else state.blacklist.delete(ent.id);
                }

                const otherAnimal = ent.components.get('Animal');
                // 육식동물은 초식동물(herbivore)을 사냥함
                return otherAnimal && otherAnimal.diet === 'herbivore';
            },
            this.spatialHash
        );
    }
}
