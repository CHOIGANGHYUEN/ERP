import { AnimalStates } from '../../../components/behavior/State.js';

export default class CarnivoreBrain {
    constructor(entityManager, eventBus, engine, spatialHash) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.engine = engine;
        this.spatialHash = spatialHash;
    }

    update(id, state, transform, animal, stats, dt) {
        // 🛑 [Drag & Drop Protection] 플레이어에게 잡힌 상태면 AI 판단 중단
        if (state.mode === AnimalStates.GRABBED) return;

        // 1. 사냥 및 섭취 본능 (허기 기반)
        if (stats.hunger < 80) { // 임계값 소폭 하향 (너무 자주 찾지 않도록)
            // 🥩 [Scavenging] 
            // 이미 고기를 대상으로 FORAGE 또는 EAT 중이면 중복 판단 방지
            const isEatingMeat = (state.mode === AnimalStates.EAT || state.mode === AnimalStates.FORAGE) && state.targetId;
            
            if (!isEatingMeat) {
                const meatId = this.findMeat(id, state, transform, 400);
                if (meatId) {
                    state.targetId = meatId;
                    state.mode = AnimalStates.FORAGE;
                    return;
                }
            } else {
                // 이미 고기 식사 중이면 그대로 유지
                return;
            }

            // ⚔️ [Hunting] 떨어진 고기가 없으면 사냥 시도
            if (state.mode !== AnimalStates.HUNT) {
                const preyId = this.findPrey(id, state, transform, 600);
                if (preyId) {
                    state.targetId = preyId;
                    state.mode = AnimalStates.HUNT;
                    return;
                }
            }
        }

        // 2. 수면 및 휴식
        if (stats.fatigue > 80 && state.mode !== AnimalStates.SLEEP) {
            state.mode = AnimalStates.SLEEP;
            return;
        }

        // 3. 상태 유지
        if (state.mode === AnimalStates.IDLE || !state.mode) {
            state.mode = AnimalStates.WANDER;
        }
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
        const nearbyIds = this.spatialHash.query(transform.x, transform.y, radius);
        let nearestId = null;
        let minDist = radius;

        for (const otherId of nearbyIds) {
            if (otherId === id) continue;

            // 🚫 [Expert Optimization] 블랙리스트 필터링 및 청소
            if (state.blacklist.has(otherId)) {
                if (Date.now() < state.blacklist.get(otherId)) continue;
                else state.blacklist.delete(otherId); // 만료된 블랙리스트 삭제
            }
            
            const other = this.entityManager.entities.get(otherId);
            if (!other) continue;

            const otherAnimal = other.components.get('Animal');
            // 육식동물은 초식동물(herbivore)을 사냥함
            if (otherAnimal && otherAnimal.diet === 'herbivore') {
                const otherTransform = other.components.get('Transform');
                if (otherTransform) {
                    const dist = Math.sqrt((transform.x - otherTransform.x)**2 + (transform.y - otherTransform.y)**2);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestId = otherId;
                    }
                }
            }
        }
        return nearestId;
    }
}
