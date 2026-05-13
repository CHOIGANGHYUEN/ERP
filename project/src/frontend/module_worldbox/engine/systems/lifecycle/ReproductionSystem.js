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

        const items = em.animalIds.items; // 🚀 [Expert Optimization] Raw Array 참조
        const frameCount = this.engine.frameCount || 0;
        const camera = this.engine.camera;
        const margin = 200;
        const viewX = camera.x - margin;
        const viewY = camera.y - margin;
        const viewW = (camera.width / camera.zoom) + (margin * 2);
        const viewH = (camera.height / camera.zoom) + (margin * 2);

        // 🐕 생명체 번식 및 성장 처리
        for (let i = 0; i < items.length; i++) {
            const id = items[i];
            const entity = em.entities.get(id);
            if (!entity) continue;

            const animal = entity.components.get('Animal');
            const transform = entity.components.get('Transform');
            const stats = entity.components.get('BaseStats');
            const age = entity.components.get('Age');
            const emotion = entity.components.get('Emotion');

            if (animal && transform && age) {
                // 🚀 [Optimization] 가시성 및 거리에 따른 업데이트 빈도 조절
                const isVisible = (transform.x > viewX && transform.x < viewX + viewW && 
                                   transform.y > viewY && transform.y < viewY + viewH);
                
                if (!isVisible) {
                    const centerX = viewX + viewW / 2;
                    const centerY = viewY + viewH / 2;
                    const dist = Math.abs(transform.x - centerX) + Math.abs(transform.y - centerY);
                    const isFar = dist > (viewW + viewH) * 2;
                    
                    // 원거리 개체는 번식 계산을 1분(60프레임 * 10초 등)에 한 번 수준으로 대폭 낮춤
                    const skipFactor = isFar ? 60 : 15;
                    if ((id + frameCount) % skipFactor !== 0) continue;
                }

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
                const isFed = stats && stats.hunger >= (config.reproductionThreshold || 60);
                
                let isEnvironmentReady = true;

                if (animal.type === 'human' && blackboard) {
                    // 🌾 [Population Control] 모든 종류의 식량 재고 합산
                    const storages = blackboard.storages || [];
                    const totalFood = storages.reduce((sum, s) => {
                        let foodInStorage = 0;
                        for (const [type, count] of Object.entries(s.items)) {
                            if (type === 'food' || type === 'fruit' || type === 'meat' || type === 'berry' || type === 'bread' || type === 'kelp' || type === 'honey') {
                                foodInStorage += count;
                            }
                        }
                        return sum + foodInStorage;
                    }, 0);

                    // 🚀 [Critical Fix] 전역 동물 수가 아니라 해당 마을의 인구수만 체크
                    const vs = this.engine?.systemManager?.villageSystem;
                    const village = vs?.getVillage(animal.villageId);
                    const population = village ? village.members.size : 1;
                    
                    // 식량이 인당 3개 미만이면 번식 억제
                    if (totalFood < population * 3) isEnvironmentReady = false;
                    
                    if (emotion && emotion.happiness < 40) isEnvironmentReady = false;
                }


                if (!animal.isBaby && isReadyAge && isFed && isEnvironmentReady) {
                    if (animal.reproductionCooldown > 0) {
                        animal.reproductionCooldown -= dt;
                        continue;
                    }
                    
                    // 🚀 [Scale Fix] 전역 엔티티 제한
                    const entityLimit = this.engine.isStressTestMode ? 250000 : 10000;
                    if (em.entities.size > entityLimit) continue;

                    // 🚀 [Balance] 번식 확률 상향 (0.1 -> 0.15)
                    if (Math.random() < 0.15 * dt) {
                        stats.hunger -= 40; 
                        if (emotion) emotion.happiness -= 10;
                        animal.reproductionCooldown = 60;

                        this.spawnBaby(animal.type, transform.x, transform.y);
                        this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                            x: transform.x, y: transform.y, count: 8, type: 'EFFECT', color: '#ff4081'
                        });
                    }
                } else if (!animal.isBaby && isReadyAge && isEnvironmentReady && !isFed) {
                    // 🍽️ [Feedback] 번식을 시도했으나 배가 고파서 실패한 경우 (말풍선)
                    if (Math.random() < 0.02) {
                        this.eventBus.emit('SPAWN_SPEECH_BUBBLE', {
                            entityId: id, text: '🍽️?', duration: 2000
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