import System from '../../core/System.js';
import { GlobalLogger } from '../../utils/Logger.js';
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
        const sBuffer = em.statsBuffer;
        const sfBuffer = em.statsFloatBuffer;
        const tBuffer = em.transformBuffer;

        const camera = this.engine?.camera;
        const margin = 100;
        const viewX = camera ? camera.x - margin : 0;
        const viewY = camera ? camera.y - margin : 0;
        const viewW = camera ? (camera.width / camera.zoom) + (margin * 2) : 0;
        const viewH = camera ? (camera.height / camera.zoom) + (margin * 2) : 0;

        const speciesConfig = this.engine?.speciesConfig || {};

        const items = em.animalIds.items; // 🚀 [Expert Optimization] Raw Array 참조
        const frameCount = this.engine.frameCount || 0;

        // 🚀 [Expert Optimization] 개별 엔티티 조회가 아닌 ID 리스트를 기반으로 버퍼 직접 순회
        for (let i = 0; i < items.length; i++) {
            const id = items[i];
            const idx = id * 8; // [hp, maxHp, hunger, maxHunger, fatigue, maxFatigue, str, def];
            const fIdx = id * 4;
            const tIdx = id * 2;

            const x = tBuffer[tIdx];
            const y = tBuffer[tIdx + 1];

            // 🚀 [Expert Optimization] 대사 LOD 적용
            const isVisible = camera && (x > viewX && x < viewX + viewW && y > viewY && y < viewY + viewH);

            if (!isVisible) {
                // 화면 밖 개체는 업데이트 타이밍 분산 (Staggered Update)
                if ((id + frameCount) % 10 !== 0) continue;
                this._processMetabolismLoop(id, effectiveDt * 10, sBuffer, sfBuffer, idx, fIdx, speciesConfig);
            } else {
                this._processMetabolismLoop(id, effectiveDt, sBuffer, sfBuffer, idx, fIdx, speciesConfig);
            }
        }

        // 💩 6. 배설물 분해 (10Hz로 최적화 및 대상 제한)
        this._processDecompositions(em, effectiveDt);
    }

    _processMetabolismLoop(id, dt, sBuffer, sfBuffer, idx, fIdx, speciesConfig) {
        const em = this.entityManager;
        const entity = em.entities.get(id);
        if (!entity) return;

        const animal = entity.components.get('Animal');
        if (!animal) return;

        const config = speciesConfig[animal.type] || {};

        // ⏳ 1. 허기 및 피로도 감쇄 (DOD Buffer Write)
        const hungerDecay = (config.hungerDecayRate || 0.1) * dt;
        const fatigueIncrease = (config.fatigueIncreaseRate || 0.05) * dt;

        sBuffer[idx + 2] = Math.max(0, sBuffer[idx + 2] - Math.round(hungerDecay)); // currentHunger
        sBuffer[idx + 4] = Math.min(sBuffer[idx + 5] || 100, sBuffer[idx + 4] + Math.round(fatigueIncrease)); // currentFatigue

        // 👴 2. 노화 처리
        const age = entity.components.get('Age');
        if (age) {
            age.currentAge += dt * 0.0013889;
            if (age.currentAge >= age.maxAge) {
                sBuffer[idx] = 0; // 자연사
            }
        }

        // 💀 3. 아사 처리
        if (sBuffer[idx + 2] <= 0) {
            sBuffer[idx] = Math.max(0, sBuffer[idx] - Math.round(dt * 2.0));
        }

        // 🤕 4. 부상 회복 (BaseStats 프록시를 통해 처리 - 타이머 데이터가 컴포넌트에 있으므로)
        const stats = entity.components.get('BaseStats');
        if (stats && stats.injurySlowTimer > 0) {
            stats.injurySlowTimer -= dt;
            if (stats.injurySlowTimer <= 0) {
                stats.injurySlowTimer = 0;
                stats.injurySlowMultiplier = 1.0;
            }
        }

        // 💩 5. 배설 로직 (기존 로직 유지하되 버퍼 활용)
        const metabolism = entity.components.get('Metabolism');
        const transform = entity.components.get('Transform');
        if (metabolism && transform) {
            metabolism.stomach = (sBuffer[idx + 2] / (sBuffer[idx + 3] || 100)) * metabolism.maxStomach;
            metabolism.storedFertility = sfBuffer[fIdx + 3];
            this.processInternalMetabolism(id, entity, animal, metabolism, transform, dt);
            sfBuffer[fIdx + 3] = metabolism.storedFertility;
        }
    }

    _processDecompositions(em, dt) {
        let processedCount = 0;
        const maxProcessPerTick = 50;

        const items = em.resourceIds.items; // 🚀 [Expert Optimization] Raw Array 참조

        for (let i = 0; i < items.length; i++) {
            const id = items[i];
            const entity = em.entities.get(id);
            const resource = entity?.components.get('Resource');
            const transform = entity?.components.get('Transform');

            if (resource && resource.isFertilizer && transform) {
                this.processDecomposition(id, entity, resource, transform, dt);
                processedCount++;
                if (processedCount >= maxProcessPerTick) break;
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

        // 🗺️ 맵 경계 체크 (배설 시 인덱스 오류 방지)
        if (ix < 0 || ix >= this.terrainGen.mapWidth || iy < 0 || iy >= this.terrainGen.mapHeight) return;

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
                    this.terrainGen.syncPackedPixel(idx);
                    if (resource.fertilityValue) resource.fertilityValue -= amount;

                    this.eventBus.emitDeferred('CACHE_PIXEL_UPDATE', { x, y, reason: 'fertility_change' });
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