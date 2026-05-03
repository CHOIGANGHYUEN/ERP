import { BIOME_NAMES_TO_IDS } from '../world/TerrainGen.js';
import SingleBrush from '../systems/tools/brushes/SingleBrush.js';
import SprayBrush from '../systems/tools/brushes/SprayBrush.js';
import DrawBrush from '../systems/tools/brushes/DrawBrush.js';
import FillBrush from '../systems/tools/brushes/FillBrush.js';

// 🛠️ Base Tool Interface
export class Tool {
    constructor({ id, name, icon, category }) {
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.category = category;
        this.isInstant = false;
        this.isBrush = false;
    }

    execute() { return null; }
    onMouseDown(worldPos, e) { return null; }
    onMouseMove(worldPos, e) { return null; }
    onMouseUp(e) { return null; }
}

export class MoveTool extends Tool {
    constructor() { super({ id: 'move_hand', name: 'Move', icon: '🖐️', category: 'Interaction' }); }
    onMouseDown(worldPos, e) { return { type: 'CAMERA_DOWN', event: e }; }
    onMouseMove(worldPos, e) { return { type: 'CAMERA_MOVE', event: e }; }
    onMouseUp(e) { return { type: 'CAMERA_UP' }; }
}

export class GrabTool extends Tool {
    constructor() { super({ id: 'grab_entity', name: 'Grab', icon: '🫳', category: 'Interaction' }); }
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

export class BuildTool extends Tool {
    constructor(config) {
        super(config);
        this.buildingType = config.buildingType;
    }
    onMouseDown(worldPos) {
        return { type: 'PLACE_BLUEPRINT', payload: { type: this.buildingType, x: worldPos.x, y: worldPos.y } };
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
    constructor() { super({ id: 'inspect_entity', name: 'Inspect', icon: '🔍', category: 'View' }); }
    onMouseDown(worldPos) {
        return { type: 'INSPECT', payload: { worldPos } };
    }
}

// 🚀 DI Config: 신규 도구 추가 시 이곳에 선언하기만 하면 전체 시스템이 자동으로 연동됨 (개방폐쇄 원칙)
export const DefaultTools = (engine) => [
    new MoveTool(),
    new GrabTool(),
    
    // 🎨 Fill (전략 패턴 적용: FillBrush)
    new BrushTool({ id: 'fill_grass', name: 'Fill Meadow', icon: '🎨', category: 'Landscape', biome: 'GRASS', strategy: new FillBrush(engine) }),
    new BrushTool({ id: 'fill_dirt', name: 'Fill Dirt', icon: '🧱', category: 'Landscape', biome: 'DIRT', strategy: new FillBrush(engine) }),
    
    // 🌍 Landscape (전략 패턴 적용: DrawBrush)
    new BrushTool({ id: 'paint_grass', name: 'Meadow', icon: '🌱', category: 'Landscape', color: '#a8e063', biome: 'GRASS', strategy: new DrawBrush(engine), brushSize: 2 }),
    new BrushTool({ id: 'paint_jungle', name: 'Jungle', icon: '🌳', category: 'Landscape', color: '#2d5a27', biome: 'JUNGLE', strategy: new DrawBrush(engine), brushSize: 2 }),
    new BrushTool({ id: 'paint_dirt', name: 'Dirt', icon: '🟫', category: 'Landscape', color: '#8d6e63', biome: 'DIRT', strategy: new DrawBrush(engine), brushSize: 2 }),
    new BrushTool({ id: 'paint_sand', name: 'Desert', icon: '🏜️', category: 'Landscape', color: '#f4d03f', biome: 'SAND', strategy: new DrawBrush(engine), brushSize: 2 }),
    new BrushTool({ id: 'paint_ocean', name: 'Ocean', icon: '💧', category: 'Landscape', color: '#3498db', biome: 'OCEAN', strategy: new DrawBrush(engine), brushSize: 3 }),
    new BrushTool({ id: 'paint_deep_ocean', name: 'Deep Ocean', icon: '🌊', category: 'Landscape', color: '#1a5276', biome: 'DEEP_OCEAN', strategy: new DrawBrush(engine), brushSize: 3 }),
    new BrushTool({ id: 'paint_lake', name: 'Lake', icon: '💎', category: 'Landscape', color: '#5dade2', biome: 'LAKE', strategy: new DrawBrush(engine), brushSize: 2 }),
    new BrushTool({ id: 'paint_river', name: 'River', icon: '🏞️', category: 'Landscape', color: '#85c1e9', biome: 'RIVER', strategy: new DrawBrush(engine), brushSize: 2 }),
    new BrushTool({ id: 'paint_low_mountain', name: 'Mountain', icon: '⛰️', category: 'Landscape', color: '#85929e', biome: 'LOW_MOUNTAIN', strategy: new DrawBrush(engine), brushSize: 2 }),
    new BrushTool({ id: 'paint_high_mountain', name: 'High Peak', icon: '🏔️', category: 'Landscape', color: '#fdfefe', biome: 'HIGH_MOUNTAIN', strategy: new DrawBrush(engine), brushSize: 2 }),
    
    // 🌱 Nature (Trees & Plants - SprayBrush)
    new SingleSpawnTool({ id: 'single_tree_normal', name: 'Oak (1)', icon: '🌳', category: 'Nature', resourceId: 'oak_tree' }),
    new SingleSpawnTool({ id: 'single_fruit_tree', name: 'Fruit (1)', icon: '🍎', category: 'Nature', resourceId: 'tree_fruit' }),
    new SingleSpawnTool({ id: 'single_beehive_tree', name: 'Beehive (1)', icon: '🍯', category: 'Nature', resourceId: 'tree_beehive' }),

    new BrushTool({ id: 'spawn_grass', name: 'Grass', icon: '🌾', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'grass', color: '#c5e1a5', count: 12, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_flower', name: 'Flower', icon: '🌸', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'flower', color: '#ff80ab', count: 10, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_tree_normal', name: 'Oak Tree', icon: '🌳', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'oak_tree', color: '#388e3c', count: 3, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_fruit_tree', name: 'Fruit Tree', icon: '🍎', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'tree_fruit', color: '#689f38', count: 3, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_beehive_tree', name: 'Beehive Tree', icon: '🍯', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'tree_beehive', color: '#afb42b', count: 3, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_tropical', name: 'Jungle Tree', icon: '🌴', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'tropical_fruit_tree', color: '#1b5e20', count: 3, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_mahogany', name: 'Mahogany', icon: '🌲', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'mahogany_tree', color: '#2e7d32', count: 3, strategy: new SprayBrush(engine), brushSize: 20 }),

    new BrushTool({ id: 'spawn_berries', name: 'Berries', icon: '🍓', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'wild_berries', color: '#e91e63', count: 6, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_mushroom', name: 'Mushroom', icon: '🍄', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'wild_mushroom', color: '#d32f2f', count: 6, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_cactus', name: 'Cactus', icon: '🌵', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'cactus', color: '#4caf50', count: 4, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_kelp', name: 'Kelp', icon: '🌿', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'deep_sea_kelp', color: '#004d40', count: 10, strategy: new SprayBrush(engine), brushSize: 25 }),
    new BrushTool({ id: 'spawn_seaweed', name: 'Seaweed', icon: '🍃', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'seaweed', color: '#1de9b6', count: 10, strategy: new SprayBrush(engine), brushSize: 25 }),
    new BrushTool({ id: 'spawn_lotus', name: 'Lotus', icon: '🪷', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'lotus', color: '#f06292', count: 5, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_reed', name: 'Reed', icon: '🎋', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'reed', color: '#aed581', count: 8, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_snow_flower', name: 'Snow Flower', icon: '❄️', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'snow_flower', color: '#e3f2fd', count: 8, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_medicinal', name: 'Herb', icon: '🌿', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'medicinal_herb', color: '#81c784', count: 6, strategy: new SprayBrush(engine), brushSize: 15 }),

    // ⛏️ Resources (전략 패턴 적용: SprayBrush)
    new BrushTool({ id: 'spawn_stone', name: 'Stone', icon: '🪨', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'stone', color: '#9e9e9e', count: 5, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_coal', name: 'Coal', icon: '⬛', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'coal', color: '#212121', count: 8, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_iron', name: 'Iron', icon: '⛓️', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'iron_ore', color: '#757575', count: 6, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_copper', name: 'Copper', icon: '🟠', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'surface_copper', color: '#d84315', count: 6, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_gold', name: 'Gold', icon: '🟡', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'gold_ore', color: '#fbc02d', count: 4, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_silver', name: 'Silver', icon: '⚪', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'silver_ore', color: '#b0bec5', count: 4, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_gems', name: 'Gems', icon: '💎', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'gems', color: '#00bcd4', count: 2, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_obsidian', name: 'Obsidian', icon: '🖤', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'obsidian', color: '#263238', count: 4, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_clay', name: 'Clay', icon: '🏺', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'clay', color: '#a1887f', count: 8, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_flint', name: 'Flint', icon: '🔪', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'flint', color: '#546e7a', count: 8, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_salt', name: 'Salt', icon: '🧂', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'salt', color: '#ffffff', count: 10, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_mud', name: 'Mud', icon: '🥣', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'mud', color: '#5d4037', count: 12, strategy: new SprayBrush(engine), brushSize: 20 }),
    new BrushTool({ id: 'spawn_sand_res', name: 'Sand', icon: '⏳', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'sand', color: '#ffe082', count: 15, strategy: new SprayBrush(engine), brushSize: 25 }),
    new BrushTool({ id: 'spawn_meat', name: 'Meat', icon: '🥩', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'meat', color: '#ef5350', count: 5, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_milk', name: 'Milk', icon: '🥛', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'milk', color: '#ffffff', count: 5, strategy: new SprayBrush(engine), brushSize: 15 }),
    new BrushTool({ id: 'spawn_poop', name: 'Poop', icon: '💩', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'poop', color: '#795548', count: 5, strategy: new SprayBrush(engine), brushSize: 15 }),

    // 🐑 Life (Creatures)
    new SpawnTool({ id: 'spawn_sheep', name: 'Sheep', icon: '🐑', category: 'Life', spawnMethod: 'spawnSheep' }),
    new SpawnTool({ id: 'spawn_cow', name: 'Cow', icon: '🐄', category: 'Life', spawnMethod: 'spawnCow' }),
    new SpawnTool({ id: 'spawn_human', name: 'Human', icon: '👤', category: 'Life', spawnMethod: 'spawnHuman' }),
    new SpawnTool({ id: 'spawn_wolf', name: 'Wolf', icon: '🐺', category: 'Life', spawnMethod: 'spawnWolf' }),
    new SpawnTool({ id: 'spawn_hyena', name: 'Hyena', icon: '🐾', category: 'Life', spawnMethod: 'spawnHyena' }),
    new SpawnTool({ id: 'spawn_wild_dog', name: 'Wild Dog', icon: '🐕', category: 'Life', spawnMethod: 'spawnWildDog' }),
    
    // 🦁 Predators
    new SpawnTool({ id: 'spawn_tiger', name: 'Tiger', icon: '🐅', category: 'Life', spawnMethod: 'spawnTiger' }),
    new SpawnTool({ id: 'spawn_lion', name: 'Lion', icon: '🦁', category: 'Life', spawnMethod: 'spawnLion' }),
    new SpawnTool({ id: 'spawn_bear', name: 'Bear', icon: '🐻', category: 'Life', spawnMethod: 'spawnBear' }),
    new SpawnTool({ id: 'spawn_fox', name: 'Fox', icon: '🦊', category: 'Life', spawnMethod: 'spawnFox' }),
    new SpawnTool({ id: 'spawn_crocodile', name: 'Crocodile', icon: '🐊', category: 'Life', spawnMethod: 'spawnCrocodile' }),

    // 🦌 Herbivores
    new SpawnTool({ id: 'spawn_deer', name: 'Deer', icon: '🦌', category: 'Life', spawnMethod: 'spawnDeer' }),
    new SpawnTool({ id: 'spawn_rabbit', name: 'Rabbit', icon: '🐇', category: 'Life', spawnMethod: 'spawnRabbit' }),
    new SpawnTool({ id: 'spawn_horse', name: 'Horse', icon: '🐎', category: 'Life', spawnMethod: 'spawnHorse' }),
    new SpawnTool({ id: 'spawn_elephant', name: 'Elephant', icon: '🐘', category: 'Life', spawnMethod: 'spawnElephant' }),
    new SpawnTool({ id: 'spawn_goat', name: 'Goat', icon: '🐐', category: 'Life', spawnMethod: 'spawnGoat' }),
    
    // 🏘️ Civilization (Buildings)
    new BuildTool({ id: 'build_house', name: 'Wood House', icon: '🏠', category: 'Civilization', buildingType: 'house' }),
    new BuildTool({ id: 'build_fence', name: 'Fence', icon: '🚧', category: 'Civilization', buildingType: 'fence' }),
    new BuildTool({ id: 'build_gate', name: 'Fence Gate', icon: '🚪', category: 'Civilization', buildingType: 'fence_gate' }),

    // 👁️ View (Filters)
    new ToggleTool({ id: 'view_wind', name: 'Wind View', icon: '🌬️', category: 'View', flagName: 'wind' }),
    new ToggleTool({ id: 'view_fertility', name: 'Fertility View', icon: '💎', category: 'View', flagName: 'fertility' }),
    new ToggleTool({ id: 'view_fertility_value', name: 'Fertility Info', icon: '🔢', category: 'View', flagName: 'fertilityValue' }),
    new ToggleTool({ id: 'view_water', name: 'Water Quality', icon: '🌊', category: 'View', flagName: 'water' }),
    new ToggleTool({ id: 'view_mineral', name: 'Mineral Density', icon: '⛏️', category: 'View', flagName: 'mineral' }),
    new ToggleTool({ id: 'view_xray', name: 'X-Ray View', icon: '👁️', category: 'View', flagName: 'xray' }),
    new ToggleTool({ id: 'view_debug_ai', name: 'AI Paths', icon: '🛣️', category: 'View', flagName: 'debugAI' }),
    new ToggleTool({ id: 'view_showNames', name: 'Show Names', icon: '🏷️', category: 'View', flagName: 'showNames' }),
    new ToggleTool({ id: 'view_village', name: 'Village Info', icon: '🏘️', category: 'View', flagName: 'village' }),
    new ToggleTool({ id: 'view_zone', name: 'Zone View', icon: '🗺️', category: 'View', flagName: 'zone' }),
    new InspectTool()


];