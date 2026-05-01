import System from '../../core/System.js';
import speciesConfig from '../../config/species.json';

export default class ReproductionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
    }

    update(dt, time) {
        const em = this.entityManager;

        // 🐕 동물 번식 및 성장 처리 - animalIds 활용으로 최적화
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const animal = entity.components.get('Animal');
            const metabolism = entity.components.get('Metabolism');
            const transform = entity.components.get('Transform');
            const stats = entity.components.get('BaseStats');

            if (animal && metabolism && transform) {
                // 1. 아기 성장 처리 (40초 후 성체로)
                if (animal.isBaby) {
                    animal.age = (animal.age || 0) + dt;
                    if (animal.age > 40) {
                        animal.isBaby = false;
                        const visual = entity.components.get('Visual');
                        if (visual) visual.size = 1.0; 
                        
                        const config = speciesConfig[animal.type];
                        if (config && transform.mass) {
                            transform.mass = config.weight || 1.0;
                        }
                    }
                }

                // 벌은 BehaviorSystem에 별도의 여왕벌 번식 로직이 있으므로 제외
                if (animal.type === 'bee') continue;

                const config = speciesConfig[animal.type];
                if (!config || !config.reproductionThreshold) continue;

                // 2. 어른 동물의 번식 (허기가 충분히 채워졌을 때)
                if (!animal.isBaby && stats && stats.hunger >= (config.reproductionThreshold || 80)) {
                    // 쿨타임 감소 및 체크
                    if (animal.reproductionCooldown > 0) {
                        animal.reproductionCooldown -= dt;
                        continue;
                    }
                    
                    // 🛡️ [Performance Guard] 전체 월드 엔티티 제한 (메인 스레드 부하 방지)
                    // 20,000마리는 너무 많음 -> 2,000마리로 현실화
                    if (em.entities.size > 2000) continue;

                    // 확률적 번식 성공 (1초당 5% 확률)
                    if (Math.random() < 0.05 * dt) {
                        // 번식 시 막대한 에너지를 소모 (허기 하락)
                        stats.hunger -= 40; 
                        animal.reproductionCooldown = 40; // 40초의 번식 쿨타임

                        // 새끼 스폰
                        this.spawnBaby(animal.type, transform.x, transform.y);

                        // 하트 파티클 연출
                        this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                            x: transform.x,
                            y: transform.y,
                            count: 5,
                            type: 'EFFECT',
                            color: '#ff4081'
                        });
                    }
                }
                else if (animal.reproductionCooldown > 0) {
                    // 배가 부르지 않아도 쿨타임은 흐르게 처리
                    animal.reproductionCooldown -= dt;
                }
            }
        }
    }

    spawnBaby(type, x, y) {
        // 부모 주변의 약간 떨어진 위치에 스폰
        const spawnX = x + (Math.random() - 0.5) * 15;
        const spawnY = y + (Math.random() - 0.5) * 15;

        // EventBus를 통해 SpawnerSystem에 새끼 스폰 요청
        this.eventBus.emit('SPAWN_ENTITY', { type: type, x: spawnX, y: spawnY, isBaby: true });
    }
}