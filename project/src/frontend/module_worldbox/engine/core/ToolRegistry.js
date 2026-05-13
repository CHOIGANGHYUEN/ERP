import { BIOME_NAMES_TO_IDS } from '../world/TerrainGen.js';
import SingleBrush from '../systems/tools/brushes/SingleBrush.js';
import SprayBrush from '../systems/tools/brushes/SprayBrush.js';
import DrawBrush from '../systems/tools/brushes/DrawBrush.js';
import FillBrush from '../systems/tools/brushes/FillBrush.js';

// 🛠️ Base Tool Interface
export class Tool {
    constructor({ id, name, icon, category, description }) {
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.category = category;
        this.description = description || '';
        this.isInstant = false;
        this.isBrush = false;
    }

    execute() { return null; }
    onMouseDown(worldPos, e) { return null; }
    onMouseMove(worldPos, e) { return null; }
    onMouseUp(e) { return null; }
}

export class MoveTool extends Tool {
    constructor() { super({ id: 'move_hand', name: 'Move', icon: '🖐️', category: 'Interaction', description: '카메라를 이동하거나 지형을 둘러봅니다.' }); }
    onMouseDown(worldPos, e) { return { type: 'CAMERA_DOWN', event: e }; }
    onMouseMove(worldPos, e) { return { type: 'CAMERA_MOVE', event: e }; }
    onMouseUp(e) { return { type: 'CAMERA_UP' }; }
}

export class GrabTool extends Tool {
    constructor() { super({ id: 'grab_entity', name: 'Grab', icon: '🫳', category: 'Interaction', description: '생명체를 잡아 원하는 위치로 옮깁니다.' }); }
}

export class SpeedTool extends Tool {
    constructor({ id, name, icon, speed, description }) {
        super({ id, name, icon, category: 'Interaction', description });
        this.speed = speed;
        this.isInstant = true;
    }
    execute({ engine }) {
        if (engine) {
            engine.dispatchCommand({ type: 'SET_GAME_SPEED', payload: { speed: this.speed } });
        }
        return null;
    }
}

export class BrushTool extends Tool {
    constructor(config) {
        super(config);
        this.actionType = config.actionType || 'CHANGE_BIOME';
        this.biome = config.biome;
        this.color = config.color || '#ffffff';
        this.count = config.count || 8;
        this.config = config;
        this.isPainting = false;
        this.brushSize = config.brushSize || 1;
        
        // 🚀 전략 패턴 주입 (Strategy Pattern Injection)
        this.strategy = config.strategy;
        this.lastPos = null;
        this.isBrush = true; // 🎨 UI 인식을 위한 일반 속성 설정
    }

    onMouseDown(worldPos, e, engine) {
        this.isPainting = true;
        this.lastPos = worldPos;
        if (this.strategy) {
            const currentSize = engine && engine.brushSize ? engine.brushSize : this.brushSize;
            this.strategy.apply(null, worldPos, currentSize, this._getToolConfig());
        }
        return null; // 전략 내부에서 dispatchCommand를 호출하므로 null 반환
    }

    onMouseMove(worldPos, e, engine) {
        if (this.isPainting && this.strategy) {
            const currentSize = engine && engine.brushSize ? engine.brushSize : this.brushSize;
            this.strategy.apply(this.lastPos, worldPos, currentSize, this._getToolConfig());
            this.lastPos = worldPos;
        }
        return null;
    }

    onMouseUp() {
        this.isPainting = false;
        this.lastPos = null;
        return null;
    }

    _getToolConfig() {
        return {
            actionType: this.actionType,
            biome: this.biome ? BIOME_NAMES_TO_IDS.get(this.biome) : 0,
            resourceId: this.config.resourceId,
            color: this.color,
            count: this.count,
            treeType: this.config.treeType
        };
    }
}

export class SpawnTool extends Tool {
    constructor(config) {
        super(config);
        this.spawnMethod = config.spawnMethod;
    }
    onMouseDown(worldPos) {
        if (this.spawnMethod) {
            return { type: 'SPAWN_ENTITY', payload: { method: this.spawnMethod, x: worldPos.x, y: worldPos.y } };
        }
        return null;
    }
}

export class SingleSpawnTool extends Tool {
    constructor(config) {
        super(config);
        this.resourceId = config.resourceId;
    }
    onMouseDown(worldPos) {
        return { type: 'SPAWN_RESOURCE', payload: { type: this.resourceId, x: worldPos.x, y: worldPos.y, amount: 1 } };
    }
}

export class ItemSpawnTool extends Tool {
    constructor(config) {
        super(config);
        this.itemType = config.itemType;
        this.amount = config.amount || 1;
    }
    onMouseDown(worldPos) {
        // ItemFactory를 직접 호출하는 대신 명령을 발송 (Command Pattern)
        return { type: 'SPAWN_DROPPED_ITEM', payload: { type: this.itemType, x: worldPos.x, y: worldPos.y, amount: this.amount } };
    }
}

export class BuildTool extends Tool {
    constructor(config) {
        super(config);
        this.buildingType = config.buildingType;
    }
    onMouseDown(worldPos) {
        return { type: 'PLACE_BLUEPRINT', payload: { type: this.buildingType, x: worldPos.x, y: worldPos.y } };
    }
}

export class FenceTool extends Tool {
    constructor(config) {
        super(config);
        this.startPos = null;
        this.isDragging = false;
        this.material = config.material || 'wood';
    }

    onMouseDown(worldPos) {
        this.startPos = { x: worldPos.x, y: worldPos.y };
        this.isDragging = true;
        return null; // 드래그 시작 시점에는 아무것도 하지 않음 (또는 프리뷰 시작)
    }

    onMouseUp(e, engine) {
        if (!this.isDragging || !this.startPos) return null;
        
        const endPos = engine.inputSystem?.mouseWorld || this.startPos;
        this.isDragging = false;

        // 시작점부터 끝점까지 일직선으로 울타리 배치
        const dx = endPos.x - this.startPos.x;
        const dy = endPos.y - this.startPos.y;
        const distance = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.floor(distance / 32)); // 32px 간격

        const actions = [];
        const placedPositions = new Set();

        for (let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
            const x = this.startPos.x + dx * t;
            const y = this.startPos.y + dy * t;
            
            // 32px 그리드 스냅
            const sx = Math.floor(x / 32) * 32 + 16;
            const sy = Math.floor(y / 32) * 32 + 16;
            const posKey = `${sx},${sy}`;

            if (!placedPositions.has(posKey)) {
                placedPositions.add(posKey);
                actions.push({ 
                    type: 'SPAWN_ENTITY', 
                    payload: { 
                        category: 'fence', 
                        type: 'normal', 
                        x: sx, y: sy, 
                        options: { isBlueprint: true, material: this.material } 
                    } 
                });
            }
        }

        this.startPos = null;
        return { type: 'BATCH_COMMANDS', payload: { actions } };
    }
}

export class GodPowerTool extends Tool {
    constructor(config) {
        super(config);
        this.powerType = config.powerType;
        this.radius = config.radius || 30;
        this.isContinuous = config.isContinuous || false;
    }

    onMouseDown(worldPos) {
        return { 
            type: 'APPLY_GOD_POWER', 
            payload: { powerType: this.powerType, x: worldPos.x, y: worldPos.y, radius: this.radius } 
        };
    }

    onMouseMove(worldPos) {
        if (this.isContinuous) {
            return { 
                type: 'APPLY_GOD_POWER', 
                payload: { powerType: this.powerType, x: worldPos.x, y: worldPos.y, radius: this.radius } 
            };
        }
        return null;
    }
}

export class ToggleTool extends Tool {
    constructor(config) {
        super(config);
        this.flagName = config.flagName;
        this.isInstant = true;
    }

    // 호환성 유지: Vue UI 등에서 기존처럼 tool.execute({ engine }) 형태로 호출될 수 있음을 대비
    execute({ engine }) {
        if (engine && engine.dispatchCommand) {
            engine.dispatchCommand(this.getCommand());
        }
    }

    getCommand() {
        return { type: 'TOGGLE_VIEW', payload: { flagName: this.flagName } };
    }
}

export class InspectTool extends Tool {
    constructor() { super({ id: 'inspect_entity', name: 'Inspect', icon: '🔍', category: 'View', description: '개체나 건물의 상세 정보를 확인합니다.' }); }
    onMouseDown(worldPos) {
        return { type: 'INSPECT', payload: { worldPos } };
    }
}

export class SystemTool extends Tool {
    constructor(config) {
        super(config);
        this.action = config.action;
        this.isInstant = true;
    }

    execute({ engine }) {
        if (!engine) return;
        if (this.action === 'export') {
            engine.exportSave();
        } else if (this.action === 'import') {
            engine.eventBus.emit('UI_TRIGGER_IMPORT');
        } else if (this.action === 'stress_test') {
            engine.toggleStressTest(!engine.isStressTestMode);
        }
    }
}

// 🚀 DI Config: 신규 도구 추가 시 이곳에 선언하기만 하면 전체 시스템이 자동으로 연동됨 (개방폐쇄 원칙)
export const DefaultTools = (engine) => [
    new MoveTool(),
    new GrabTool(),
    new SpeedTool({ id: 'speed_1x', name: 'Speed 1x', icon: '▶️', speed: 1, description: '기본 속도로 시뮬레이션을 진행합니다.' }),
    new SpeedTool({ id: 'speed_2x', name: 'Speed 2x', icon: '⏩', speed: 2, description: '시뮬레이션 속도를 2배로 높입니다.' }),
    new SpeedTool({ id: 'speed_3x', name: 'Speed 3x', icon: '🚀', speed: 3, description: '시뮬레이션 속도를 3배로 높입니다.' }),
    new SpeedTool({ id: 'speed_5x', name: 'Speed 5x', icon: '⚡', speed: 5, description: '시뮬레이션 속도를 5배로 극대화합니다.' }),
    
    // 🎨 Fill (전략 패턴 적용: FillBrush)
    new BrushTool({ id: 'fill_grass', name: 'Fill Meadow', icon: '🎨', category: 'Landscape', biome: 'GRASS', strategy: new FillBrush(engine), description: '전체 지형을 푸른 초원으로 뒤덮습니다.' }),
    new BrushTool({ id: 'fill_dirt', name: 'Fill Dirt', icon: '🧱', category: 'Landscape', biome: 'DIRT', strategy: new FillBrush(engine), description: '전체 지형을 메마른 흙으로 뒤덮습니다.' }),
    
    // 🌍 Landscape (전략 패턴 적용: DrawBrush)
    new BrushTool({ id: 'paint_grass', name: 'Meadow', icon: '🌱', category: 'Landscape', color: '#a8e063', biome: 'GRASS', strategy: new DrawBrush(engine), brushSize: 2, description: '풀이 무성한 초원을 칠합니다.' }),
    new BrushTool({ id: 'paint_jungle', name: 'Jungle', icon: '🌳', category: 'Landscape', color: '#2d5a27', biome: 'JUNGLE', strategy: new DrawBrush(engine), brushSize: 2, description: '습하고 울창한 정글 지형을 칠합니다.' }),
    new BrushTool({ id: 'paint_dirt', name: 'Dirt', icon: '🟫', category: 'Landscape', color: '#8d6e63', biome: 'DIRT', strategy: new DrawBrush(engine), brushSize: 2, description: '거친 흙바닥을 칠합니다.' }),
    new BrushTool({ id: 'paint_sand', name: 'Desert', icon: '🏜️', category: 'Landscape', color: '#f4d03f', biome: 'SAND', strategy: new DrawBrush(engine), brushSize: 2, description: '뜨거운 모래 사막을 칠합니다.' }),
    new BrushTool({ id: 'paint_ocean', name: 'Ocean', icon: '💧', category: 'Landscape', color: '#3498db', biome: 'OCEAN', strategy: new DrawBrush(engine), brushSize: 3, description: '맑은 바닷물을 칠합니다.' }),
    new BrushTool({ id: 'paint_deep_ocean', name: 'Deep Ocean', icon: '🌊', category: 'Landscape', color: '#1a5276', biome: 'DEEP_OCEAN', strategy: new DrawBrush(engine), brushSize: 3, description: '어둡고 깊은 심해를 칠합니다.' }),
    new BrushTool({ id: 'paint_lake', name: 'Lake', icon: '💎', category: 'Landscape', color: '#5dade2', biome: 'LAKE', strategy: new DrawBrush(engine), brushSize: 2, description: '잔잔한 호수를 칠합니다.' }),
    new BrushTool({ id: 'paint_river', name: 'River', icon: '🏞️', category: 'Landscape', color: '#85c1e9', biome: 'RIVER', strategy: new DrawBrush(engine), brushSize: 2, description: '흐르는 강물을 칠합니다.' }),
    new BrushTool({ id: 'paint_low_mountain', name: 'Mountain', icon: '⛰️', category: 'Landscape', color: '#85929e', biome: 'LOW_MOUNTAIN', strategy: new DrawBrush(engine), brushSize: 2, description: '험준한 바위 산을 칠합니다.' }),
    new BrushTool({ id: 'paint_high_mountain', name: 'High Peak', icon: '🏔️', category: 'Landscape', color: '#fdfefe', biome: 'HIGH_MOUNTAIN', strategy: new DrawBrush(engine), brushSize: 2, description: '눈 덮인 고산 지대를 칠합니다.' }),
    
    // 🌱 Nature (Trees & Plants - SprayBrush)
    new SingleSpawnTool({ id: 'single_tree_normal', name: 'Oak (1)', icon: '🌳', category: 'Nature', resourceId: 'tree_oak' }),
    new SingleSpawnTool({ id: 'single_fruit_tree', name: 'Fruit (1)', icon: '🍎', category: 'Nature', resourceId: 'tree_fruit' }),
    new SingleSpawnTool({ id: 'single_beehive_tree', name: 'Beehive (1)', icon: '🍯', category: 'Nature', resourceId: 'tree_beehive' }),

    new BrushTool({ id: 'spawn_grass', name: 'Grass', icon: '🌾', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'grass', color: '#c5e1a5', count: 12, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_flower', name: 'Flower', icon: '🌸', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'flower', color: '#ff80ab', count: 10, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_tree_normal', name: 'Oak Tree', icon: '🌳', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'tree_oak', color: '#388e3c', count: 3, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_fruit_tree', name: 'Fruit Tree', icon: '🍎', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'tree_fruit', color: '#689f38', count: 3, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_beehive_tree', name: 'Beehive Tree', icon: '🍯', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'tree_beehive', color: '#afb42b', count: 3, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_tropical', name: 'Jungle Tree', icon: '🌴', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'tree_tropical_fruit', color: '#1b5e20', count: 3, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_mahogany', name: 'Mahogany', icon: '🌲', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'tree_mahogany', color: '#2e7d32', count: 3, strategy: new SprayBrush(engine), brushSize: 20 }),

    new BrushTool({ id: 'spawn_berries', name: 'Berries', icon: '🍓', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'berry', color: '#e91e63', count: 6, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_mushroom', name: 'Mushroom', icon: '🍄', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'mushroom', color: '#d32f2f', count: 6, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_cactus', name: 'Cactus', icon: '🌵', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'cactus', color: '#4caf50', count: 4, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_kelp', name: 'Kelp', icon: '🌿', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'deep_sea_kelp', color: '#004d40', count: 10, strategy: new SprayBrush(engine), brushSize: 25 }),
    new BrushTool({ id: 'spawn_seaweed', name: 'Seaweed', icon: '🍃', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'seaweed', color: '#1de9b6', count: 10, strategy: new SprayBrush(engine), brushSize: 25 }),
    new BrushTool({ id: 'spawn_lotus', name: 'Lotus', icon: '🪷', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'lotus', color: '#f06292', count: 5, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_reed', name: 'Reed', icon: '🎋', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'reed', color: '#aed581', count: 8, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_snow_flower', name: 'Snow Flower', icon: '❄️', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'snow_flower', color: '#e3f2fd', count: 8, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_medicinal', name: 'Herb', icon: '🌿', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'medicinal_herb', color: '#81c784', count: 6, strategy: new SprayBrush(engine), brushSize: 15 }),

    // ⛏️ Resources (전략 패턴 적용: SprayBrush)
    new BrushTool({ id: 'spawn_stone', name: 'Stone', icon: '🪨', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'stone', color: '#9e9e9e', count: 5, strategy: new SprayBrush(engine), brushSize: 20, description: '단단한 돌덩이를 배치합니다.' }),
    new BrushTool({ id: 'spawn_coal', name: 'Coal', icon: '⬛', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'coal', color: '#212121', count: 8, strategy: new SprayBrush(engine), brushSize: 20, description: '석탄 광맥을 형성합니다.' }),
    new BrushTool({ id: 'spawn_iron', name: 'Iron', icon: '⛓️', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'iron', color: '#757575', count: 6, strategy: new SprayBrush(engine), brushSize: 20, description: '철 광맥을 형성합니다.' }),
    new BrushTool({ id: 'spawn_copper', name: 'Copper', icon: '🟠', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'copper', color: '#d84315', count: 6, strategy: new SprayBrush(engine), brushSize: 20, description: '구리 광맥을 형성합니다.' }),
    new BrushTool({ id: 'spawn_gold', name: 'Gold', icon: '🟡', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'gold', color: '#fbc02d', count: 4, strategy: new SprayBrush(engine), brushSize: 20, description: '귀한 금 광맥을 형성합니다.' }),
    new BrushTool({ id: 'spawn_silver', name: 'Silver', icon: '⚪', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'silver', color: '#b0bec5', count: 4, strategy: new SprayBrush(engine), brushSize: 20, description: '은 광맥을 형성합니다.' }),
    new BrushTool({ id: 'spawn_gems', name: 'Gems', icon: '💎', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'gems', color: '#00bcd4', count: 2, strategy: new SprayBrush(engine), brushSize: 15, description: '영롱한 보석 광맥을 형성합니다.' }),
    new BrushTool({ id: 'spawn_obsidian', name: 'Obsidian', icon: '🖤', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'obsidian', color: '#263238', count: 4, strategy: new SprayBrush(engine), brushSize: 20, description: '날카로운 흑요석을 배치합니다.' }),
    new BrushTool({ id: 'spawn_clay', name: 'Clay', icon: '🏺', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'clay', color: '#a1887f', count: 8, strategy: new SprayBrush(engine), brushSize: 20, description: '점토를 얻을 수 있는 지형을 만듭니다.' }),
    new BrushTool({ id: 'spawn_flint', name: 'Flint', icon: '🔪', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'flint', color: '#546e7a', count: 8, strategy: new SprayBrush(engine), brushSize: 20, description: '부싯돌 바위를 배치합니다.' }),
    new BrushTool({ id: 'spawn_salt', name: 'Salt', icon: '🧂', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'salt', color: '#ffffff', count: 10, strategy: new SprayBrush(engine), brushSize: 20, description: '소금 결정을 배치합니다.' }),
    new BrushTool({ id: 'spawn_mud', name: 'Mud', icon: '🥣', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'mud', color: '#5d4037', count: 12, strategy: new SprayBrush(engine), brushSize: 20, description: '진흙탕을 만듭니다.' }),
    new BrushTool({ id: 'spawn_sand_res', name: 'Sand', icon: '⏳', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'sand', color: '#ffe082', count: 15, strategy: new SprayBrush(engine), brushSize: 25, description: '모래 더미를 배치합니다.' }),

    // 📦 Items (Collectible - 수집 대상)
    new ItemSpawnTool({ id: 'item_wood', name: 'Wood Log', icon: '🪵', category: 'Items', itemType: 'wood', amount: 5, description: '주민들이 수집할 수 있는 나무 통나무 더미를 투하합니다.' }),
    new ItemSpawnTool({ id: 'item_stone', name: 'Stone Piece', icon: '🪨', category: 'Items', itemType: 'stone', amount: 3, description: '주민들이 수집할 수 있는 돌 조각을 투하합니다.' }),
    new ItemSpawnTool({ id: 'item_meat', name: 'Raw Meat', icon: '🥩', category: 'Items', itemType: 'meat', amount: 1, description: '신선한 생고기를 투하합니다.' }),
    new ItemSpawnTool({ id: 'item_fruit', name: 'Fruit', icon: '🍎', category: 'Items', itemType: 'fruit', amount: 2, description: '달콤한 과일을 투하합니다.' }),
    new ItemSpawnTool({ id: 'item_grass', name: 'Grass Item', icon: '🌾', category: 'Items', itemType: 'grass', amount: 3, description: '수집 가능한 풀 더미를 투하합니다.' }),
    new ItemSpawnTool({ id: 'item_milk', name: 'Milk Jar', icon: '🥛', category: 'Items', itemType: 'milk', amount: 1, description: '영양가 높은 우유병을 투하합니다.' }),
    new ItemSpawnTool({ id: 'item_poop', name: 'Fertilizer', icon: '💩', category: 'Items', itemType: 'poop', amount: 1, description: '비옥도를 높이는 거름을 투하합니다.' }),
    new ItemSpawnTool({ id: 'item_gold', name: 'Gold Ingot', icon: '🟡', category: 'Items', itemType: 'gold', amount: 1, description: '반짝이는 금괴를 투하합니다.' }),

    // 🐑 Life (Creatures)
    new SpawnTool({ id: 'spawn_sheep', name: 'Sheep', icon: '🐑', category: 'Life', spawnMethod: 'spawnSheep', description: '온순한 양을 소환합니다.' }),
    new SpawnTool({ id: 'spawn_cow', name: 'Cow', icon: '🐄', category: 'Life', spawnMethod: 'spawnCow', description: '젖을 주는 소를 소환합니다.' }),
    new SpawnTool({ id: 'spawn_human', name: 'Human', icon: '👤', category: 'Life', spawnMethod: 'spawnHuman', description: '문명을 건설할 인간을 소환합니다.' }),
    new SpawnTool({ id: 'spawn_wolf', name: 'Wolf', icon: '🐺', category: 'Life', spawnMethod: 'spawnWolf', description: '야생의 늑대를 소환합니다.' }),
    new SpawnTool({ id: 'spawn_hyena', name: 'Hyena', icon: '🐾', category: 'Life', spawnMethod: 'spawnHyena', description: '무리를 짓는 하이에나를 소환합니다.' }),
    new SpawnTool({ id: 'spawn_wild_dog', name: 'Wild Dog', icon: '🐕', category: 'Life', spawnMethod: 'spawnWildDog', description: '빠른 들개를 소환합니다.' }),
    
    // 🦁 Predators
    new SpawnTool({ id: 'spawn_tiger', name: 'Tiger', icon: '🐅', category: 'Life', spawnMethod: 'spawnTiger', description: '강력한 호랑이를 소환합니다.' }),
    new SpawnTool({ id: 'spawn_lion', name: 'Lion', icon: '🦁', category: 'Life', spawnMethod: 'spawnLion', description: '백수의 왕 사자를 소환합니다.' }),
    new SpawnTool({ id: 'spawn_bear', name: 'Bear', icon: '🐻', category: 'Life', spawnMethod: 'spawnBear', description: '거대한 곰을 소환합니다.' }),
    new SpawnTool({ id: 'spawn_fox', name: 'Fox', icon: '🦊', category: 'Life', spawnMethod: 'spawnFox', description: '영리한 여우를 소환합니다.' }),
    new SpawnTool({ id: 'spawn_crocodile', name: 'Crocodile', icon: '🐊', category: 'Life', spawnMethod: 'spawnCrocodile', description: '위험한 악어를 소환합니다.' }),

    // 🦌 Herbivores
    new SpawnTool({ id: 'spawn_deer', name: 'Deer', icon: '🦌', category: 'Life', spawnMethod: 'spawnDeer', description: '우아한 사슴을 소환합니다.' }),
    new SpawnTool({ id: 'spawn_rabbit', name: 'Rabbit', icon: '🐇', category: 'Life', spawnMethod: 'spawnRabbit', description: '번식력이 강한 토끼를 소환합니다.' }),
    new SpawnTool({ id: 'spawn_horse', name: 'Horse', icon: '🐎', category: 'Life', spawnMethod: 'spawnHorse', description: '빠른 말을 소환합니다.' }),
    new SpawnTool({ id: 'spawn_elephant', name: 'Elephant', icon: '🐘', category: 'Life', spawnMethod: 'spawnElephant', description: '장엄한 코끼리를 소환합니다.' }),
    new SpawnTool({ id: 'spawn_goat', name: 'Goat', icon: '🐐', category: 'Life', spawnMethod: 'spawnGoat', description: '산양을 소환합니다.' }),
    
    // 🏘️ Civilization (Buildings)
    new BuildTool({ id: 'build_house', name: 'Wood House', icon: '🏠', category: 'Civilization', buildingType: 'house', description: '주민들이 거주할 수 있는 통나무 집 청사진을 배치합니다.' }),
    new FenceTool({ id: 'build_fence', name: 'Fence', icon: '🚧', category: 'Civilization', material: 'wood', description: '드래그하여 영역을 구분하는 울타리를 세웁니다.' }),
    new FenceTool({ id: 'build_fence_stone', name: 'Stone Wall', icon: '🧱', category: 'Civilization', material: 'stone', description: '드래그하여 튼튼한 돌 성벽을 세웁니다.' }),
    new BuildTool({ id: 'build_gate', name: 'Fence Gate', icon: '🚪', category: 'Civilization', buildingType: 'fence_gate', description: '울타리 사이를 지날 수 있는 문을 설치합니다.' }),

    // ⚡ God Powers (신적 권능)
    new GodPowerTool({ id: 'power_meteor', name: 'Meteor', icon: '☄️', category: 'God Powers', powerType: 'meteor', radius: 40, description: '거대한 운석을 투하하여 지형을 파괴하고 생명체를 소멸시킵니다.' }),
    new GodPowerTool({ id: 'power_lightning', name: 'Lightning', icon: '⚡', category: 'God Powers', powerType: 'lightning', radius: 15, description: '강력한 번개를 내리쳐 적들을 심판합니다.' }),
    new GodPowerTool({ id: 'power_magnet', name: 'Magnet', icon: '🧲', category: 'God Powers', powerType: 'magnet', radius: 60, isContinuous: true, description: '떨어진 아이템들을 커서 방향으로 강력하게 끌어당깁니다.' }),
    new GodPowerTool({ id: 'power_bless', name: 'Blessing', icon: '✨', category: 'God Powers', powerType: 'bless', radius: 30, description: '생명체들의 체력을 회복시키고 대지를 축복합니다.' }),
    new GodPowerTool({ id: 'power_disaster', name: 'Clean Up', icon: '💀', category: 'God Powers', powerType: 'disaster', radius: 50, description: '범위 내의 모든 생명체를 즉시 제거합니다.' }),

    // 👁️ View (Filters)
    new ToggleTool({ id: 'view_wind', name: 'Wind View', icon: '🌬️', category: 'View', flagName: 'wind', description: '바람의 흐름을 시각화합니다.' }),
    new ToggleTool({ id: 'view_fertility', name: 'Fertility View', icon: '💎', category: 'View', flagName: 'fertility', description: '지형의 비옥도를 색상으로 표시합니다.' }),
    new ToggleTool({ id: 'view_fertility_value', name: 'Fertility Info', icon: '🔢', category: 'View', flagName: 'fertilityValue', description: '각 타일의 정확한 비옥도 수치를 표시합니다.' }),
    new ToggleTool({ id: 'view_water', name: 'Water Quality', icon: '🌊', category: 'View', flagName: 'water', description: '수질 오염도 및 상태를 표시합니다.' }),
    new ToggleTool({ id: 'view_mineral', name: 'Mineral Density', icon: '⛏️', category: 'View', flagName: 'mineral', description: '매장된 광물의 밀도를 시각화합니다.' }),
    new ToggleTool({ id: 'view_xray', name: 'X-Ray View', icon: '👁️', category: 'View', flagName: 'xray', description: '구조물 내부의 엔티티를 투과해서 봅니다.' }),
    new ToggleTool({ id: 'view_debug_ai', name: 'AI Paths', icon: '🛣️', category: 'View', flagName: 'debugAI', description: '주민들의 이동 경로와 목적지를 표시합니다.' }),
    new ToggleTool({ id: 'view_showNames', name: 'Show Names', icon: '🏷️', category: 'View', flagName: 'showNames', description: '엔티티 위에 이름을 표시합니다.' }),
    new ToggleTool({ id: 'view_village', name: 'Village Info', icon: '🏘️', category: 'View', flagName: 'village', description: '마을의 경계와 통계를 표시합니다.' }),
    new ToggleTool({ id: 'view_nation', name: 'Nation View', icon: '🚩', category: 'View', flagName: 'nation', description: '국가별 영토를 색상으로 구분하여 표시합니다.' }),
    new ToggleTool({ id: 'view_zone', name: 'Zone View', icon: '🗺️', category: 'View', flagName: 'zone', description: '마을 내 구역 설정(주거/벌목 등)을 표시합니다.' }),
    new ToggleTool({ id: 'view_job_monitor', name: 'Job Monitor', icon: '📊', category: 'View', flagName: 'jobMonitor', description: '모든 주민의 직업 상태와 도구 장착 현황을 실시간으로 모니터링합니다.' }),
    new InspectTool(),

    // ⚙️ System (Persistence & Performance)
    new SystemTool({ id: 'sys_save', name: 'Export Save', icon: '📤', category: 'System', action: 'export', description: '현재 세계의 모든 데이터를 JSON 파일로 내보냅니다. (DB 없이 세이브 가능)' }),
    new SystemTool({ id: 'sys_load', name: 'Import Save', icon: '📥', category: 'System', action: 'import', description: 'JSON 세이브 파일을 불러와 이전 세계를 복구합니다.' }),
    new SystemTool({ id: 'sys_stress', name: 'Stress Test', icon: '🌡️', category: 'System', action: 'stress_test', description: '시뮬레이션 속도를 5배로 높이고 대량의 엔티티를 강제 소환하여 성능 안정성을 테스트합니다.' }),


];