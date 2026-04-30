import System from '../../core/System.js';
import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';

export default class MetabolismSystem extends System {
    constructor(entityManager, eventBus, terrainGen) {
        super(entityManager, eventBus);
        this.terrainGen = terrainGen; // TerrainGen 인스턴스 주입
        this.excreteThreshold = 1.0;
    }

    update(dt, time) {
        const em = this.entityManager;
        for (const [id, entity] of em.entities) {
            const animal = entity.components.get('Animal');
            const metabolism = entity.components.get('Metabolism');
            const transform = entity.components.get('Transform');
            const stats = entity.components.get('BaseStats');
            const resource = entity.components.get('Resource');

            // 1. 동물 대사 처리 (Animal Metabolism)
            if (animal && metabolism && transform) {
                // BaseStats가 있는 경우 hunger와 stomach 동기화
                // (hunger 100 = 배부름, stomach 가득 참 / hunger 0 = 배고픔, stomach 비어있음)
                if (stats) {
                    metabolism.stomach = (stats.hunger / stats.maxHunger) * metabolism.maxStomach;
                }

                this.processInternalMetabolism(id, entity, animal, metabolism, transform, dt);

                const visual = entity.components.get('Visual');
                if (visual) {
                    visual.isPooping = metabolism.isPooping;
                }
            }

            // 2. 배설물 분해 및 비옥도 환원 (Poop Decomposition)
            if (resource && resource.isFertilizer && transform) {
                this.processDecomposition(id, entity, resource, transform, dt);
            }
        }
    }

    processInternalMetabolism(id, entity, animal, metabolism, transform, dt) {
        // 소화 로직: 위장(stomach)의 내용물을 저장된 비옥도(storedFertility)로 전환
        if (metabolism.stomach > 0) {
            const processRate = metabolism.digestionSpeed || 0.1;
            const amount = Math.min(metabolism.stomach, processRate * dt);
            // 소화된 만큼 저장된 비옥도 수치 증가
            metabolism.storedFertility += amount * 2.0; 
            
            // Note: 실제 stomach 수치는 AnimalBehaviorSystem에서 hunger 감소로 자연스럽게 줄어듦
        }

        // 배설 로직: 저장된 비옥도가 임계치를 넘으면 배설물 생성
        const ix = Math.floor(transform.x);
        const iy = Math.floor(transform.y);
        const idx = iy * this.terrainGen.mapWidth + ix;
        const currentBiomeId = this.terrainGen.biomeBuffer[idx];
        const isInWater = [0, 1, 2, 3].includes(currentBiomeId); // OCEAN, RIVER 등

        if (!isInWater && metabolism.storedFertility >= this.excreteThreshold) {
            metabolism.isPooping = true;
            this.eventBus.emit('SPAWN_POOP', { 
                x: transform.x, 
                y: transform.y, 
                fertilityAmount: metabolism.storedFertility 
            });
            metabolism.storedFertility = 0;
        } else if (metabolism.isPooping) {
            // 배설 모션 종료 확률
            if (Math.random() < 0.05) metabolism.isPooping = false;
        }
    }

    processDecomposition(id, entity, resource, transform, dt) {
        const x = Math.floor(transform.x);
        const y = Math.floor(transform.y);
        const width = this.terrainGen.mapWidth;
        const fb = this.terrainGen.fertilityBuffer;

        if (x >= 0 && x < width && y >= 0 && y < this.terrainGen.mapHeight) {
            const idx = y * width + x;
            
            // 배설물의 영양분을 땅으로 환원 (정수 체계에 맞게 속도 조정)
            const releaseRate = dt * 100.0; // 초당 100 (즉, 100%) 주입 시도
            const amount = Math.min(resource.fertilityValue || 1.0, releaseRate);
            
            if (amount > 0) {
                // 정수 버퍼에 더하기 위해 반올림 처리
                const current = fb[idx] || 0;
                const next = Math.min(100, current + amount);
                
                if (Math.floor(next) > current) {
                    fb[idx] = Math.floor(next);
                    if (resource.fertilityValue) resource.fertilityValue -= amount;
                    
                    // 지형 리렌더링 및 확산 시스템 활성화
                    this.eventBus.emit('CACHE_PIXEL_UPDATE', { x, y, reason: 'fertility_change' });
                } else if (resource.fertilityValue) {
                    // 정수 변화가 없더라도 데이터는 차감 (나중에 한 번에 변하도록)
                    resource.fertilityValue -= amount;
                }
            }


            // 모든 영양분이 환원되면 배설물 엔티티 제거
            if (!resource.fertilityValue || resource.fertilityValue <= 0.01) {
                this.entityManager.removeEntity(id);
            }
        }
    }

}