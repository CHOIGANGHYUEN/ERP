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
    constructor() { super({ id: 'move_hand', name: 'Move', icon: '🖐️', category: 'Earth' }); }
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

// 🚀 DI Config: 신규 도구 추가 시 이곳에 선언하기만 하면 전체 시스템이 자동으로 연동됨 (개방폐쇄 원칙)
export const DefaultTools = [
    new MoveTool(),
    new SprinkleTool({ id: 'paint_grass', name: 'Meadow', icon: '🌱', category: 'Earth', color: '#a8e063', biome: 'GRASS' }),
    new SprinkleTool({ id: 'paint_sand', name: 'Desert', icon: '🏜️', category: 'Earth', color: '#f4d03f', biome: 'SAND' }),
    new SprinkleTool({ id: 'paint_jungle', name: 'Jungle', icon: '🌳', category: 'Earth', color: '#2d5a27', biome: 'JUNGLE' }),
    new SprinkleTool({ id: 'paint_dirt', name: 'Dirt', icon: '🟫', category: 'Earth', color: '#8d6e63', biome: 'DIRT' }),
    new SprinkleTool({ id: 'add_water', name: 'Ocean', icon: '💧', category: 'Earth', color: '#3498db', biome: 'OCEAN' }),
    new SprinkleTool({ id: 'spawn_grass', name: 'Sprinkle Grass', icon: '🌾', category: 'Life', actionType: 'SPAWN_PLANT', color: '#c5e1a5', count: 12 }),
    new SprinkleTool({ id: 'spawn_flower', name: 'Flower', icon: '🌸', category: 'Life', actionType: 'SPAWN_FLOWER', color: '#ff80ab', count: 12 }),
    new SprinkleTool({ id: 'spawn_tree', name: 'Tree', icon: '🌲', category: 'Life', actionType: 'SPAWN_TREE', color: '#388e3c', count: 3, treeType: 'normal' }),
    new SprinkleTool({ id: 'spawn_fruit_tree', name: 'Fruit Tree', icon: '🍎', category: 'Life', actionType: 'SPAWN_TREE', color: '#689f38', count: 3, treeType: 'fruit' }),
    new SprinkleTool({ id: 'spawn_beehive_tree', name: 'Beehive Tree', icon: '🍯', category: 'Life', actionType: 'SPAWN_TREE', color: '#afb42b', count: 3, treeType: 'beehive' }),
    new SpawnTool({ id: 'spawn_sheep', name: 'Sheep', icon: '🐑', category: 'Life', spawnMethod: 'spawnSheep' }),
    new SpawnTool({ id: 'spawn_human', name: 'Human', icon: '👤', category: 'Life', spawnMethod: 'spawnHuman' }),
    new SpawnTool({ id: 'spawn_cow', name: 'Cow', icon: '🐄', category: 'Life', spawnMethod: 'spawnCow' }),
    new SpawnTool({ id: 'spawn_wolf', name: 'Wolf', icon: '🐺', category: 'Life', spawnMethod: 'spawnWolf' }),
    new SpawnTool({ id: 'spawn_hyena', name: 'Hyena', icon: '🐾', category: 'Life', spawnMethod: 'spawnHyena' }),
    new SpawnTool({ id: 'spawn_wild_dog', name: 'Wild Dog', icon: '🐕', category: 'Life', spawnMethod: 'spawnWildDog' }),
    new ToggleTool({ id: 'view_wind', name: 'Wind View', icon: '🌬️', category: 'View', flagName: 'wind' }),
    new ToggleTool({ id: 'view_fertility', name: 'Fertility View', icon: '💎', category: 'View', flagName: 'fertility' }),
    new ToggleTool({ id: 'view_water', name: 'Water Quality', icon: '🌊', category: 'View', flagName: 'water' }),
    new ToggleTool({ id: 'view_mineral', name: 'Mineral Density', icon: '⛏️', category: 'View', flagName: 'mineral' }),
    new ToggleTool({ id: 'view_xray', name: 'X-Ray View', icon: '👁️', category: 'View', flagName: 'xray' }),
    new InspectTool()
];