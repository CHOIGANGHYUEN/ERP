import { TreeRenderer } from './nature/TreeRenderer.js';
import { GrassRenderer } from './nature/GrassRenderer.js';
import { FlowerRenderer } from './nature/FlowerRenderer.js';
import { WaterPlantRenderer } from './nature/WaterPlantRenderer.js';
import { RockRenderer } from './nature/RockRenderer.js';
import { PoopRenderer } from './nature/PoopRenderer.js';
import { MushroomRenderer } from './nature/MushroomRenderer.js';
import { CactusRenderer } from './strategies/nature/CactusRenderer.js';
import { BonesRenderer } from './strategies/nature/BonesRenderer.js';

/**
 * 🌲 NatureRenderRegistry
 * 식생 타입별 렌더링 전략을 관리하는 레지스트리입니다.
 * NatureRenders.js에서 OCP 준수를 위해 분리되었습니다.
 */
export default class NatureRenderRegistry {
    constructor() {
        this.strategies = new Map();
        this._initDefaultStrategies();
    }

    _initDefaultStrategies() {
        // Direct mappings
        this.strategies.set('grass', GrassRenderer);
        this.strategies.set('pasture_grass', GrassRenderer);
        this.strategies.set('weeds', GrassRenderer);
        
        this.strategies.set('flower', FlowerRenderer);
        this.strategies.set('wildflowers', FlowerRenderer);
        this.strategies.set('medicinal_herb', FlowerRenderer);
        this.strategies.set('snow_flower', FlowerRenderer);

        this.strategies.set('poop', PoopRenderer);
        this.strategies.set('mushroom', MushroomRenderer);
        this.strategies.set('wild_mushroom', MushroomRenderer);
        this.strategies.set('cactus', CactusRenderer);
        this.strategies.set('bones', BonesRenderer);

        // Water plants with different methods
        this.strategies.set('lotus', { draw: (ctx, t, v, isWithered, time, wind, entity) => WaterPlantRenderer.drawLotus(ctx, t, v, isWithered, wind, entity) });
        this.strategies.set('reed', { draw: (ctx, t, v, isWithered, time, wind, entity) => WaterPlantRenderer.drawReed(ctx, t, v, isWithered, time, wind, entity) });
        
        const kelpStrategy = { draw: (ctx, t, v, isWithered, time, wind, entity) => WaterPlantRenderer.drawKelp(ctx, t, v, time, isWithered, wind, entity) };
        ['seaweed', 'deep_sea_kelp', 'waterweed', 'luminous_moss'].forEach(type => this.strategies.set(type, kelpStrategy));

        // Rocks and minerals
        const rockStrategy = { draw: (ctx, t, v, isWithered, time, wind, entity) => RockRenderer.draw(ctx, t, v, isWithered, entity, time) };
        ['rock', 'ore', 'gems', 'stone', 'coal', 'iron', 'gold', 'silver', 'copper', 'obsidian', 'flint', 'salt', 'sandstone', 'deep_stone', 'manganese_nodule', 'mud', 'sand', 'clay', 'river_gravel'].forEach(type => this.strategies.set(type, rockStrategy));
    }

    getRenderer(type) {
        if (type.includes('tree')) return TreeRenderer;
        return this.strategies.get(type);
    }
}
