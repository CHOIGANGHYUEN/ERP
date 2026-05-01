import { BIOME_NAMES_TO_IDS } from '../world/TerrainGen.js';

// 🛠️ Base Tool Interface
export class Tool {
    constructor({ id, name, icon, category }) {
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.category = category;
    }
    get isInstant() { return false; }
    get isBrush() { return false; }

    execute() { return null; }
    onMouseDown(worldPos, e) { return null; }
    onMouseMove(worldPos, e) { return null; }
    onMouseUp(e) { return null; }
}

export class MoveTool extends Tool {
    constructor() { super({ id: 'move_hand', name: 'Move', icon: '🖐️', category: 'Landscape' }); }
    onMouseDown(worldPos, e) { return { type: 'CAMERA_DOWN', event: e }; }
    onMouseMove(worldPos, e) { return { type: 'CAMERA_MOVE', event: e }; }
    onMouseUp(e) { return { type: 'CAMERA_UP' }; }
}

export class SprinkleTool extends Tool {
    constructor(config) {
        super(config);
        this.actionType = config.actionType || 'CHANGE_BIOME';
        this.biome = config.biome;
        this.color = config.color || '#ffffff';
        this.count = config.count || 8;
        this.config = config;
        this.isPainting = false;
    }
    get isBrush() { return true; }

    createAction(worldPos) {
        return {
            type: 'SPAWN_PARTICLES',
            payload: {
                x: worldPos.x,
                y: worldPos.y,
                actionType: this.actionType,
                biome: this.biome ? BIOME_NAMES_TO_IDS.get(this.biome) : 0,
                resourceId: this.config.resourceId,
                color: this.color,
                count: this.count,
                treeType: this.config.treeType
            }
        };
    }

    onMouseDown(worldPos) {
        this.isPainting = true;
        return this.createAction(worldPos);
    }
    onMouseMove(worldPos) {
        if (this.isPainting) return this.createAction(worldPos);
        return null;
    }
    onMouseUp() {
        this.isPainting = false;
        return null;
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

export class ToggleTool extends Tool {
    constructor(config) {
        super(config);
        this.flagName = config.flagName;
    }
    get isInstant() { return true; }

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

export class FillTool extends Tool {
    constructor(config) {
        super(config);
        this.biome = config.biome;
    }
    get isInstant() { return true; }
    onMouseDown() {
        return { 
            type: 'APPLY_FILL_TOOL', 
            payload: { biome: BIOME_NAMES_TO_IDS.get(this.biome) } 
        };
    }
}

// 🚀 DI Config: 신규 도구 추가 시 이곳에 선언하기만 하면 전체 시스템이 자동으로 연동됨 (개방폐쇄 원칙)
export const DefaultTools = [
    new MoveTool(),
    
    // 🎨 Fill (Instant Whole-map actions)
    new FillTool({ id: 'fill_grass', name: 'Fill Meadow', icon: '🎨', category: 'Landscape', biome: 'GRASS' }),
    new FillTool({ id: 'fill_dirt', name: 'Fill Dirt', icon: '🧱', category: 'Landscape', biome: 'DIRT' }),
    
    // 🌍 Landscape (Biomes)
    new SprinkleTool({ id: 'paint_grass', name: 'Meadow', icon: '🌱', category: 'Landscape', color: '#a8e063', biome: 'GRASS' }),
    new SprinkleTool({ id: 'paint_jungle', name: 'Jungle', icon: '🌳', category: 'Landscape', color: '#2d5a27', biome: 'JUNGLE' }),
    new SprinkleTool({ id: 'paint_dirt', name: 'Dirt', icon: '🟫', category: 'Landscape', color: '#8d6e63', biome: 'DIRT' }),
    new SprinkleTool({ id: 'paint_sand', name: 'Desert', icon: '🏜️', category: 'Landscape', color: '#f4d03f', biome: 'SAND' }),
    new SprinkleTool({ id: 'paint_ocean', name: 'Ocean', icon: '💧', category: 'Landscape', color: '#3498db', biome: 'OCEAN' }),
    new SprinkleTool({ id: 'paint_deep_ocean', name: 'Deep Ocean', icon: '🌊', category: 'Landscape', color: '#1a5276', biome: 'DEEP_OCEAN' }),
    new SprinkleTool({ id: 'paint_lake', name: 'Lake', icon: '💎', category: 'Landscape', color: '#5dade2', biome: 'LAKE' }),
    new SprinkleTool({ id: 'paint_river', name: 'River', icon: '🏞️', category: 'Landscape', color: '#85c1e9', biome: 'RIVER' }),
    new SprinkleTool({ id: 'paint_low_mountain', name: 'Mountain', icon: '⛰️', category: 'Landscape', color: '#85929e', biome: 'LOW_MOUNTAIN' }),
    new SprinkleTool({ id: 'paint_high_mountain', name: 'High Peak', icon: '🏔️', category: 'Landscape', color: '#fdfefe', biome: 'HIGH_MOUNTAIN' }),
    
    // 🌱 Nature (Plants/Trees/Organic)
    new SingleSpawnTool({ id: 'single_tree_normal', name: 'Oak (1)', icon: '🌳', category: 'Nature', resourceId: 'oak_tree' }),
    new SingleSpawnTool({ id: 'single_fruit_tree', name: 'Fruit (1)', icon: '🍎', category: 'Nature', resourceId: 'tree_fruit' }),
    new SingleSpawnTool({ id: 'single_beehive_tree', name: 'Beehive (1)', icon: '🍯', category: 'Nature', resourceId: 'tree_beehive' }),

    new SprinkleTool({ id: 'spawn_grass', name: 'Grass', icon: '🌾', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'grass', color: '#c5e1a5', count: 12 }),
    new SprinkleTool({ id: 'spawn_flower', name: 'Flower', icon: '🌸', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'flower', color: '#ff80ab', count: 10 }),
    new SprinkleTool({ id: 'spawn_tree_normal', name: 'Oak Tree', icon: '🌳', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'oak_tree', color: '#388e3c', count: 3 }),
    new SprinkleTool({ id: 'spawn_fruit_tree', name: 'Fruit Tree', icon: '🍎', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'tree_fruit', color: '#689f38', count: 3 }),
    new SprinkleTool({ id: 'spawn_beehive_tree', name: 'Beehive Tree', icon: '🍯', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'tree_beehive', color: '#afb42b', count: 3 }),
    new SprinkleTool({ id: 'spawn_tropical', name: 'Jungle Tree', icon: '🌴', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'tropical_fruit_tree', color: '#1b5e20', count: 3 }),
    new SprinkleTool({ id: 'spawn_mahogany', name: 'Mahogany', icon: '🌲', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'mahogany_tree', color: '#2e7d32', count: 3 }),




    new SprinkleTool({ id: 'spawn_berries', name: 'Berries', icon: '🍓', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'wild_berries', color: '#e91e63', count: 6 }),
    new SprinkleTool({ id: 'spawn_mushroom', name: 'Mushroom', icon: '🍄', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'wild_mushroom', color: '#d32f2f', count: 6 }),
    new SprinkleTool({ id: 'spawn_cactus', name: 'Cactus', icon: '🌵', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'cactus', color: '#4caf50', count: 4 }),
    new SprinkleTool({ id: 'spawn_kelp', name: 'Kelp', icon: '🌿', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'deep_sea_kelp', color: '#004d40', count: 10 }),
    new SprinkleTool({ id: 'spawn_seaweed', name: 'Seaweed', icon: '🍃', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'seaweed', color: '#1de9b6', count: 10 }),
    new SprinkleTool({ id: 'spawn_lotus', name: 'Lotus', icon: '🪷', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'lotus', color: '#f06292', count: 5 }),
    new SprinkleTool({ id: 'spawn_reed', name: 'Reed', icon: '🎋', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'reed', color: '#aed581', count: 8 }),
    new SprinkleTool({ id: 'spawn_snow_flower', name: 'Snow Flower', icon: '❄️', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'snow_flower', color: '#e3f2fd', count: 8 }),
    new SprinkleTool({ id: 'spawn_medicinal', name: 'Herb', icon: '🌿', category: 'Nature', actionType: 'SPAWN_RESOURCE', resourceId: 'medicinal_herb', color: '#81c784', count: 6 }),

    // ⛏️ Resources (Minerals/Materials)
    new SprinkleTool({ id: 'spawn_stone', name: 'Stone', icon: '🪨', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'stone', color: '#9e9e9e', count: 5 }),
    new SprinkleTool({ id: 'spawn_coal', name: 'Coal', icon: '⬛', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'coal', color: '#212121', count: 8 }),
    new SprinkleTool({ id: 'spawn_iron', name: 'Iron', icon: '⛓️', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'iron_ore', color: '#757575', count: 6 }),
    new SprinkleTool({ id: 'spawn_copper', name: 'Copper', icon: '🟠', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'surface_copper', color: '#d84315', count: 6 }),
    new SprinkleTool({ id: 'spawn_gold', name: 'Gold', icon: '🟡', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'gold_ore', color: '#fbc02d', count: 4 }),
    new SprinkleTool({ id: 'spawn_silver', name: 'Silver', icon: '⚪', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'silver_ore', color: '#b0bec5', count: 4 }),
    new SprinkleTool({ id: 'spawn_gems', name: 'Gems', icon: '💎', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'gems', color: '#00bcd4', count: 2 }),
    new SprinkleTool({ id: 'spawn_obsidian', name: 'Obsidian', icon: '🖤', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'obsidian', color: '#263238', count: 4 }),
    new SprinkleTool({ id: 'spawn_clay', name: 'Clay', icon: '🏺', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'clay', color: '#a1887f', count: 8 }),
    new SprinkleTool({ id: 'spawn_flint', name: 'Flint', icon: '🔪', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'flint', color: '#546e7a', count: 8 }),
    new SprinkleTool({ id: 'spawn_salt', name: 'Salt', icon: '🧂', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'salt', color: '#ffffff', count: 10 }),
    new SprinkleTool({ id: 'spawn_mud', name: 'Mud', icon: '🥣', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'mud', color: '#5d4037', count: 12 }),
    new SprinkleTool({ id: 'spawn_sand_res', name: 'Sand', icon: '⏳', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'sand', color: '#ffe082', count: 15 }),
    new SprinkleTool({ id: 'spawn_meat', name: 'Meat', icon: '🥩', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'meat', color: '#ef5350', count: 5 }),
    new SprinkleTool({ id: 'spawn_milk', name: 'Milk', icon: '🥛', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'milk', color: '#ffffff', count: 5 }),
    new SprinkleTool({ id: 'spawn_poop', name: 'Poop', icon: '💩', category: 'Resources', actionType: 'SPAWN_RESOURCE', resourceId: 'poop', color: '#795548', count: 5 }),

    // 🐑 Life (Creatures)
    new SpawnTool({ id: 'spawn_sheep', name: 'Sheep', icon: '🐑', category: 'Life', spawnMethod: 'spawnSheep' }),
    new SpawnTool({ id: 'spawn_cow', name: 'Cow', icon: '🐄', category: 'Life', spawnMethod: 'spawnCow' }),
    new SpawnTool({ id: 'spawn_human', name: 'Human', icon: '👤', category: 'Life', spawnMethod: 'spawnHuman' }),
    new SpawnTool({ id: 'spawn_wolf', name: 'Wolf', icon: '🐺', category: 'Life', spawnMethod: 'spawnWolf' }),
    new SpawnTool({ id: 'spawn_hyena', name: 'Hyena', icon: '🐾', category: 'Life', spawnMethod: 'spawnHyena' }),
    new SpawnTool({ id: 'spawn_wild_dog', name: 'Wild Dog', icon: '🐕', category: 'Life', spawnMethod: 'spawnWildDog' }),
    
    // 👁️ View (Filters)
    new ToggleTool({ id: 'view_wind', name: 'Wind View', icon: '🌬️', category: 'View', flagName: 'wind' }),
    new ToggleTool({ id: 'view_fertility', name: 'Fertility View', icon: '💎', category: 'View', flagName: 'fertility' }),
    new ToggleTool({ id: 'view_fertility_value', name: 'Fertility Info', icon: '🔢', category: 'View', flagName: 'fertilityValue' }),
    new ToggleTool({ id: 'view_water', name: 'Water Quality', icon: '🌊', category: 'View', flagName: 'water' }),
    new ToggleTool({ id: 'view_mineral', name: 'Mineral Density', icon: '⛏️', category: 'View', flagName: 'mineral' }),
    new ToggleTool({ id: 'view_xray', name: 'X-Ray View', icon: '👁️', category: 'View', flagName: 'xray' }),
    new ToggleTool({ id: 'view_debug_ai', name: 'AI Paths', icon: '🛣️', category: 'View', flagName: 'debugAI' }),
    new InspectTool()


];