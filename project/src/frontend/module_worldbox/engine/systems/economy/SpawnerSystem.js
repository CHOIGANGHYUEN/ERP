import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';
import System from '../../core/System.js';
import Transform from '../../components/motion/Transform.js';
import Visual from '../../components/render/Visual.js';
import speciesConfig from '../../config/species.json';
import resourceConfig from '../../config/resource_balance.json';

export default class SpawnerSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.terrainGen = engine.terrainGen;

        this.eventBus.on('SPAWN_POOP', (payload) => this.spawnPoop(payload.x, payload.y, payload.fertilityAmount));
        this.eventBus.on('SPAWN_ENTITY', (payload) => this.spawnEntity(payload));

        this.eventBus.on('APPLY_TOOL_EFFECT', (payload) => {
            const idx = this.terrainGen.getIndex(payload.x, payload.y);
            if (this.terrainGen.isValidIndex(idx)) {
                if (payload.action === 'SPAWN_RESOURCE') {
                    const resourceId = payload.resourceId || 'grass';
                    this.spawnGenericResource(payload.x, payload.y, resourceId, payload.color, payload.treeType, true);
                }
                else if (payload.action === 'SPAWN_ENTITY') {
                    this.spawnEntity({ ...payload, x: payload.x, y: payload.y });
                }
                else if (payload.action === 'CHANGE_BIOME') {
                    const ix = Math.floor(payload.x);
                    const iy = Math.floor(payload.y);
                    
                    // 🌿 [Structural Fix] 바이옴 브러쉬는 이제 '식생'만 바꿉니다.
                    // 지형(Terrain)은 그대로 유지되므로 바다가 육지가 되는 일은 발생하지 않습니다.
                    if (this.terrainGen.isValidIndex(idx)) {
                        this.terrainGen.biomeBuffer[idx] = payload.biome;
                        this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: ix, y: iy, reason: 'biome_change' });
                    }
                }
            }
        });
    }

    update(dt, time) {
        this.spawnResources();
    }

    spawnResources() {
        // 프레임당 시도 횟수를 약간 늘려 비옥한 땅에서 더 활발하게 자라도록 조정
        for (let i = 0; i < 15; i++) {
            const x = Math.floor(Math.random() * this.terrainGen.mapWidth);
            const y = Math.floor(Math.random() * this.terrainGen.mapHeight);
            const idx = this.terrainGen.getIndex(x, y);
            const biomeId = this.terrainGen.biomeBuffer[idx];
            const fertilityRaw = this.terrainGen.fertilityBuffer[idx];
            const fertility = fertilityRaw / 100; // ⚡ 정규화

            // 비옥도가 0.3 이상인 초원/정글 지형에서만 자원 생성
            if (fertility > 0.3 && (biomeId === BIOME_NAMES_TO_IDS.get('GRASS') || biomeId === BIOME_NAMES_TO_IDS.get('JUNGLE'))) {
                // 비옥도에 비례한 확률 (최대 10%)
                if (Math.random() < fertility * 0.1) {
                    const rand = Math.random();
                    if (fertility > 0.8 && rand < 0.05) {
                        this.spawnGenericResource(x, y, 'oak_tree');
                    } else if (fertility > 0.5 && rand < 0.1) {
                        this.spawnGenericResource(x, y, 'wild_mushroom');
                    } else {
                        this.spawnGenericResource(x, y, 'grass');
                    }
                }
            }
        }
    }

    spawnGenericResource(x, y, resourceId, color, treeTypeOverride = null, forceSpawn = false) {
        if (resourceId === 'plant') resourceId = 'grass';
        const em = this.entityManager;
        const config = resourceConfig[resourceId];
        if (!config) return null;

        const idx = this.terrainGen.getIndex(x, y);

        const isMineral = config.type === 'mineral' || config.type === 'geological' || config.type === 'material';
        const envBuffer = isMineral ? this.terrainGen.mineralDensityBuffer : this.terrainGen.fertilityBuffer;
        const currentVal = envBuffer[idx] || 0;

        // 수중 생물/바다 지형 예외 처리
        const isAquatic = ['deep_sea_kelp', 'seaweed', 'lotus', 'waterweed', 'reed'].includes(resourceId);
        const isWaterTerrain = this.terrainGen.isWater(idx);

        // 🛑 [Manual Tool Override] 사용자가 직접 설치할 때는 환경 제약을 무시합니다.
        const normalizedVal = isMineral ? currentVal : (currentVal / 100);
        if (!forceSpawn && normalizedVal < 0.05 && !(isAquatic && isWaterTerrain)) return null;

        // 팩토리를 통해 리소스 생성
        const category = isMineral ? 'resource' : 'nature';
        const treeId = this.engine.factoryProvider.spawn(category, resourceId, x, y, { quality: normalizedVal });

        if (treeId) {
            // 🐝 [Beehive Integration] 벌집나무일 경우 벌들 스폰
            if (resourceId.includes('beehive')) {
                this.spawnBee(x, y, 'queen', treeId);
                this.spawnBee(x, y, 'worker', treeId);
                this.spawnBee(x, y, 'worker', treeId);
            }
        }

        return treeId;
    }

    spawnBee(x, y, role = 'worker', hiveId = null) {
        const id = this.engine.factoryProvider.spawn('animal', 'bee', x, y);
        const bee = this.entityManager.entities.get(id);
        if (bee) {
            const animal = bee.components.get('Animal');
            if (animal) {
                animal.role = role;
                animal.hiveId = hiveId;

                // 🐝 [Stats Sync] 벌집 개체 수 업데이트
                if (hiveId !== undefined && hiveId !== null) {
                    const hive = this.entityManager.entities.get(hiveId);
                    if (hive) {
                        const hiveComp = hive.components.get('Hive');
                        if (hiveComp) hiveComp.beeCount += 1;
                    }
                }
            }
            const visual = bee.components.get('Visual');
            if (visual) {
                visual.role = role; // 렌더러에서 크기나 색상 차이를 위해 사용
            }
        }
        return id;
    }

    spawnEntity(payload) {
        let type = payload.type;
        // 🔄 [Compatibility Fix] method에서 type 추출
        if (!type && payload.method) {
            type = payload.method.replace('spawn', '').toLowerCase();
            if (type === 'wilddog') type = 'wild_dog';
        }
        
        if (!type) return;

        const isBaby = payload.isBaby || false;
        
        // 🍖 [Critical Fix] 고기(meat)나 자원성 타입은 resource 카테고리로 생성
        const resourceTypes = ['meat', 'poop', 'wood', 'stone', 'food', 'gold', 'leather', 'bone'];
        const isResource = resourceTypes.includes(type);
        
        const category = isResource ? 'resource' : (type === 'human' ? 'human' : 'animal');
        
        const newId = this.engine.factoryProvider.spawn(category, type, payload.x, payload.y, { 
            isBaby,
            quality: payload.quality || 1.0 
        });
        
        // 🍖 [Expert Predation Link] 사냥꾼이 있다면, 새로 생성된 고기를 즉시 타겟으로 설정
        if (newId && payload.killerId) {
            const killer = this.entityManager.entities.get(payload.killerId);
            if (killer) {
                const killerState = killer.components.get('AIState');
                if (killerState) {
                    killerState.targetId = newId;
                    killerState.failedPathCount = 0; // 경로 실패 카운트 초기화
                }
            }
        }
        
        return newId;
    }

    spawnPoop(x, y, fertilityAmount = 1.0) {
        this.engine.factoryProvider.spawn('resource', 'poop', x, y, { quality: fertilityAmount });
    }
}