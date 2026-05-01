import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';
import System from '../../core/System.js';
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
                if (payload.action.startsWith('SPAWN_')) {
                    const resourceId = payload.resourceId || payload.action.replace('SPAWN_', '').toLowerCase();
                    this.spawnGenericResource(payload.x, payload.y, resourceId, payload.color, payload.treeType, true);
                }
                else if (payload.action === 'CHANGE_BIOME') {
                    const ix = Math.floor(payload.x);
                    const iy = Math.floor(payload.y);
                    this.terrainGen.biomeBuffer[idx] = payload.biome;
                    this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: ix, y: iy, reason: 'biome_change' });
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
        const biomeId = this.terrainGen.biomeBuffer[idx];
        const isWaterBiome = [0, 1, 2, 3].includes(biomeId);

        // 🛑 [Manual Tool Override] 사용자가 직접 설치할 때는 환경 제약을 무시합니다.
        const normalizedVal = isMineral ? currentVal : (currentVal / 100);
        if (!forceSpawn && normalizedVal < 0.05 && !(isAquatic && isWaterBiome)) return null;

        // 팩토리를 통해 리소스 생성
        const treeId = this.engine.entityFactory.createResource(resourceId, x, y, normalizedVal);

        // 🐝 [Beehive Integration] 벌집나무일 경우 벌들 스폰
        if (resourceId.includes('beehive') && treeId) {
            this.spawnBee(x, y, 'queen', treeId);
            this.spawnBee(x, y, 'worker', treeId);
            this.spawnBee(x, y, 'worker', treeId);
        }

        return treeId;
    }

    spawnBee(x, y, role = 'worker', hiveId = null) {
        const id = this.engine.entityFactory.createAnimal('bee', x, y);
        const bee = this.entityManager.entities.get(id);
        if (bee) {
            const animal = bee.components.get('Animal');
            if (animal) {
                animal.role = role;
                animal.hiveId = hiveId;
            }
            const visual = bee.components.get('Visual');
            if (visual) {
                visual.role = role; // 렌더러에서 크기나 색상 차이를 위해 사용
            }
        }
        return id;
    }

    spawnEntity(payload) {
        const isBaby = payload.isBaby || false;
        // 중앙 집중화된 EntityFactory를 사용하여 모든 동물이 동일한 컴포넌트(BaseStats 등)를 갖도록 보장
        this.engine.entityFactory.createAnimal(payload.type, payload.x, payload.y, { isBaby });
    }


    spawnPoop(x, y, fertilityAmount = 1.0) {
        const em = this.entityManager;
        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            entity.components.set('Transform', { x, y });
            entity.components.set('Visual', { type: 'poop' });
            entity.components.set('Resource', { isFertilizer: true, amount: 100, fertilityValue: fertilityAmount });
        }
    }
}