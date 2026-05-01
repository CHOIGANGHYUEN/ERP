import { AnimalStates } from '../../components/behavior/State.js';
import { AnimalRenders } from '../../objects/renders/AnimalRenders.js';
import { NatureRenders } from '../../objects/renders/NatureRenders.js';
import { TreeRenderer } from '../../objects/renders/nature/TreeRenderer.js';

/**
 * 🎨 EntityRenderer (Refactored)
 * 월드 내의 모든 개체와 파티클 렌더링을 총괄하는 코디네이터입니다.
 * 실제 그리기는 ResourceRenders와 AnimalRenders로 위임합니다.
 */
export default class EntityRenderer {
    constructor(engine) {
        this.engine = engine;
        this.spriteCache = new Map(); // 🚀 High-speed Sprite Buffer
    }

    /** 메인 렌더링 루프 */
    render(ctx, entityManager, particles, time, wind) {
        const camera = this.engine.camera;
        if (!camera || !this.engine.spatialHash) return;

        // 1. 🚀 [Viewport Culling] 카메라 시야 영역 내의 개체만 SpatialHash로 쿼리
        const margin = 50;
        const viewX = camera.x - margin;
        const viewY = camera.y - margin;
        const viewW = (camera.width / camera.zoom) + (margin * 2);
        const viewH = (camera.height / camera.zoom) + (margin * 2);

        const visibleIds = this.engine.spatialHash.queryRect(viewX, viewY, viewW, viewH);
        
        // 🧹 [Memory Management] 60초마다 모든 스프라이트 캐시 정리 (누수 방지)
        if (time % 60000 < 20) {
            this.spriteCache.clear();
            AnimalRenders.clearCache();
        }

        // 2. 🚀 [Y-Sorting] 쿼리된 엔티티 수집 및 정렬
        const renderList = [];
        const processedIds = new Set(); // 중복 방지 (SpatialHash 셀 경계 중복 가능성)

        for (const id of visibleIds) {
            if (processedIds.has(id)) continue;
            processedIds.add(id);

            const entity = entityManager.entities.get(id);
            if (!entity) continue;

            const t = entity.components.get('Transform');
            const v = entity.components.get('Visual');
            if (!t || !v) continue;

            // 정밀 컬링 (SpatialHash는 셀 단위이므로 한 번 더 체크)
            if (t.x < viewX || t.x > viewX + viewW || t.y < viewY || t.y > viewY + viewH) continue;

            renderList.push({ id, entity, t, v, y: t.y });
        }

        // 화면에 보이는 소수의 개체만 정렬하므로 매우 빠름
        renderList.sort((a, b) => a.y - b.y);

        // 2. 정렬된 순서대로 그리기
        for (const item of renderList) {
            const { id, entity, t, v } = item;
            const state = entity.components.get('AIState');

            // --- [Selection Feedback] ---
            if (id === this.engine.selectedId) {
                this.renderSelectionCircle(ctx, t);
            }

            // --- 🚀 [Drawing Delegation] ---
            const isHighDetail = camera.zoom > 1.5;
            const type = v.type;
            // 🐾 Animal 컴포넌트가 있거나 명시된 동물 타입인 경우 Animal 렌더러 사용
            const isAnimal = entity.components.has('Animal') || 
                             ['animal', 'human', 'sheep', 'cow', 'wolf', 'hyena', 'wild_dog', 'bee'].includes(type);

            if (isAnimal) {
                this.renderAnimal(entity, ctx, time, isHighDetail);
                if (this.engine.viewFlags.debugAI && camera.zoom > 0.8 && state) {
                    this.renderAIDebug(ctx, t, state, id);
                }
            } else {
                this.renderResource(entity, ctx, time, wind);
            }
        }

        // 2. 파티클(Particle) 렌더링 (최상단 레이어)
        this.renderParticles(ctx, particles);
    }

    /** 🌿 환경 자원 렌더링 조율 */
    renderResource(entity, ctx, time, wind) {
        const t = entity.components.get('Transform');
        const v = entity.components.get('Visual');
        if (!t || !v) return;

        ctx.save();
        ctx.translate(Math.floor(t.x), Math.floor(t.y));
        
        // 🌚 [Universal Shadow] 모든 자원에 지면 그림자 적용
        ctx.beginPath();
        const shadowW = v.type === 'tree' ? 6 : 4;
        const shadowH = v.type === 'tree' ? 3 : 2;
        ctx.ellipse(0, 0, shadowW, shadowH, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        // 🚀 [Drawing Delegation]
        if (v.type === 'tree') {
            ctx.restore(); // Shadow용 translate 복구 후 전용 메서드로 위임 (내부에서 다시 save함)
            this.drawTreeCached(ctx, t, v, entity, time, wind);
        } else {
            NatureRenders.render(ctx, v.type, t, v, time, wind);
            ctx.restore();
        }
    }

    /** 🌲 나무 캐싱 및 렌더링 */
    drawTreeCached(ctx, t, v, entity, time, wind) {
        const size = v.size || 15;
        const isWithered = v.isWithered || false;
        const color = isWithered ? '#795548' : (v.color || '#2e7d32');
        const isXRay = this.engine.viewFlags.xray || false;
        const key = `tree_${size}_${color}_${isWithered}_${v.subtype || 'normal'}_${isXRay}`;

        const sprite = this.getSprite(key, (sCtx) => {
            TreeRenderer.draw(sCtx, t, v, size, isWithered, time, wind, isXRay, entity);
        }, size * 4, size * 5);

        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };
        const swayAmount = isWithered ? 0.2 : 1.0;
        const osc = Math.sin(time * 0.002 + t.x * 0.05) * (size * 0.1);
        const totalSway = (wv.x * 3 + osc) * swayAmount;
        
        ctx.save();
        ctx.translate(Math.floor(t.x), Math.floor(t.y));
        const shear = totalSway / size;
        ctx.transform(1, 0, shear, 1, 0, 0);
        ctx.drawImage(sprite, -sprite.width / 2, -sprite.height + 2);
        ctx.restore();
    }

    /** 🐾 동물 및 인간 렌더링 */
    renderAnimal(entity, ctx, time, isHighDetail) {
        // AnimalRenders 내부에서 진짜 도트(Pixel-Perfect) 스프라이트를 생성하여 직접 그립니다.
        AnimalRenders.drawAnimalBody(ctx, entity, time);
    }

    /** 🚀 SPRITE CACHING SYSTEM */
    getSprite(key, drawFn, width, height) {
        if (this.spriteCache.has(key)) return this.spriteCache.get(key);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const sCtx = canvas.getContext('2d');
        
        sCtx.translate(width / 2, height - 5); 
        drawFn(sCtx);

        this.spriteCache.set(key, canvas);
        return canvas;
    }

    /** 파티클 렌더링 */
    renderParticles(ctx, particles) {
        for (const p of particles) {
            ctx.save();
            ctx.globalAlpha = p.alpha !== undefined ? p.alpha : 1.0;
            ctx.fillStyle = p.color;

            if (p.type === 'ZZZ') {
                ctx.font = `${p.size}px Arial`;
                ctx.fillText(p.text, p.x, p.y);
            } else if (p.type === 'DUST') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'BLOOD') {
                ctx.fillRect(p.x, p.y, p.size, p.size);
            } else {
                const s = p.size || 1.5;
                ctx.fillRect(p.x, p.y, s, s);
            }
            ctx.restore();
        }
    }

    /** 선택 원 렌더링 */
    renderSelectionCircle(ctx, t) {
        ctx.save();
        ctx.beginPath(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 2;
        ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }

    /** AI 디버그 정보 렌더링 */
    renderAIDebug(ctx, t, state, id) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 8px Inter, Arial';
        ctx.textAlign = 'center';
        ctx.fillText(state.mode.toUpperCase(), t.x, t.y - 12);

        if (state.targetId) {
            const target = this.engine.entityManager.entities.get(state.targetId);
            if (target) {
                const targetPos = target.components.get('Transform');
                if (targetPos) {
                    ctx.beginPath(); ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.moveTo(t.x, t.y); ctx.lineTo(targetPos.x, targetPos.y); ctx.stroke();
                }
            }
        }
        ctx.restore();
    }

    /** 기본 폴백 렌더링 */
    drawResourceFallback(ctx, t, v) {
        ctx.fillStyle = v.color || '#ffffff';
        const s = v.size || 0.8;
        ctx.fillRect(t.x - s/2, t.y - s/2, s, s);
    }
}