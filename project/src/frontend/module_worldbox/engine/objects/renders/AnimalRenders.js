import { AnimalStates } from '../../components/behavior/State.js';
import { SheepRenderer } from './animals/SheepRenderer.js';
import { CowRenderer } from './animals/CowRenderer.js';
import { WolfRenderer } from './animals/WolfRenderer.js';
import { WildDogRenderer } from './animals/WildDogRenderer.js';
import { HyenaRenderer } from './animals/HyenaRenderer.js';
import { HumanRenderer } from './animals/HumanRenderer.js';
import { BeeRenderer } from './animals/BeeRenderer.js';

/**
 * 🎨 AnimalRenders Module (Advanced Animation Engine)
 */
export const AnimalRenders = {
    spriteCache: new Map(),

    getSprite(type, mode, frameIdx, color, options = {}) {
        // 프레임 인덱스를 4단계로 고정하여 캐시 효율 증대
        const animFrame = Math.floor(frameIdx % 4);
        const role = options.role || 'worker';
        const key = `${type}_${mode}_${animFrame}_${color}_${role}`;
        if (this.spriteCache.has(key)) return this.spriteCache.get(key);

        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.translate(16, 24);
        
        const s = 1;
        switch (type) {
            case 'sheep': SheepRenderer.draw(ctx, frameIdx, s, mode); break;
            case 'cow': CowRenderer.draw(ctx, frameIdx, s, mode); break;
            case 'wolf': WolfRenderer.draw(ctx, frameIdx, s, mode); break;
            case 'wild_dog': WildDogRenderer.draw(ctx, frameIdx, s, mode); break;
            case 'hyena': HyenaRenderer.draw(ctx, frameIdx, s, mode); break;
            case 'human': HumanRenderer.draw(ctx, frameIdx, s, mode); break;
            case 'bee': BeeRenderer.draw(ctx, frameIdx, s, mode, options.entity); break;
        }

        this.spriteCache.set(key, canvas);
        return canvas;
    },

    drawAnimalBody(ctx, entity, time) {
        const transform = entity.components.get('Transform');
        const visual = entity.components.get('Visual');
        const state = entity.components.get('AIState');
        if (!transform || !visual || !state) return;

        const mode = state.mode;
        const type = visual.type;
        
        // 상태별 애니메이션 속도 차등 적용
        let speedMult = 0.008;
        if (mode === AnimalStates.RUN || mode === AnimalStates.HUNT) speedMult = 0.015;
        else if (mode === AnimalStates.SLEEP) speedMult = 0.002;
        const frameIdx = (time * speedMult);
        const options = { role: animal?.role, entity: entity };
        const sprite = this.getSprite(type, mode, frameIdx, visual.color, options);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(transform.x, transform.y);
        if (visual.flipX) ctx.scale(-1, 1);

        // 🚀 고도화된 상태별 물리 변환 적용
        this.applyAdvancedStateMotion(ctx, type, mode, time);

        const displaySize = visual.size * 22; 
        ctx.drawImage(sprite, -16 * (displaySize / 32), -24 * (displaySize / 32), displaySize, displaySize);
        ctx.restore();
    },

    /**
     * 🌀 물리 기반 상태별 모션 변환 (Breathing, Swaying, Chewing)
     */
    applyAdvancedStateMotion(ctx, type, mode, time) {
        // 1. 공통 사망 처리
        if (mode === AnimalStates.DIE) {
            ctx.filter = 'grayscale(100%) brightness(80%)';
            return;
        }

        // 2. 상태별 공통 물리 효과
        switch (mode) {
            case AnimalStates.SLEEP:
                // 💤 수면: 느린 호흡 (상하 스케일링)
                const sleepBreath = Math.sin(time * 0.002) * 0.03;
                ctx.scale(1, 1 + sleepBreath);
                break;

            case AnimalStates.EAT:
            case AnimalStates.FORAGE:
                // 🍎 식사: 머리를 위아래로 흔드는 저작 운동 (번역: translate)
                const chew = Math.abs(Math.sin(time * 0.01)) * 1.2;
                ctx.translate(0, chew);
                break;

            case AnimalStates.RUN:
            case AnimalStates.HUNT:
            case AnimalStates.FLEE:
                // ⚡ 질주: 몸체를 앞으로 기울임 (역동성 강조)
                ctx.rotate(0.08);
                ctx.translate(0, Math.sin(time * 0.02) * 1.5); // 상하 요동 증가
                break;

            case AnimalStates.WALK:
                // 🚶 보행: 일정한 리듬의 상하 바운스
                ctx.translate(0, Math.sin(time * 0.01) * 0.8);
                break;

            default:
                // 🧘 대기: 미세한 대기 호흡
                const idleBreath = Math.sin(time * 0.003) * 0.015;
                ctx.scale(1 + idleBreath, 1 - idleBreath);
                break;
        }

        // 3. 종별 특수 모션 추가 (필요시)
        if (type === 'sheep' && mode === AnimalStates.WALK) {
            ctx.rotate(Math.sin(time * 0.01) * 0.05); // 양 특유의 뒤뚱거림
        }
    },

    drawSheep() {}, drawCow() {}, drawWolf() {}, drawWildDog() {}, drawHyena() {}, drawHuman() {}, drawPredator() {}
};
