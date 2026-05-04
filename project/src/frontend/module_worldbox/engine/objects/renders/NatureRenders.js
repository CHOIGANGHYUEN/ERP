import { TreeRenderer } from './nature/TreeRenderer.js';
import { GrassRenderer } from './nature/GrassRenderer.js';
import { FlowerRenderer } from './nature/FlowerRenderer.js';
import { WaterPlantRenderer } from './nature/WaterPlantRenderer.js';
import { RockRenderer } from './nature/RockRenderer.js';
import { PoopRenderer } from './nature/PoopRenderer.js';
import { MushroomRenderer } from './nature/MushroomRenderer.js';

/**
 * 🌲 NatureRenders (Advanced Nature Graphics Engine)
 * 환경 자원 및 식생 렌더링을 총괄하는 중앙 모듈입니다.
 */
export const NatureRenders = {
    render(ctx, type, t, v, time, wind, entity) {
        const isWithered = v.isWithered || false;

        switch (true) {
            case type.includes('tree'):
                TreeRenderer.draw(ctx, t, v, v.size || 15, isWithered, time, wind, entity);
                break;
            case (type === 'grass' || type === 'pasture_grass' || type === 'weeds'):
                GrassRenderer.draw(ctx, t, v, isWithered, time, wind, entity);
                break;
            case (type === 'flower' || type === 'wildflowers' || type === 'medicinal_herb' || type === 'snow_flower'):
                FlowerRenderer.draw(ctx, t, v, isWithered, time, wind, entity);
                break;
            case (type === 'poop'):
                PoopRenderer.draw(ctx, t, v, wind, entity);
                break;
            case (type === 'lotus'):
                WaterPlantRenderer.drawLotus(ctx, t, v, isWithered, wind, entity);
                break;
            case (['seaweed', 'deep_sea_kelp', 'waterweed', 'luminous_moss'].includes(type)):
                WaterPlantRenderer.drawKelp(ctx, t, v, time, isWithered, wind, entity);
                break;
            case (type === 'reed'):
                WaterPlantRenderer.drawReed(ctx, t, v, isWithered, time, wind, entity);
                break;
            case (['rock', 'ore', 'gems', 'stone', 'coal', 'iron', 'gold', 'silver', 'copper', 'obsidian', 'flint', 'salt', 'sandstone', 'deep_stone', 'manganese_nodule', 'mud', 'sand', 'clay', 'river_gravel'].includes(type)):
                RockRenderer.draw(ctx, t, v, isWithered, entity, time);
                break;
            case (type === 'mushroom' || type === 'wild_mushroom'):
                MushroomRenderer.draw(ctx, t, v, isWithered, time, wind, entity);
                break;
            case (type === 'cactus'):
                this.drawCactus(ctx, t, v, isWithered, wind, time, entity);
                break;
            case (type === 'bones'):
                this.drawBones(ctx, t, v, entity);
                break;
            case (type === 'meat' || type === 'milk'):
                this.drawFallback(ctx, t, v, entity);
                break;
            default:
                this.drawFallback(ctx, t, v, entity);
        }
    },

    drawCactus(ctx, t, v, isWithered, wind, time, entity) {
        const s = 1.2;
        const color = isWithered ? '#795548' : '#2e7d32';
        const dark = '#1b5e20';
        const light = '#81c784';
        
        // 🌬️ 바람 영향
        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };
        const swayX = isWithered ? 0 : wv.x * 2;

        // 🤕 [Hit Shake]
        const health = entity?.components?.get('Health');
        if (health && health.hitTimer > 0) {
            ctx.translate(Math.sin(time * 0.08) * 1.5, 0);
        }

        // 1. 메인 몸통
        ctx.fillStyle = color;
        ctx.fillRect(-1.5*s + swayX, -8*s, 3*s, 8*s);
        
        // 2. 가지 (Arms)
        ctx.fillRect(-4*s + swayX, -6*s, 3*s, 1.5*s); // 왼쪽 가지
        ctx.fillRect(-4*s + swayX, -7.5*s, 1.5*s, 1.5*s);
        
        ctx.fillRect(1*s + swayX, -5*s, 3*s, 1.5*s);  // 오른쪽 가지
        ctx.fillRect(2.5*s + swayX, -6.5*s, 1.5*s, 1.5*s);

        // 3. 가시 및 디테일 (Thorns)
        if (!isWithered) {
            ctx.fillStyle = light;
            ctx.fillRect(-s + swayX, -7*s, 0.5, 0.5);
            ctx.fillRect(s + swayX, -4*s, 0.5, 0.5);
            ctx.fillRect(-3*s + swayX, -7.5*s, 0.5, 0.5);
            
            ctx.fillStyle = dark;
            ctx.fillRect(-0.5*s + swayX, -2*s, 0.5, 0.5);
        }
    },

    drawBones(ctx, t, v) {
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(-2, -1, 4, 2);
    },

    drawFallback(ctx, t, v) {
        ctx.fillStyle = v.color || '#ffffff';
        ctx.fillRect(-1, -1, 2, 2);
    }
};
