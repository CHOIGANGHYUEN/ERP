import { AnimalStates } from '../../components/behavior/State.js';
import { SheepRenderer } from './animals/SheepRenderer.js';
import { CowRenderer } from './animals/CowRenderer.js';
import { WolfRenderer } from './animals/WolfRenderer.js';
import { WildDogRenderer } from './animals/WildDogRenderer.js';
import { HyenaRenderer } from './animals/HyenaRenderer.js';
import { HumanRenderer } from './animals/HumanRenderer.js';
import { BeeRenderer } from './animals/BeeRenderer.js';

// 🦁 New Species
import { TigerRenderer } from './animals/TigerRenderer.js';
import { LionRenderer } from './animals/LionRenderer.js';
import { BearRenderer } from './animals/BearRenderer.js';
import { FoxRenderer } from './animals/FoxRenderer.js';
import { CrocodileRenderer } from './animals/CrocodileRenderer.js';
import { DeerRenderer } from './animals/DeerRenderer.js';
import { RabbitRenderer } from './animals/RabbitRenderer.js';
import { HorseRenderer } from './animals/HorseRenderer.js';
import { ElephantRenderer } from './animals/ElephantRenderer.js';
import { GoatRenderer } from './animals/GoatRenderer.js';

/**
 * 🎨 AnimalRenders Module (Advanced Animation Engine)
 */
export const AnimalRenders = {
    spriteCache: new Map(),

    getSprite(type, mode, frameIdx, color, options = {}) {
        // 🚀 프레임 인덱스를 8단계로 상향하여 더 부드러운 애니메이션 제공
        const animFrame = Math.floor(frameIdx % 8);
        const role = options.role || 'worker';
        const hasHoney = options.nectar > 5 ? 'H' : 'N';
        const entity = options.entity;
        const animal = entity?.components.get('Animal');
        const gender = animal?.gender || 'male';
        const visual = entity?.components.get('Visual');
        
        // 👤 인간 전용 추가 속성 (방향 및 소지품)
        const facing = visual?.facing ?? 2;
        const inventory = entity?.components.get('Inventory');
        const hasWood = (inventory?.items?.wood || 0) > 0 ? 'W' : '_';
        const hasFood = (inventory?.items?.food || 0) > 0 ? 'F' : '_';
        const isBaby = visual?.isBaby ? 'B' : 'A';

        const key = `${type}_${mode}_${animFrame}_${color}_${role}_${hasHoney}_${gender}_${facing}_${hasWood}${hasFood}_${isBaby}`;
        if (this.spriteCache.has(key)) return this.spriteCache.get(key);

        const canvas = document.createElement('canvas');
        // 인간 렌더러의 도구/무기 범위를 고려하여 캔버스 크기 상향
        canvas.width = 48; canvas.height = 48;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.translate(24, 36); // 중심점 조정
        
        const s = 1;
        // 캐시용 frameIdx 재계산 (0~8 범위로 정규화)
        const cachedTime = animFrame * (1000 / 8); 

        switch (type) {
            case 'sheep': SheepRenderer.draw(ctx, animFrame, s, mode); break;
            case 'cow': CowRenderer.draw(ctx, animFrame, s, mode); break;
            case 'wolf': WolfRenderer.draw(ctx, animFrame, s, mode); break;
            case 'wild_dog': WildDogRenderer.draw(ctx, animFrame, s, mode); break;
            case 'hyena': HyenaRenderer.draw(ctx, animFrame, s, mode); break;
            case 'human': HumanRenderer.draw(ctx, cachedTime, s, mode, entity); break;
            case 'bee': BeeRenderer.draw(ctx, animFrame, s, mode, entity); break;
            
            // 🦁 Carnivores
            case 'tiger': TigerRenderer.draw(ctx, animFrame, s, mode); break;
            case 'lion': LionRenderer.draw(ctx, animFrame, s, mode); break;
            case 'bear': BearRenderer.draw(ctx, animFrame, s, mode); break;
            case 'fox': FoxRenderer.draw(ctx, animFrame, s, mode); break;
            case 'crocodile': CrocodileRenderer.draw(ctx, animFrame, s, mode); break;

            // 🦌 Herbivores
            case 'deer': DeerRenderer.draw(ctx, animFrame, s, mode); break;
            case 'rabbit': RabbitRenderer.draw(ctx, animFrame, s, mode); break;
            case 'horse': HorseRenderer.draw(ctx, animFrame, s, mode); break;
            case 'elephant': ElephantRenderer.draw(ctx, animFrame, s, mode); break;
            case 'goat': GoatRenderer.draw(ctx, animFrame, s, mode); break;
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

        // 💀 사망 애니메이션 (회전하며 작아짐)
        if (mode === AnimalStates.DIE) {
            const dieTime = visual.lastDeathTime ? (time - visual.lastDeathTime) : 0;
            const progress = Math.min(1.0, dieTime / 1000); // 1초간 진행
            ctx.rotate(progress * Math.PI * 2);
            ctx.scale(1 - progress, 1 - progress);
            ctx.globalAlpha = 1 - progress;
            if (progress >= 1.0) {
                ctx.restore();
                return;
            }
        }

        // ⚡ [Expert Optimization] 모든 개체(인간 포함) 스프라이트 캐시 사용
        let speedMult = 0.008;
        if (mode === AnimalStates.RUN || mode === AnimalStates.HUNT) speedMult = 0.015;
        else if (mode === AnimalStates.SLEEP) speedMult = 0.002;
        
        const frameIdx = time * speedMult;
        const options = { role: animal?.role, entity: entity, nectar: animal?.nectar };
        
        const sprite = this.getSprite(type, mode, frameIdx, visual.color, options);
        const displaySize = visual.size * 22;
        
        // 캔버스 크기(48x48)를 고려한 중앙 정렬 출력
        const s = displaySize / 32;
        ctx.drawImage(sprite, -24 * s, -36 * s, 48 * s, 48 * s);
        
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
            const lunge = Math.sin(progress * Math.PI) * 12;
            ctx.translate(lunge, -Math.sin(progress * Math.PI) * 4); // 점프하며 덮치기
            ctx.rotate(0.2 * Math.sin(progress * Math.PI)); 
        }

        // 🩸 [Combat Motion] 피격 연출 (200ms 동안 붉은 점멸 및 진동)
        if (visual.lastHitTime && (time - visual.lastHitTime) < 200) {
            const hitProgress = (time - visual.lastHitTime) / 200;
            const shake = (1 - hitProgress) * 4;
            ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }

        // 1. 공통 사망 처리 (필터링만 수행, 변환은 drawAnimalBody에서)
        if (mode === AnimalStates.DIE) {
            ctx.filter = 'grayscale(80%) brightness(120%)';
            return;
        }

        // 2. 상태별 공통 물리 효과 (더 역동적인 수치로 조정)
        switch (mode) {
            case AnimalStates.SLEEP:
                const sleepBreath = Math.sin(time * 0.002) * 0.04;
                ctx.scale(1.02, 0.96 + sleepBreath);
                break;

            case AnimalStates.EAT:
            case AnimalStates.FORAGE:
                const chew = Math.abs(Math.sin(time * 0.015)) * 4.5;
                ctx.translate(0, chew);
                ctx.rotate(Math.sin(time * 0.015) * 0.1);
                break;

            case AnimalStates.RUN:
            case AnimalStates.HUNT:
            case AnimalStates.FLEE:
                ctx.rotate(0.12);
                ctx.translate(0, Math.sin(time * 0.025) * 2.5); // 고주파 바운스
                ctx.scale(1.1, 0.9); // 압축 효과
                break;

            case AnimalStates.WALK:
                ctx.translate(0, Math.sin(time * 0.012) * 1.2);
                ctx.rotate(Math.sin(time * 0.01) * 0.03);
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
