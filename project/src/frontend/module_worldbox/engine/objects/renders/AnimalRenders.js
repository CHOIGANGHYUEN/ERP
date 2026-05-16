import { AnimalStates } from '../../components/behavior/State.js';
import AnimalRenderRegistry from './AnimalRenderRegistry.js';
import MotionAnimator from '../../systems/render/animation/MotionAnimator.js';

/**
 * 🎨 AnimalRenders Module (Facade)
 * 동물 렌더링을 총괄하며, 레지스트리와 애니메이터를 통해 OCP와 SRP를 달성합니다.
 */
export const AnimalRenders = {
    spriteCache: new Map(),
    registry: new AnimalRenderRegistry(),

    getSprite(type, mode, frameIdx, color, options = {}) {
        const animFrame = Math.floor(frameIdx % 8);
        const role = options.role || 'worker';
        const hasHoney = options.nectar > 5 ? 'H' : 'N';
        const entity = options.entity;
        const animal = entity?.components.get('Animal');
        const visual = entity?.components.get('Visual');
        
        const facing = visual?.facing ?? 2;
        const inventory = entity?.components.get('Inventory');
        const hasWood = (inventory?.items?.wood || 0) > 0 ? 'W' : '_';
        const hasFood = (inventory?.items?.food || 0) > 0 ? 'F' : '_';
        const isBaby = visual?.isBaby ? 'B' : 'A';

        const key = `${type}_${mode}_${animFrame}_${color}_${role}_${hasHoney}_${animal?.gender || 'male'}_${facing}_${hasWood}${hasFood}_${isBaby}`;
        if (this.spriteCache.has(key)) return this.spriteCache.get(key);

        const canvas = document.createElement('canvas');
        canvas.width = 48; canvas.height = 48;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.translate(24, 36);
        
        const renderer = this.registry.getRenderer(type);
        if (renderer) {
            if (type === 'human') renderer.draw(ctx, animFrame * (1000/8), 1, mode, entity);
            else if (type === 'bee') renderer.draw(ctx, animFrame, 1, mode, entity);
            else renderer.draw(ctx, animFrame, 1, mode);
        }

        this.spriteCache.set(key, canvas);
        return canvas;
    },

    clearCache() { this.spriteCache.clear(); },

    /** 🚀 [Facade Delegates] 하위 호환성을 위해 MotionAnimator로 위임합니다. */
    applyAdvancedStateMotion(ctx, type, mode, time, entity) {
        MotionAnimator.applyAdvancedStateMotion(ctx, type, mode, time, entity);
    },

    applyImpactMotion(ctx, visual, time) {
        MotionAnimator.applyImpactMotion(ctx, visual, time);
    },

    applyDeathMotion(ctx, visual, mode, time) {
        return MotionAnimator.applyDeathMotion(ctx, visual, mode, time);
    },

    drawAnimalBody(ctx, entity, time) {
        const transform = entity.components.get('Transform');
        const visual = entity.components.get('Visual');
        const state = entity.components.get('AIState');
        const animal = entity.components.get('Animal');
        if (!transform || !visual || !state) return;

        const mode = state.mode;
        const type = visual.type;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(transform.x, transform.y);
        if (visual.flipX) ctx.scale(-1, 1);

        // 🚀 전문 애니메이터에게 물리 변환 위임
        MotionAnimator.applyAdvancedStateMotion(ctx, type, mode, time, entity);
        MotionAnimator.applyImpactMotion(ctx, visual, time);
        
        if (MotionAnimator.applyDeathMotion(ctx, visual, mode, time)) {
            ctx.restore();
            return;
        }

        const speedMult = (mode === AnimalStates.RUN || mode === AnimalStates.HUNT) ? 0.015 : (mode === AnimalStates.SLEEP ? 0.002 : 0.008);
        const sprite = this.getSprite(type, mode, time * speedMult, visual.color, { role: animal?.role, entity, nectar: animal?.nectar });
        const s = (visual.size * 22) / 32;
        ctx.drawImage(sprite, -24 * s, -36 * s, 48 * s, 48 * s);
        
        ctx.restore();
    }
};
