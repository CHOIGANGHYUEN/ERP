import Visual from '../components/render/Visual.js';
import State from '../components/behavior/State.js';
import BaseStats from '../components/stats/BaseStats.js';
import Transform from '../components/motion/Transform.js';

export default class EntityFactory {
    constructor(engine) {
        this.engine = engine;
    }

    createAnimal(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const config = this.engine.speciesConfig[type];
        if (!config) return null;

        const id = em.createEntity();

        // 1. Transform (위치)
        const transform = new Transform(x, y);
        transform.vx = 0;
        transform.vy = 0;
        em.addComponent(id, transform);

        // 2. Visual (렌더링 데이터)
        let baseSize = options.isBaby ? 0.6 : 1.0;
        if (type === 'bee') baseSize = 0.8;

        em.addComponent(id, new Visual({
            color: config.color || '#ffffff',
            type: type,
            size: baseSize
        }));

        // 3. Animal (종 정보)
        em.addComponent(id, {
            type: type,
            isBaby: options.isBaby || false,
            diet: config.diet || 'herbivore',
            herdId: -1
        }, 'Animal');

        // 4. BaseStats (생존 스탯)
        em.addComponent(id, new BaseStats({
            diet: config.diet || 'herbivore',
            health: config.maxHealth || 100,
            maxHealth: config.maxHealth || 100,
            hunger: 50 + Math.random() * 30,
            maxHunger: 100, // 📏 기준치 통일
            fatigue: Math.random() * 20,
            speed: config.moveSpeed || 1.0
        }));

        // 5. Metabolism (배설/소화 전용)
        em.addComponent(id, {
            digestionSpeed: config.digestionSpeed || 0.15,
            storedFertility: 0,
            isPooping: false
        }, 'Metabolism');

        // 6. AI State
        em.addComponent(id, new State(), 'AIState');

        // 🚀 [Critical Fix] 생성 즉시 공간 해시에 등록하여 렌더러가 바로 그릴 수 있게 함
        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, false); // false = Dynamic (Animal)
        }

        return id;
    }

    createHuman(x, y, options = {}) {
        const id = this.createAnimal('human', x, y, options);
        if (id !== null) {
            const em = this.engine.entityManager;
            const entity = em.entities.get(id);
            entity.components.set('Civilization', { techLevel: 0, villageId: -1 });
            entity.components.set('Builder', { buildSpeed: 10, isBuilding: false, targetBlueprintId: null });
            entity.components.set('Inventory', { items: { wood: 0, food: 0, stone: 0 }, capacity: 100 });
        }
        return id;
    }

    createResource(type, x, y, quality = 1.0, options = {}) {
        const em = this.engine.entityManager;
        const tg = this.engine.terrainGen;
        const idx = tg.getIndex(x, y);

        if (!tg.isValidIndex(idx)) return null;

        const biomeId = tg.biomeBuffer[idx];
        const isLand = tg.isLand(idx);
        const lowerType = type.toLowerCase();
        
        // 🌊 [Expert Terrain Validation] 지형별 식생 배치 엄격 분리
        const isAquaticType = ['lotus', 'deep_sea_kelp', 'seaweed', 'waterweed', 'reed', 'luminous_moss'].includes(lowerType);
        const isLandType = !isAquaticType && !['poop', 'meat', 'milk'].includes(lowerType); // 똥/고기 등은 어디든 가능

        // 🛑 육지에 바다식물 금지, 바다에 육지식물 금지
        if (isLand && isAquaticType) return null; 
        if (!isLand && isLandType) return null;

        const isPlant = lowerType.includes('grass') || lowerType.includes('flower') || lowerType.includes('plant') || lowerType.includes('herb');
        const isTree = lowerType.includes('tree');
        const isSolid = isTree || ['rock', 'ore', 'stone', 'cactus', 'iron_ore', 'gold_ore'].includes(lowerType);

        // [Expert Logic] 비옥도 차감 및 가치 보존
        const currentFert = tg.fertilityBuffer[idx] || 0;
        if (isLand && (isPlant || isTree)) {
            // 🥗 [Integer Scaling] 소수점 차감 대신 정수 단위 차감 (255 기준)
            const consumption = isTree ? 20 : 10; 
            tg.fertilityBuffer[idx] = Math.max(0, currentFert - consumption);
            this.engine.eventBus.emit('CACHE_PIXEL_UPDATE', { x: Math.floor(x), y: Math.floor(y), reason: 'fertility_change' });
        }

        // 점유 체크
        const currentOcc = tg.getOccupancy(x, y);
        if (currentOcc >= 2) return null;
        if (currentOcc === 1 && !isSolid) return null;
        tg.setOccupancy(x, y, isSolid ? 2 : 1);

        const id = em.createEntity();
        em.addComponent(id, new Transform(x, y));

        // 생성 당시의 비옥도를 품질(가치)로 사용
        const resourceValue = currentFert / 100;

        if (type === 'grass' || type === 'pasture_grass' || type === 'weeds') {
            this.setupGrass(id, resourceValue);
        }
        else if (type === 'flower' || type === 'wildflowers' || type === 'medicinal_herb' || type === 'snow_flower') {
            this.setupFlower(id, resourceValue);
        }
        else if (type.includes('tree')) {
            if (type.includes('fruit')) options.subtype = 'fruit';
            else if (type.includes('beehive')) options.subtype = 'beehive';
            else options.subtype = 'normal';
            this.setupTree(id, resourceValue, options);
        }
        else if (type === 'mushroom' || type === 'wild_mushroom') {
            this.setupMushroom(id, quality);
        }
        else if (type === 'wild_berries') {
            this.setupBerries(id, quality);
        }
        else if (type === 'cactus') {
            this.setupCactus(id, quality);
        }
        else if (['lotus', 'deep_sea_kelp', 'seaweed', 'waterweed', 'reed', 'luminous_moss'].includes(type)) {
            this.setupAquaticPlant(id, quality, type);
        }
        else if (['rock', 'ore', 'gems', 'stone', 'coal', 'iron_ore', 'gold_ore', 'silver_ore', 'surface_copper', 'obsidian', 'flint', 'salt', 'sandstone', 'deep_stone', 'manganese_nodule'].includes(type)) {
            this.setupRock(id, quality, type);
        }
        else if (type === 'mud' || type === 'sand' || type === 'clay' || type === 'river_gravel') {
            this.setupRock(id, quality, type);
        }
        else if (type === 'poop') {
            this.setupPoop(id);
        }
        else if (type === 'meat' || type === 'milk') {
            em.addComponent(id, new Visual({ type: type, quality: quality }));
            em.addComponent(id, { type: 'food', value: 50, edible: true }, 'Resource');
        }

        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, true);
        }

        return id;
    }

    setupGrass(id, quality) {
        const em = this.engine.entityManager;
        let r, g, b;
        if (quality > 0.8) { r = 46; g = 150; b = 30; }
        else if (quality > 0.4) { r = 139; g = 195; b = 74; }
        else { r = 180; g = 180; b = 60; }

        em.addComponent(id, new Visual({
            type: 'grass',
            color: `rgb(${r},${g},${b})`,
            quality: quality
        }));
        const config = this.engine.resourceConfig['grass'] || { nutrition: 10, edible: true };
        em.addComponent(id, { type: 'food', value: Math.floor(quality * config.nutrition), edible: config.edible, isGrass: true }, 'Resource');
    }

    setupFlower(id, quality) {
        const em = this.engine.entityManager;
        const colors = ['#ff5252', '#ff4081', '#ffeb3b', '#e040fb', '#ffffff'];
        const petalColor = colors[Math.floor(Math.random() * colors.length)];

        em.addComponent(id, new Visual({
            type: 'flower',
            color: petalColor,
            quality: quality
        }));
        const config = this.engine.resourceConfig['flower'] || { nutrition: 15, edible: true };
        em.addComponent(id, {
            type: 'food',
            value: Math.floor(quality * config.nutrition),
            edible: config.edible,
            isFlower: true
        }, 'Resource');
    }

    setupTree(id, quality, options) {
        const em = this.engine.entityManager;
        em.addComponent(id, new Visual({
            type: 'tree',
            size: 15 + (quality * 10),
            quality: quality,
            subtype: options.subtype || 'normal'
        }));
        let treeKey = 'tree_normal';
        if (options.subtype === 'fruit') treeKey = 'tree_fruit';
        if (options.subtype === 'beehive') treeKey = 'tree_beehive';
        const config = this.engine.resourceConfig[treeKey] || { wood: 100 };

        const resource = {
            type: 'wood',
            value: Math.floor(quality * config.wood),
            edible: false,
            isTree: true
        };
        if (options.subtype === 'fruit' || options.subtype === 'beehive') {
            resource.foodValue = 50;
        }
        em.addComponent(id, resource, 'Resource');

        if (options.subtype === 'beehive') {
            em.addComponent(id, {
                honey: 0,
                larvaCount: 0,
                beeCount: 0,
                hasQueen: false,
                maxHoney: 100
            }, 'Hive');
        }
    }

    setupMushroom(id, quality) {
        const em = this.engine.entityManager;
        em.addComponent(id, new Visual({ type: 'mushroom', quality: quality, color: '#d32f2f' }));
        em.addComponent(id, { type: 'food', value: 15, edible: true }, 'Resource');
    }

    setupAquaticPlant(id, quality, type) {
        const em = this.engine.entityManager;
        em.addComponent(id, new Visual({
            type: type,
            size: 10 + (quality * 5),
            quality: quality,
            color: type === 'lotus' ? '#f06292' : '#2e7d32'
        }));
        em.addComponent(id, { type: 'food', value: 10, isAquatic: true }, 'Resource');
    }

    setupCactus(id, quality) {
        const em = this.engine.entityManager;
        em.addComponent(id, new Visual({ type: 'cactus', quality: quality, color: '#2e7d32' }));
        em.addComponent(id, { type: 'food', value: 5, edible: true }, 'Resource');
    }

    setupRock(id, quality, type) {
        const em = this.engine.entityManager;
        em.addComponent(id, new Visual({ type: 'rock', quality: quality, subtype: type }));
        em.addComponent(id, { type: 'material', value: 50, isRock: true }, 'Resource');
    }

    setupBerries(id, quality) {
        const em = this.engine.entityManager;
        em.addComponent(id, new Visual({ type: 'wild_berries', quality: quality, color: '#e91e63' }));
        em.addComponent(id, { type: 'food', value: 20, edible: true }, 'Resource');
    }

    setupPoop(id) {
        const em = this.engine.entityManager;
        const config = this.engine.resourceConfig['poop'] || { amount: 100 };
        em.addComponent(id, new Visual({ type: 'poop' }));
        em.addComponent(id, { isFertilizer: true, amount: config.amount }, 'Resource');
    }
}
