import System from '../../core/System.js';
import speciesConfig from '../../config/species.json';

export default class ReproductionSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
    }

    update(dt, time) {
        const em = this.entityManager;
        const blackboard = this.engine?.systemManager?.blackboard;
        const speciesConfig = this.engine?.speciesConfig || {};

        // 🐕 생명체 번식 및 성장 처리
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const animal = entity.components.get('Animal');
            const transform = entity.components.get('Transform');
            const stats = entity.components.get('BaseStats');
            const age = entity.components.get('Age');
            const emotion = entity.components.get('Emotion');

            if (animal && transform && age) {
                // 1. 성장 처리 (Aging 로직은 MetabolismSystem에서 수행하므로 여기선 Stage 업데이트만)
                if (animal.isBaby) {
                    if (age.growthStage === 'adult') {
                        // 성체 전환
                        animal.isBaby = false;
                        const visual = entity.components.get('Visual');
                        if (visual) visual.size = 1.0;
                    }
                }

                if (animal.type === 'bee') continue;

                const config = speciesConfig[animal.type];
                if (!config) continue;

                // 2. 번식 제약 조건 (허기 + 나이 + [인간 전용: 마을 자원])
                const isReadyAge = age.growthStage === 'adult';
                const isFed = stats && stats.hunger >= (config.reproductionThreshold || 80);
                
                let isEnvironmentReady = true;

                if (animal.type === 'human' && blackboard) {
                    // 🌾 [Population Control] 식량 재고와 주거 수용량 체크
                    const storages = blackboard.storages || [];
                    const totalFood = storages.reduce((sum, s) => sum + (s.items['food'] || 0), 0);
                    const population = em.animalIds.size; // 대략적인 인구수 (인간만 필터링 필요할 수 있음)
                    
                    // 식량이 인당 5개 미만이거나, 인구가 너무 많으면 번식 억제
                    if (totalFood < population * 5) isEnvironmentReady = false;
                    
                    // 감정 수치도 영향
                    if (emotion && emotion.happiness < 50) isEnvironmentReady = false;
                }

                if (!animal.isBaby && isReadyAge && isFed && isEnvironmentReady) {
                    if (animal.reproductionCooldown > 0) {
                        animal.reproductionCooldown -= dt;
                        continue;
                    }
                    
                    // 전역 엔티티 제한
                    if (em.entities.size > 2000) continue;

                    if (Math.random() < 0.05 * dt) {
                        stats.hunger -= 40; 
                        if (emotion) emotion.happiness -= 10;
                        animal.reproductionCooldown = 60;

                        this.spawnBaby(animal.type, transform.x, transform.y);
                        this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                            x: transform.x, y: transform.y, count: 8, type: 'EFFECT', color: '#ff4081'
                        });
                    }
                } else if (animal.reproductionCooldown > 0) {
                    animal.reproductionCooldown -= dt;
                }
            }
        }
    }

    spawnBaby(type, x, y) {
        const spawnX = x + (Math.random() - 0.5) * 15;
        const spawnY = y + (Math.random() - 0.5) * 15;
        this.eventBus.emit('SPAWN_ENTITY', { type: type, x: spawnX, y: spawnY, isBaby: true });
    }
}