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
        const hasHoney = options.nectar > 5 ? 'H' : 'N';
        const gender = options.entity?.components.get('Animal')?.gender || 'male';
        const key = `${type}_${mode}_${animFrame}_${color}_${role}_${hasHoney}_${gender}`;
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
            case 'human': HumanRenderer.draw(ctx, frameIdx, s, mode, options.entity); break;
            case 'bee': BeeRenderer.draw(ctx, frameIdx, s, mode, options.entity); break;
        }

        this.spriteCache.set(key, canvas);
        return canvas;
    },

    /**
     * 🧹 [Memory Management] 주기적으로 캐시를 비워 메모리 누수를 방지합니다.
     */
    clearCache() {
        this.spriteCache.clear();
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

        // 🚀 고도화된 상태별 물리 변환 적용
        this.applyAdvancedStateMotion(ctx, type, mode, time, entity);

        // 👤 인간: 스프라이트 캐시 우회 — 연속 time 기반 직접 렌더링
        if (type === 'human') {
            const displaySize = visual.size * 22;
            const scale = displaySize / 32;
            ctx.save();
            // flipX 반전은 이미 위에서 ctx.scale(-1,1) 적용됨
            // HumanRenderer 내부 기준점(16,24) 보정
            ctx.translate(-16 * scale, -24 * scale);
            ctx.scale(scale, scale);
            ctx.translate(16, 24);
            HumanRenderer.draw(ctx, time, 1, mode, entity);
            ctx.restore();
            ctx.restore();
            return;
        }

        // 기타 동물: 기존 스프라이트 캐시 사용
        let speedMult = 0.008;
        if (mode === AnimalStates.RUN || mode === AnimalStates.HUNT) speedMult = 0.015;
        else if (mode === AnimalStates.SLEEP) speedMult = 0.002;
        const frameIdx = time * speedMult;
        const options = { role: animal?.role, entity: entity, nectar: animal?.nectar };
        const sprite = this.getSprite(type, mode, frameIdx, visual.color, options);
        const displaySize = visual.size * 22;
        ctx.drawImage(sprite, -16 * (displaySize / 32), -24 * (displaySize / 32), displaySize, displaySize);
        ctx.restore();
    },

    /**
     * 🌀 물리 기반 상태별 모션 변환 (Breathing, Swaying, Chewing + Attack/Hit)
     */
    applyAdvancedStateMotion(ctx, type, mode, time, entity) {
        const visual = entity.components.get('Visual');
        if (!visual) return;

        // ⚔️ [Combat Motion] 공격 연출 (150ms 동안 앞으로 런지)
        if (visual.lastAttackTime && (time - visual.lastAttackTime) < 150) {
            const progress = (time - visual.lastAttackTime) / 150;
            const lunge = Math.sin(progress * Math.PI) * 10;
            ctx.translate(lunge, 0); // 전진 덮치기
            ctx.rotate(0.15 * Math.sin(progress * Math.PI)); // 약간의 고개 끄덕임
        }

        // 🩸 [Combat Motion] 피격 연출 (200ms 동안 붉은 점멸 및 진동)
        if (visual.lastHitTime && (time - visual.lastHitTime) < 200) {
            const hitProgress = (time - visual.lastHitTime) / 200;
            const shake = (1 - hitProgress) * 2.5;
            ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
            ctx.filter = `brightness(${100 + (1 - hitProgress) * 100}%) sepia(100%) saturate(500%) hue-rotate(-50deg)`;
        }

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
                // 🍎 식사: 머리를 위아래로 흔드는 저작 운동 (더 역동적으로 상향)
                const chew = Math.abs(Math.sin(time * 0.015)) * 3.5;
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

            case 'gather_wood': {
                // 🪓 도끼질: 상체를 앞으로 기울이고 충격 진동
                const aiState = entity?.components?.get?.('AIState');
                if (aiState?.isChopping) {
                    const chopPhase = Math.min(1, (aiState.chopTimer || 0) / 0.4);
                    ctx.rotate(0.12 * chopPhase);
                    ctx.translate(0, chopPhase * 2.0);
                } else {
                    ctx.rotate(0.04); // 이동 중 약간 기울임
                }
                break;
            }

            case 'build': {
                // 🔨 건설: 망치질 시 앞으로 숙임 + 충격 바운스
                const buildBob = Math.abs(Math.sin(time * 0.012)) * 2.5;
                ctx.translate(0, buildBob);
                ctx.rotate(0.06);
                break;
            }

            case 'deposit': {
                // 📦 창고 이동: 무게감으로 약간 앞으로 숙임
                ctx.rotate(0.07);
                const depositBob = Math.sin(time * 0.01) * 1.0;
                ctx.translate(0, depositBob);
                break;
            }

            case 'flee': {
                // 🏃 도주: 극단적으로 앞으로 기울임 + 빠른 진동
                ctx.rotate(0.22);
                ctx.translate(0, Math.sin(time * 0.025) * 2.0);
                break;
            }

            case 'berserk': {
                // 😡 광란: sin 기반 고주파 떨림 (random 아님 — 자연스럽게)
                const bShakeX = Math.sin(time * 0.019) * 1.2;
                const bShakeY = Math.sin(time * 0.023 + 1.0) * 1.0;
                ctx.translate(bShakeX, bShakeY);
                ctx.filter = 'brightness(125%) saturate(180%)';
                break;
            }

            case AnimalStates.HUNT: {
                // ⚔️ 추격: 강한 앞 기울임 + 빠른 바운스
                ctx.rotate(0.14);
                ctx.translate(0, Math.sin(time * 0.022) * 1.8);
                break;
            }

            default:
                // 🧘 대기: 미세한 호흡
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
