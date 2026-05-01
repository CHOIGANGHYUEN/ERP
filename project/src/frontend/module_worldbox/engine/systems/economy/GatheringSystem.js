import System from '../../core/System.js';

export default class GatheringSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
    }

    update(dt, time) {
        const em = this.entityManager;
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;
            const state = entity.components.get('AIState');
            if (!state) continue;

            // 1. 일반 동물들의 먹기 (초식/육식 동물이 자원을 섭취하여 포만감 증가)
            if (state.mode === 'eat') {
                const transform = entity.components.get('Transform');
                const animal = entity.components.get('Animal');
                const metabolism = entity.components.get('Metabolism');

                if (animal && metabolism && transform) {
                    const target = em.entities.get(state.targetId);
                    if (target) {
                        const targetPos = target.components.get('Transform');
                        const distSq = (targetPos.x - transform.x) ** 2 + (targetPos.y - transform.y) ** 2;

                        if (distSq <= 25) { // 반경 5px
                            this.gatherToStomach(id, state.targetId, animal, metabolism, dt);
                        }
                    }
                }
            }
            // 2. 벌의 꿀 채집 (일벌이 꽃에서 꿀을 채집하여 인벤토리(nectar)에 저장)
            else if (state.mode === 'bee_gather') {
                const transform = entity.components.get('Transform');
                const animal = entity.components.get('Animal');

                if (animal && transform) {
                    const target = em.entities.get(state.targetId);
                    if (target) {
                        const targetPos = target.components.get('Transform');
                        const distSq = (targetPos.x - transform.x) ** 2 + (targetPos.y - transform.y) ** 2;

                        if (distSq <= 25) { // 반경 5px
                            this.gatherNectar(id, state.targetId, animal, dt);
                        }
                    }
                }
            }
        }
    }

    gatherToStomach(myId, targetId, animal, metabolism, dt) {
        const food = this.entityManager.entities.get(targetId);
        if (!food) return;
        const resource = food.components.get('Resource');
        const visual = food.components.get('Visual');
        const preyAnimal = food.components.get('Animal');

        let biteSize = 1.0 * dt; // 1초에 1.0씩 점진적으로 뜯어먹음
        let nutrition = 0;

        if (resource && resource.storedFertility !== undefined) {
            // ⚖️ ZERO-SUM: 식물의 비옥도를 뺏은 만큼만 정확히 포만감으로 섭취
            let taken = Math.min(resource.storedFertility, biteSize);
            nutrition = taken;
            resource.storedFertility -= taken;
            if (visual) visual.quality = resource.storedFertility;

            if (resource.storedFertility <= 0.05) {
                this.entityManager.removeEntity(targetId);
                const pos = food.components.get('Transform');
                if (pos) {
                    this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                        x: pos.x, y: pos.y, count: 3, type: 'EFFECT', color: '#8bc34a', speed: 1.5
                    });
                }
            }
        } else if (resource && resource.amount) {
            let taken = Math.min(resource.amount, biteSize * 2);
            nutrition = taken;
            resource.amount -= taken;

            if (resource.amount <= 0) this.entityManager.removeEntity(targetId);
        } else if (preyAnimal) {
            // 육식 동물이 사냥 성공 시 대상의 체급(maxStomach) 또는 기본치만큼 영양분 섭취
            nutrition = preyAnimal.maxStomach ? preyAnimal.maxStomach : 3.0;
            this.entityManager.removeEntity(targetId);

            const pos = food.components.get('Transform');
            if (pos) {
                this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: pos.x, y: pos.y, count: 12, type: 'EFFECT', color: '#e53935', speed: 3
                });
            }
        }

        metabolism.stomach = Math.min(metabolism.maxStomach || 2.0, metabolism.stomach + nutrition);
    }

    gatherNectar(myId, targetId, animal, dt) {
        const flower = this.entityManager.entities.get(targetId);
        if (!flower) return;
        const state = this.entityManager.entities.get(myId).components.get('AIState');

        // 벌은 한 번에 10의 꿀을 채집
        animal.nectar += 10;
        state.mode = 'bee_return'; // 채집 완료 후 집으로 귀환 모드 전환

        const fRes = flower.components.get('Resource');
        const fVis = flower.components.get('Visual');
        if (fRes && fVis) {
            fRes.storedFertility = Math.max(0, fRes.storedFertility - 0.2);
            fVis.quality = fRes.storedFertility;
        }
    }
}
