import System from '../../core/System.js';
import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';

export default class MetabolismSystem extends System {
    constructor(entityManager, eventBus, terrainGen) {
        super(entityManager, eventBus);
        this.terrainGen = terrainGen; // TerrainGen 인스턴스 주입
        this.excreteThreshold = 15.0; // 💩 배설 임계값 상향 (더 많이 먹고 영양가 높은 똥을 싸도록)
    }

    update(dt, time) {
        const em = this.entityManager;
        const engine = this.engine; // Engine 참조 (speciesConfig 접근용)
        const speciesConfig = engine?.speciesConfig || {};

        // 🐕 모든 생명체 대사 처리 (Animals & Humans)
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const stats = entity.components.get('BaseStats');
            const age = entity.components.get('Age');
            const animal = entity.components.get('Animal');
            const jobCtrl = entity.components.get('JobController');
            const transform = entity.components.get('Transform');
            const metabolism = entity.components.get('Metabolism');

            if (!stats || !animal) continue;

            const config = speciesConfig[animal.type] || {};
            
            // ⏳ 1. 허기 및 피로도 감쇄
            const hungerDecay = (config.hungerDecayRate || 0.1) * dt;
            const fatigueIncrease = (config.fatigueIncreaseRate || 0.05) * dt;
            
            stats.hunger = Math.max(0, stats.hunger - hungerDecay);
            stats.fatigue = Math.min(stats.maxFatigue || 100, stats.fatigue + fatigueIncrease);

            // 👴 2. 노화 처리 (1시간마다 1달 정도 나이를 먹는 느낌으로 밸런싱)
            if (age) {
                // dt는 초 단위. 3600초(1시간)마다 0.08세(약 1개월) 증가
                age.currentAge += dt * 0.00002; 
                if (age.currentAge >= age.maxAge) {
                    stats.health = 0; // 자연사
                }
            }

            // 💀 3. 아사 처리
            if (stats.hunger <= 0) {
                stats.health -= dt * 5; // 굶주림으로 인한 서서히 사망
            }

            // 🆘 4. 생존 인터럽트 트리거 (JobController 보유 시)
            if (jobCtrl) {
                if (stats.hunger < 30) {
                    jobCtrl.requestSurvivalInterrupt(entity, 'eat');
                } else if (stats.fatigue > 80) {
                    jobCtrl.requestSurvivalInterrupt(entity, 'sleep');
                }
            }

            // 💩 5. 배설 로직 (기존 로직 유지 및 보강)
            if (metabolism && transform) {
                metabolism.stomach = (stats.hunger / (stats.maxHunger || 100)) * metabolism.maxStomach;
                metabolism.storedFertility = stats.storedFertility || 0;
                this.processInternalMetabolism(id, entity, animal, metabolism, transform, dt, stats);
                if (stats) stats.storedFertility = metabolism.storedFertility;
            }
        }

        // 💩 6. 배설물 분해 (기존 로직 유지)
        for (const id of em.resourceIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;
            const resource = entity.components.get('Resource');
            const transform = entity.components.get('Transform');
            if (resource && resource.isFertilizer && transform) {
                this.processDecomposition(id, entity, resource, transform, dt);
            }
        }
    }

    processInternalMetabolism(id, entity, animal, metabolism, transform, dt, stats) {
        // 소화 로직: 위장(stomach)의 내용물을 저장된 비옥도(storedFertility)로 전환
        if (metabolism.stomach > 0) {
            // 소화 속도에 따른 처리 (여기서는 배설 게이지 축적을 위한 시간 흐름으로 사용)
            // 비옥도 수치 자체는 이미 EatState에서 식물의 품질을 기반으로 stats.storedFertility에 쌓여 있습니다.
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
                fertilityAmount: metabolism.storedFertility // 🧪 이미 식사 품질이 반영된 값
            });
            metabolism.storedFertility = 0;
            if (stats) stats.storedFertility = 0; // 동기화 초기화
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
            
            // 배설물의 영양분을 땅으로 환원 (8비트 정수 체계: 0-255)
            const releaseRate = dt * 100.0; // 초당 100 주입 시도
            const amount = Math.min(resource.fertilityValue || 10, releaseRate);
            
            if (amount > 0) {
                const current = fb[idx] || 0;
                // 🚀 [Scale Fix] 최대 255까지 비옥도 누적 가능
                const next = Math.min(255, current + amount);
                
                if (Math.floor(next) > current) {
                    fb[idx] = Math.floor(next);
                    if (resource.fertilityValue) resource.fertilityValue -= amount;
                    
                    this.eventBus.emit('CACHE_PIXEL_UPDATE', { x, y, reason: 'fertility_change' });
                } else if (resource.fertilityValue) {
                    resource.fertilityValue -= amount;
                }
            }

            // 모든 영양분이 환원되면 배설물 엔티티 제거
            if (!resource.fertilityValue || resource.fertilityValue <= 0.5) {
                this.entityManager.removeEntity(id);
            }
        }
    }

}