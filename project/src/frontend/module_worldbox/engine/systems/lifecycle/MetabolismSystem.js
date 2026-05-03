import System from '../../core/System.js';
import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';

export default class MetabolismSystem extends System {
    constructor(entityManager, eventBus, engine, terrainGen) {
        super(entityManager, eventBus);
        this.engine = engine; // Engine 참조 저장
        this.terrainGen = terrainGen; 
        this.excreteThreshold = 15.0; 
        this.updateAccumulator = 0; // 🚀 [Optimization]
    }

    update(dt, time) {
        this.updateAccumulator += dt;
        if (this.updateAccumulator < 0.1) return;
        
        const effectiveDt = this.updateAccumulator;
        this.updateAccumulator = 0;

        const em = this.entityManager;
        const engine = this.engine;
        const camera = engine?.camera;
        const margin = 100;
        const viewX = camera ? camera.x - margin : 0;
        const viewY = camera ? camera.y - margin : 0;
        const viewW = camera ? (camera.width / camera.zoom) + (margin * 2) : 0;
        const viewH = camera ? (camera.height / camera.zoom) + (margin * 2) : 0;

        // 🐕 모든 생명체 대사 처리 (Animals & Humans)
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const transform = entity.components.get('Transform');
            const stats = entity.components.get('BaseStats');
            const animal = entity.components.get('Animal');
            if (!stats || !animal || !transform) continue;

            // 🚀 [Expert Optimization] 대사 LOD 적용
            const isVisible = camera && (transform.x > viewX && transform.x < viewX + viewW && 
                                         transform.y > viewY && transform.y < viewY + viewH);
            
            // 화면 밖 개체는 1초에 한 번만 대사 처리 (effectiveDt 보정)
            if (!isVisible) {
                // 개체 ID와 시간을 조합하여 업데이트 타이밍 분산 (Staggered Update)
                const updateInterval = 1.0; // 1초
                const lastUpdate = entity._lastMetabolismUpdate || 0;
                if (time - lastUpdate < updateInterval * 1000) continue;
                
                // 밀린 시간만큼 한꺼번에 처리하기 위해 dt 보정
                const lodDt = (time - lastUpdate) / 1000;
                entity._lastMetabolismUpdate = time;
                this._updateMetabolism(id, entity, stats, animal, transform, lodDt);
            } else {
                // 화면 내 개체는 기존처럼 0.1초마다 정밀 업데이트
                entity._lastMetabolismUpdate = time;
                this._updateMetabolism(id, entity, stats, animal, transform, effectiveDt);
            }
        }

        // 💩 6. 배설물 분해 (10Hz로 최적화)
        for (const id of em.resourceIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;
            const resource = entity.components.get('Resource');
            const transform = entity.components.get('Transform');
            if (resource && resource.isFertilizer && transform) {
                this.processDecomposition(id, entity, resource, transform, effectiveDt);
            }
        }
    }

    _updateMetabolism(id, entity, stats, animal, transform, effectiveDt) {
        const engine = this.engine;
        const speciesConfig = engine?.speciesConfig || {};
        const config = speciesConfig[animal.type] || {};
        const age = entity.components.get('Age');
        const jobCtrl = entity.components.get('JobController');
        const metabolism = entity.components.get('Metabolism');

        // ⏳ 1. 허기 및 피로도 감쇄 (effectiveDt 사용)
        const hungerDecay = (config.hungerDecayRate || 0.1) * effectiveDt;
        const fatigueIncrease = (config.fatigueIncreaseRate || 0.05) * effectiveDt;
        
        stats.hunger = Math.max(0, stats.hunger - hungerDecay);
        stats.fatigue = Math.min(stats.maxFatigue || 100, stats.fatigue + fatigueIncrease);

        // 👴 2. 노화 처리 (effectiveDt 사용)
        if (age) {
            age.currentAge += effectiveDt * 0.0013889; 
            
            // 🔄 수명 단계(Stage) 업데이트 (애니메이션/크기 변화 반영)
            if (Math.random() < 0.05) age.updateStage(entity); // 5% 확률로 정기 업데이트

            if (age.currentAge >= age.maxAge) {
                stats.health = 0; // 자연사
            }
        }

        // 💀 3. 아사 처리 (effectiveDt 사용)
        if (stats.hunger <= 0) {
            const damage = effectiveDt * 2.0; 
            stats.health -= damage; 
            
            if (stats.health <= 0) {
                console.log(`💀 [Death] Entity ${id} (${animal.type}) died of STARVATION.`);
            }
        }

        // 👴 노화 사망 로그
        if (age && age.currentAge >= age.maxAge && stats.health <= 0) {
            console.log(`👵 [Death] Entity ${id} (${animal.type}) died of OLD AGE.`);
        }

        // 🆘 4. 생존 인터럽트 트리거 (JobController 보유 시)
        if (jobCtrl) {
            if (stats.hunger < 30) {
                jobCtrl.requestSurvivalInterrupt(entity, 'eat');
            } else if (stats.fatigue > 80) {
                jobCtrl.requestSurvivalInterrupt(entity, 'sleep');
            }
        }

        // 💩 5. 배설 로직 (effectiveDt 사용)
        if (metabolism && transform) {
            metabolism.stomach = (stats.hunger / (stats.maxHunger || 100)) * metabolism.maxStomach;
            metabolism.storedFertility = stats.storedFertility || 0;
            this.processInternalMetabolism(id, entity, animal, metabolism, transform, effectiveDt, stats);
            if (stats) stats.storedFertility = metabolism.storedFertility;
        }

        // 🤕 7. 부상 회복 (effectiveDt 사용)
        if (stats.injurySlowTimer > 0) {
            stats.injurySlowTimer -= effectiveDt;
            if (stats.injurySlowTimer <= 0) {
                stats.injurySlowTimer = 0;
                stats.injurySlowMultiplier = 1.0; // 정상 속도 회복
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