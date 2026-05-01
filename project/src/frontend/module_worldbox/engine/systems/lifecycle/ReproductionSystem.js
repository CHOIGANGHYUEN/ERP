import System from '../../core/System.js';
import speciesConfig from '../../config/species.json';

export default class ReproductionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
    }

    update(dt, time) {
        const em = this.entityManager;

        // 🐕 동물 번식 및 성장 처리
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const animal = entity.components.get('Animal');
            const transform = entity.components.get('Transform');
            const stats = entity.components.get('BaseStats');
            const age = entity.components.get('Age');
            const emotion = entity.components.get('Emotion');

            if (animal && transform && age) {
                // 1. 성장 처리 (Age 컴포넌트 활용)
                if (animal.isBaby) {
                    if (age.growthStage !== 'adult') {
                        // 틱당 나이 증가 (게임 시간 기준)
                        age.currentAge += dt * 0.1; 
                        age.updateStage();
                    } else {
                        // 성체 전환
                        animal.isBaby = false;
                        const visual = entity.components.get('Visual');
                        if (visual) visual.size = 1.0;
                    }
                }

                if (animal.type === 'bee') continue;

                const config = speciesConfig[animal.type];
                if (!config || !config.reproductionThreshold) continue;

                // 2. 번식 제약 조건 (허기 + 나이 + [인간 전용: 감정])
                const isReadyAge = age.growthStage === 'adult';
                const isFed = stats && stats.hunger >= (config.reproductionThreshold || 80);
                
                let isEmotionallyReady = true;

                if (animal.type === 'human') {
                    isEmotionallyReady = emotion ? emotion.happiness > 60 : true;
                }

                if (!animal.isBaby && isReadyAge && isFed && isEmotionallyReady) {
                    if (animal.reproductionCooldown > 0) {
                        animal.reproductionCooldown -= dt;
                        continue;
                    }
                    
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