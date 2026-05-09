/**
 * 💎 RockRenderer — 다각형 기반의 입체적 암석 및 광석 렌더링
 * [Expert Design] 각진 면(Facet) 연출과 광석별 고유 광택 효과 적용
 */
import { textureManager } from "../../../systems/render/TextureManager.js";
export const RockRenderer = {
    draw(ctx, t, v, isWithered, entity, time) {
        const s = v.size || 15;
        const sub = v.subtype || 'stone';

        // 🤕 [Hit Shake]
        const health = entity?.components?.get('Health');
        if (health && health.hitTimer > 0) {
            ctx.translate(Math.sin(time * 0.15) * 2.5, 0);
        }

        let texKey = 'stone';
        if (sub.includes('gold')) texKey = 'gold_ore';
        else if (sub.includes('iron')) texKey = 'iron_ore';
        else if (sub.includes('coal')) texKey = 'coal_ore';
        else if (sub.includes('copper')) texKey = 'copper_ore';
        else if (sub.includes('silver')) texKey = 'silver_ore';

        const img = textureManager.getTexture(texKey);
        if (!img) return; // 🛡️ Safety check

        const scale = s / 15;
        const drawW = 32 * scale;
        const drawH = 32 * scale;

        ctx.drawImage(img, -drawW / 2, -drawH + (4 * scale), drawW, drawH);
    }
};

