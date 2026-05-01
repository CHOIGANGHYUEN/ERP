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
        const entity = em.entities.get(id);

        // 1. Transform (위치)
        const transform = new Transform(x, y);
        transform.vx = 0;
        transform.vy = 0;
        entity.components.set('Transform', transform);

        // 2. Visual (렌더링 데이터) - 클래스 인스턴스 사용
        entity.components.set('Visual', new Visual({
            color: config.color || '#ffffff',
            type: type,
            size: options.isBaby ? 0.6 : 1.0
        }));

        // 3. Animal (종 정보)
        entity.components.set('Animal', {
            type: type,
            isBaby: options.isBaby || false,
            diet: config.diet || 'herbivore',
            herdId: -1
        });

        // 4. BaseStats (새로 추가된 생존 스탯) - 클래스 인스턴스 사용
        const stats = new BaseStats({
            diet: config.diet || 'herbivore',
            health: config.maxHealth || 100,
            maxHealth: config.maxHealth || 100,
            hunger: 50 + Math.random() * 30, // 약간 배고픈 상태로 시작
            fatigue: Math.random() * 20,
            speed: config.moveSpeed || 1.0
        });
        entity.components.set('BaseStats', stats);

        // 5. Metabolism (기존 시스템 호환용)
        entity.components.set('Metabolism', {
            stomach: options.isBaby ? 0 : (config.maxStomach || 3.0) * 0.4,
            maxStomach: config.maxStomach || 3.0,
            digestionSpeed: config.digestionSpeed || 0.15,
            storedFertility: 0,
            isPooping: false
        });

        // 6. AI State (상태 기계) - 클래스 인스턴스 사용
        entity.components.set('AIState', new State());

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

        // [5단계 상세] 식생 스폰 시 비옥도 차감 및 0.1 하한선 보호 로직
        if (tg.isValidIndex(idx)) {
            const biomeId = tg.biomeBuffer[idx];
            const isLand = tg.isLand(biomeId);

            const lowerType = type.toLowerCase();
            const isPlant = lowerType.includes('grass') || lowerType.includes('flower') || lowerType.includes('plant') || lowerType.includes('herb');
            const isTree = lowerType.includes('tree');

            if (isLand && (isPlant || isTree)) {
                const currentFert = tg.fertilityBuffer[idx];
                const consumption = isTree ? 0.8 : 0.4; // 나무는 더 많이 소모
                // 토지 지형의 생존 최솟값 0.1 하한선 방어
                tg.fertilityBuffer[idx] = Math.max(0.1, currentFert - consumption);
                this.engine.eventBus.emit('CACHE_PIXEL_UPDATE', { x: Math.floor(x), y: Math.floor(y), reason: 'fertility_change' });
            }
        }

        // 🛑 [Smart Overlap Prevention] 계급제 점유 시스템
        // 0: 빈칸, 1: 소형 식생(풀/꽃), 2: 대형 고체(나무/바위)
        const currentOcc = tg.getOccupancy(x, y);
        const isSolid = type.includes('tree') || ['rock', 'ore', 'stone', 'cactus', 'iron_ore', 'gold_ore'].includes(type);
        
        if (currentOcc >= 2) return null; // 나무/바위 위에는 중복 설치 불가
        if (currentOcc === 1 && !isSolid) return null; // 풀 위에 풀 중복 설치 불가
        
        // 나무를 심으려는데 풀이 있다면? 풀을 제거하고 나무를 심음 (Overwrite)
        if (currentOcc === 1 && isSolid) {
            // 해당 위치의 작은 식물 제거 로직 (선택 사항: 성능을 위해 일단 장부만 업데이트)
        }

        tg.setOccupancy(x, y, isSolid ? 2 : 1);

        const id = em.createEntity();
        const entity = em.entities.get(id);

        entity.components.set('Transform', new Transform(x, y));


        if (type === 'grass' || type === 'pasture_grass' || type === 'weeds') {
            this.setupGrass(entity, quality);
        }
        else if (type === 'flower' || type === 'wildflowers' || type === 'medicinal_herb' || type === 'snow_flower') {
            this.setupFlower(entity, quality);
        }
        else if (type.includes('tree')) {
            if (type.includes('fruit')) options.subtype = 'fruit';
            else if (type.includes('beehive')) options.subtype = 'beehive';
            else options.subtype = 'normal';
            this.setupTree(entity, quality, options);
        }
        else if (type === 'mushroom' || type === 'wild_mushroom') {
            this.setupMushroom(entity, quality);
        }
        else if (type === 'wild_berries') {
            this.setupBerries(entity, quality);
        }
        else if (type === 'cactus') {
            this.setupCactus(entity, quality);
        }
        else if (['lotus', 'deep_sea_kelp', 'seaweed', 'waterweed', 'reed', 'luminous_moss'].includes(type)) {
            this.setupAquaticPlant(entity, quality, type);
        }
        else if (['rock', 'ore', 'gems', 'stone', 'coal', 'iron_ore', 'gold_ore', 'silver_ore', 'surface_copper', 'obsidian', 'flint', 'salt', 'sandstone', 'deep_stone', 'manganese_nodule'].includes(type)) {
            this.setupRock(entity, quality, type);
        }
        else if (type === 'mud' || type === 'sand' || type === 'clay' || type === 'river_gravel') {
            this.setupRock(entity, quality, type); // 토양성 자원도 일단 Rock 로직 재활용
        }
        else if (type === 'poop') {
            this.setupPoop(entity);
        }
        else if (type === 'meat' || type === 'milk') {
            entity.components.set('Visual', new Visual({ type: type, quality: quality }));
            entity.components.set('Resource', { type: 'food', value: 50, edible: true });
        }

        return id;
    }

    setupGrass(entity, quality) {
        let r, g, b;
        if (quality > 0.8) { r = 46; g = 150; b = 30; }
        else if (quality > 0.4) { r = 139; g = 195; b = 74; }
        else { r = 180; g = 180; b = 60; }

        entity.components.set('Visual', new Visual({
            type: 'grass',
            color: `rgb(${r},${g},${b})`,
            quality: quality
        }));
        const config = this.engine.resourceConfig['grass'] || { nutrition: 10, edible: true };
        entity.components.set('Resource', { type: 'food', value: Math.floor(quality * config.nutrition), edible: config.edible, isGrass: true });
    }

    setupFlower(entity, quality) {
        const colors = ['#ff5252', '#ff4081', '#ffeb3b', '#e040fb', '#ffffff'];
        const petalColor = colors[Math.floor(Math.random() * colors.length)];

        entity.components.set('Visual', new Visual({
            type: 'flower',
            color: petalColor,
            quality: quality
        }));
        const config = this.engine.resourceConfig['flower'] || { nutrition: 15, edible: true };
        entity.components.set('Resource', {
            type: 'food',
            value: Math.floor(quality * config.nutrition),
            edible: config.edible,
            isFlower: true
        });
    }

    setupTree(entity, quality, options) {
        entity.components.set('Visual', new Visual({
            type: 'tree',
            size: 15 + (quality * 10), // 📏 나무 크기 정상화 (15~25px)
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
        entity.components.set('Resource', resource);
    }

    setupMushroom(entity, quality) {
        entity.components.set('Visual', new Visual({ type: 'mushroom', quality: quality, color: '#d32f2f' }));
        entity.components.set('Resource', { type: 'food', value: 15, edible: true });
    }

    setupAquaticPlant(entity, quality, type) {
        entity.components.set('Visual', new Visual({
            type: type,
            size: 10 + (quality * 5), // 💧 수생 식물 크기 보정 (10~15px)
            quality: quality,
            color: type === 'lotus' ? '#f06292' : '#2e7d32'
        }));
        entity.components.set('Resource', { type: 'food', value: 10, isAquatic: true });
    }

    setupCactus(entity, quality) {
        entity.components.set('Visual', new Visual({ type: 'cactus', quality: quality, color: '#2e7d32' }));
        entity.components.set('Resource', { type: 'food', value: 5, edible: true });
    }

    setupRock(entity, quality, type) {
        entity.components.set('Visual', new Visual({ type: 'rock', quality: quality, subtype: type }));
        entity.components.set('Resource', { type: 'material', value: 50, isRock: true });
    }

    setupBerries(entity, quality) {
        entity.components.set('Visual', new Visual({ type: 'wild_berries', quality: quality, color: '#e91e63' }));
        entity.components.set('Resource', { type: 'food', value: 20, edible: true });
    }

    setupAquaticPlant(entity, quality, type) {
        entity.components.set('Visual', new Visual({ type: type, quality: quality }));
        entity.components.set('Resource', { type: 'food', value: 10, edible: true, isAquatic: true });
    }

    setupPoop(entity) {
        const config = this.engine.resourceConfig['poop'] || { amount: 100 };
        entity.components.set('Visual', new Visual({ type: 'poop' }));
        entity.components.set('Resource', { isFertilizer: true, amount: config.amount });
    }
}
