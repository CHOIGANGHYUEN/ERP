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
            // 3. 인간의 자원 채집 (나무, 광석 등)
            else if (state.mode === 'gather') {
                const transform = entity.components.get('Transform');
                const inventory = entity.components.get('Inventory');

                if (inventory && transform) {
                    const target = em.entities.get(state.targetId);
                    if (target) {
                        const targetPos = target.components.get('Transform');
                        const distSq = (targetPos.x - transform.x) ** 2 + (targetPos.y - transform.y) ** 2;

                        if (distSq <= 100) { // 반경 10px (인간은 도구 사용으로 사거리 김)
                            this.gatherToInventory(id, state.targetId, inventory, dt);
                        }
                    }
                }
            }
        }
    }

    gatherToStomach(myId, targetId, animal, metabolism, dt) {
        const entity = this.entityManager.entities.get(myId);
        const stats = entity.components.get('BaseStats');
        const food = this.entityManager.entities.get(targetId);
        if (!food || !stats) return;

        const resource = food.components.get('Resource');
        const visual = food.components.get('Visual');
        const preyAnimal = food.components.get('Animal');

        let biteSize = 10.0 * dt; // 1초에 10씩 섭취
        let nutrition = 0;

        if (resource && resource.storedFertility !== undefined) {
            let taken = Math.min(resource.storedFertility * 100, biteSize);
            nutrition = taken;
            resource.storedFertility -= taken / 100;
            if (visual) visual.quality = resource.storedFertility;

            if (resource.storedFertility <= 0.05) this.entityManager.removeEntity(targetId);
        } else if (resource && resource.amount) {
            let taken = Math.min(resource.amount, biteSize);
            nutrition = taken;
            resource.amount -= taken;
            if (resource.amount <= 0) this.entityManager.removeEntity(targetId);
        } else if (preyAnimal) {
            nutrition = 50; // 사냥 성공 시 고정 영양분
            this.entityManager.removeEntity(targetId);
        }

        stats.hunger = Math.min(stats.maxHunger || 100, stats.hunger + nutrition);
    }

    gatherToInventory(myId, targetId, inventory, dt) {
        const target = this.entityManager.entities.get(targetId);
        if (!target) return;
        const resource = target.components.get('Resource');
        const wealth = this.entityManager.entities.get(myId).components.get('Wealth');

        if (resource) {
            const gatherAmount = Math.min(resource.value || 0, 5 * dt);
            const type = resource.type || 'wood';
            
            // 인벤토리에 추가
            inventory.items[type] = (inventory.items[type] || 0) + gatherAmount;
            resource.value -= gatherAmount;

            // 소량의 골드 획득 (경제 활동 보너스)
            if (wealth) wealth.addGold(gatherAmount * 0.1);

            if (resource.value <= 0) this.entityManager.removeEntity(targetId);
        }
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
