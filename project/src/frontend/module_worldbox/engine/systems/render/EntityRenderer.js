import { AnimalStates } from '../../components/behavior/State.js';
import { AnimalRenders } from '../../objects/renders/AnimalRenders.js';
import { NatureRenders } from '../../objects/renders/NatureRenders.js';
import { TreeRenderer } from '../../objects/renders/nature/TreeRenderer.js';
import { BuildRender } from '../../objects/renders/BuildRender.js';
import { ItemRenderer } from '../../objects/renders/ItemRenderer.js';

/**
 * 🎨 EntityRenderer
 * 월드 내의 모든 개체와 파티클 렌더링을 총괄하는 코디네이터입니다.
 */
export default class EntityRenderer {
    constructor(engine) {
        this.engine = engine;
        this.spriteCache = new Map(); 
    }

    /** 메인 렌더링 루프 */
    render(ctx, entityManager, particles, time, wind) {
        const camera = this.engine.camera;
        if (!camera || !this.engine.spatialHash) return;

        const margin = 50;
        const viewX = camera.x - margin;
        const viewY = camera.y - margin;
        const viewW = (camera.width / camera.zoom) + (margin * 2);
        const viewH = (camera.height / camera.zoom) + (margin * 2);

        const visibleIds = this.engine.spatialHash.queryRect(viewX, viewY, viewW, viewH);
        
        if (time % 60000 < 20) {
            this.spriteCache.clear();
            AnimalRenders.clearCache();
        }

        const renderList = [];
        const processedIds = new Set(); 

        for (const id of visibleIds) {
            if (processedIds.has(id)) continue;
            processedIds.add(id);

            const entity = entityManager.entities.get(id);
            if (!entity) continue;

            const t = entity.components.get('Transform');
            const v = entity.components.get('Visual');
            if (!t || !v) continue;

            if (t.x < viewX || t.x > viewX + viewW || t.y < viewY || t.y > viewY + viewH) continue;
            renderList.push({ id, entity, t, v, y: t.y });
        }

        renderList.sort((a, b) => a.y - b.y);
 
        // 🔒 [Debug] AIPATH 모드일 때 블랙리스트(도달 불가) 타겟 수집
        const blacklistedIds = new Set();
        if (this.engine.viewFlags.debugAI) {
            for (const ent of entityManager.entities.values()) {
                const ai = ent.components.get('AIState');
                if (ai && ai.unreachableTargets) {
                    for (const tid of ai.unreachableTargets) blacklistedIds.add(tid);
                }
            }
        }

        // 1. 🌑 [Unified Shadows] 모든 개체의 그림자를 먼저 렌더링 (Z-Order 최하단)
        for (const item of renderList) {
            this.renderShadow(ctx, item.t, item.v, item.entity, time);
        }

        // 2. 🌊 [Water Ripples] 물 위에 있는 개체들을 위한 파동 효과
        for (const item of renderList) {
            this.renderWaterRipples(ctx, item.t, item.entity, time);
        }

        // 3. 🎨 [Main Entities] 실제 개체 렌더링
        for (const item of renderList) {
            const { id, entity, t, v } = item;
            const state = entity.components.get('AIState');

            if (id === this.engine.selectedId) {
                this.renderSelectionCircle(ctx, t);
            }

            const isHighDetail = camera.zoom > 1.5;
            const type = v.type;
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

            // 🏥 [Health Integration] HP바 표시
            const health = entity.components.get('Health');
            if (health && health.currentHp < health.maxHp && health.currentHp > 0) {
                this.renderHealthBar(ctx, health, t, v.size || 10);
            }

            // 🔒 [Debug] 블랙리스트 타겟 표시
            if (this.engine.viewFlags.debugAI && blacklistedIds.has(id)) {
                ctx.save();
                ctx.font = '12px serif';
                ctx.textAlign = 'center';
                ctx.fillText('🔒', t.x, t.y - (v.size || 10) - 15);
                ctx.restore();
            }

            // 💕 [Reproduction] 번식 중 하트 아이콘 표시
            const social = entity.components.get('Social');
            if (social && social.isBreeding) {
                ctx.save();
                ctx.font = '14px serif';
                ctx.textAlign = 'center';
                // 하트가 위아래로 둥실거리는 효과
                const floatY = Math.sin(time * 0.005) * 5;
                ctx.fillText('❤️', t.x, t.y - (v.size || 10) - 20 + floatY);
                ctx.restore();
            }
        }

        this.renderParticles(ctx, particles);
    }

    /** 🌑 통합 그림자 렌더링 시스템 */
    renderShadow(ctx, t, v, entity, time) {
        const size = v.size || 10;
        const type = v.type;
        
        // 사망하거나 비주얼이 꺼져있으면 그림자 생략
        if (v.alpha === 0) return;

        ctx.save();
        ctx.translate(Math.floor(t.x), Math.floor(t.y));
        
        // 🌀 호흡/모션에 따른 동적 그림자 크기 변화
        let breathScale = 1.0;
        if (entity.components.has('Animal')) {
            breathScale = 1.0 + Math.sin(time * 0.003) * 0.05;
        }

        let sw = size * 0.8 * breathScale;
        let sh = size * 0.3 * breathScale;

        // 나무는 더 크고 진한 그림자
        if (type === 'tree') {
            sw *= 1.2;
            sh *= 1.2;
        }

        ctx.beginPath();
        ctx.ellipse(0, 1, sw, sh, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fill();
        ctx.restore();
    }

    /** 🌊 수면 파동 효과 (타일 기반 감지) */
    renderWaterRipples(ctx, t, entity, time) {
        if (!this.engine.terrainGen) return;
        
        const tx = Math.floor(t.x);
        const ty = Math.floor(t.y);
        const tile = this.engine.terrainGen.getTileAt?.(tx, ty);
        
        // 물 타일(Deep Water, Shallow Water)에서만 활성화
        if (tile === 0 || tile === 1) { 
            ctx.save();
            ctx.translate(tx, ty);
            const rippleScale = (Math.sin(time * 0.005 + t.x * 0.1) + 1) * 0.5;
            const alpha = 0.3 * (1 - rippleScale);
            
            ctx.beginPath();
            ctx.ellipse(0, 0, 8 * rippleScale, 3 * rippleScale, 0, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }
    }

    renderResource(entity, ctx, time, wind) {
        const t = entity.components.get('Transform');
        const v = entity.components.get('Visual');
        if (!t || !v) return;

        ctx.save();
        ctx.globalAlpha = v.alpha !== undefined ? v.alpha : 1.0;
        ctx.translate(Math.floor(t.x), Math.floor(t.y));
        
        const type = v.type;

        if (type === 'tree') {
            const res = entity.components.get('Resource');
            if (res && res.isFalling) {
                const FALL_DURATION = 0.8;
                res.fallProgress = Math.min(1.0, (res.fallProgress || 0) + (0.016 / FALL_DURATION));
                if (res.fallProgress >= 1.0) {
                    ctx.restore();
                    this.engine.entityManager.removeEntity(entity.id);
                    return;
                }
            }
            ctx.restore(); 
            this.drawTreeCached(ctx, t, v, entity, time, wind);
            return; // Already restored
        } else if (type === 'item') {
            const itemType = v.itemType;
            // 🎯 [Connection Fix] 데이터 연결을 위해 engine 인스턴스 전달
            ItemRenderer.render(ctx, itemType || 'unknown', v, time, entity, this.engine);
        } else if (type === 'building') {
            const structure = entity.components.get('Structure');
            // 건물의 경우 내부에서 좌표를 다시 잡으므로 restore 후 호출
            ctx.restore(); 
            this.drawBuildingCached(ctx, t, v, structure, time);
            
            const storage = entity.components.get('Storage');
            if (storage && structure && structure.isComplete) {
                ctx.save();
                ctx.translate(Math.floor(t.x), Math.floor(t.y));
                this.renderStorageResources(ctx, storage, v.size || 40);
                ctx.restore();
            }
            return; // Already restored
        } else {
            NatureRenders.render(ctx, type, t, v, time, wind, entity);
        }

        ctx.restore();
    }

    renderStorageResources(ctx, storage, size) {
        if (!storage.items) return;
        let woodCount = storage.items['wood'] || 0;
        let foodCount = storage.items['food'] || 0;
        
        ctx.save();
        if (woodCount > 0) {
            const pileSize = Math.min(woodCount / 50, 5);
            ctx.translate(size * 0.6, size * 0.4);
            ctx.fillStyle = '#5d4037';
            ctx.strokeStyle = '#3e2723';
            for (let i = 0; i < pileSize; i++) {
                ctx.fillRect(-5 + (i%3)*3, -i*2, 10, 4);
                ctx.strokeRect(-5 + (i%3)*3, -i*2, 10, 4);
            }
            ctx.translate(-size * 0.6, -size * 0.4);
        }
        if (foodCount > 0) {
            const pileSize = Math.min(foodCount / 50, 4);
            ctx.translate(-size * 0.6, size * 0.3);
            ctx.fillStyle = '#d7ccc8';
            ctx.strokeStyle = '#8d6e63';
            for (let i = 0; i < pileSize; i++) {
                ctx.beginPath();
                ctx.arc(-2 + (i%2)*5, -i*3, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
        ctx.restore();

        if (woodCount > 0 || foodCount > 0) {
            ctx.save();
            ctx.translate(0, -size * 0.8 - 10);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.roundRect(-20, -10, 40, (woodCount > 0 ? 12 : 0) + (foodCount > 0 ? 12 : 0) + 4, 4);
            ctx.fill();
            ctx.font = 'bold 9px Inter, Arial';
            ctx.textAlign = 'left';
            let yOffset = -2;
            if (woodCount > 0) {
                ctx.fillText('🪵', -16, yOffset);
                ctx.fillStyle = '#fff';
                ctx.fillText(woodCount.toString(), -2, yOffset + 1);
                yOffset += 12;
            }
            if (foodCount > 0) {
                ctx.fillText('🍎', -16, yOffset);
                ctx.fillStyle = '#fff';
                ctx.fillText(foodCount.toString(), -2, yOffset + 1);
            }
            ctx.restore();
        }
    }

    drawTreeCached(ctx, t, v, entity, time, wind) {
        const size = v.size || 15;
        const isWithered = v.isWithered || false;
        const color = isWithered ? '#795548' : (v.color || '#2e7d32');
        const isXRay = this.engine.viewFlags.xray || false;

        const res = entity?.components.get('Resource');
        if (res && res.isFalling) {
            ctx.save();
            ctx.translate(Math.floor(t.x), Math.floor(t.y));
            TreeRenderer.draw(ctx, t, v, size, isWithered, time, wind, isXRay, entity);
            ctx.restore();
            return;
        }

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

    drawBuildingCached(ctx, t, v, structure, time) {
        const size = v.size || 30;
        const type = v.subtype || 'default';
        
        // 1. 캐시 키 생성 (청사진인 경우 진행도 포함)
        const progress = structure ? Math.floor(structure.progress / (structure.maxProgress / 4)) : 4;
        const isComplete = !structure || structure.isComplete;
        const key = `build_${type}_${size}_${isComplete ? 'full' : 'p' + progress}`;
        
        // 2. 캐시된 스프라이트 가져오기 또는 생성
        const sprite = this.getSprite(key, (sCtx) => {
            // 💡 [Fix] 청사진이어도 본체(Body)를 그리도록 overlayOnly=false (기본값)로 호출
            BuildRender.render(sCtx, type, { x: 0, y: 0 }, v, structure, 0, this.engine, false);
        }, size * 2.5, size * 2.5);

        ctx.save();
        ctx.translate(Math.floor(t.x), Math.floor(t.y));
        
        // 3. 스프라이트 그리기
        ctx.drawImage(sprite, -sprite.width / 2, -(sprite.height - 5));
        
        // 4. 동적 오버레이 및 건설 정보 (캐시하지 않음)
        if (isComplete && (type === 'bonfire' || type === 'house' || type === 'farm')) {
            BuildRender.render(ctx, type, { x: 0, y: 0 }, v, structure, time, this.engine, true); // true for overlayOnly
        } else if (!isComplete) {
            // 건설 중 정보 표시
            BuildRender.renderBlueprintInfo(ctx, { x: 0, y: 0 }, structure);
        }

        ctx.restore();
    }

    renderBuildingDebugInfo(ctx, entityManager) {
        const camera = this.engine.camera;
        if (!camera) return;

        for (const id of entityManager.buildingIds) {
            const entity = entityManager.entities.get(id);
            if (!entity) continue;

            const t = entity.components.get('Transform');
            const building = entity.components.get('Building');
            const structure = entity.components.get('Structure');
            if (!t || !building) continue;

            const viewX = camera.x, viewY = camera.y;
            const viewW = camera.width / camera.zoom, viewH = camera.height / camera.zoom;
            if (t.x < viewX || t.x > viewX + viewW || t.y < viewY || t.y > viewY + viewH) continue;

            ctx.save();
            ctx.translate(Math.floor(t.x), Math.floor(t.y));
            const panelW = 80, panelH = structure?.isComplete ? 38 : 52;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.roundRect(-panelW / 2, -panelH - 30, panelW, panelH, 4);
            ctx.fill();
            ctx.font = 'bold 8px Inter, Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffeb3b';
            ctx.fillText(`🏠 ${building.type.toUpperCase()}`, 0, -panelH - 30 + 10);
            ctx.fillStyle = '#aaaaaa';
            ctx.fillText(`Village: ${building.villageId}`, 0, -panelH - 30 + 22);

            if (structure && !structure.isComplete) {
                const progress = Math.floor((structure.progress / structure.maxProgress) * 100);
                ctx.fillStyle = '#81c784';
                ctx.fillText(`🔨 ${progress}%`, 0, -panelH - 30 + 34);
                const barW = 60;
                const bx = -barW / 2, by = -panelH - 30 + panelH - 8;
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(bx, by, barW, 4);
                ctx.fillStyle = '#4caf50';
                ctx.fillRect(bx, by, barW * (structure.progress / structure.maxProgress), 4);
            } else if (structure?.isComplete) {
                ctx.fillStyle = '#4caf50';
                ctx.fillText('✅ COMPLETE', 0, -panelH - 30 + 34);
            }
            ctx.restore();
        }
    }

    renderAnimal(entity, ctx, time, isHighDetail) {
        const health = entity.components.get('Health');
        const t = entity.components.get('Transform');
        
        ctx.save();
        // 🤕 [Hit Feedback] 피격 시 흔들림 및 번쩍임 효과
        if (health && health.hitTimer > 0) {
            const shake = Math.sin(time * 0.05) * 2;
            ctx.translate(shake, 0);
            
            // ⚪ [Optimization] filter 대신 globalAlpha 조절로 번쩍임 유도 (성능 이점)
            if (Math.floor(time / 50) % 2 === 0) {
                ctx.globalAlpha = 0.7; // 피격 시 깜빡임
            }
        }

        AnimalRenders.drawAnimalBody(ctx, entity, time);
        ctx.restore();
    }

    renderHealthBar(ctx, health, t, size) {
        const barW = Math.max(20, size * 1.5);
        const barH = 3;
        const x = t.x - barW / 2;
        const y = t.y - size - 10;

        // 배경
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, y, barW, barH);

        // HP
        const hpWidth = (health.currentHp / health.maxHp) * barW;
        ctx.fillStyle = (health.currentHp / health.maxHp > 0.3) ? '#4caf50' : '#f44336';
        ctx.fillRect(x, y, hpWidth, barH);
    }

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

    renderSelectionCircle(ctx, t) {
        ctx.save();
        ctx.beginPath(); 
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; 
        ctx.lineWidth = 2;
        ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); 
        ctx.stroke();
        ctx.restore();
    }

    renderAIDebug(ctx, t, state, id) {
        const entity = this.engine.entityManager.entities.get(id);
        const animalComp = entity?.components.get('Animal');
        const isHuman = animalComp?.type === 'human';
        
        ctx.save();
        ctx.fillStyle = isHuman ? '#00f2ff' : 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 8px Inter, Arial';
        ctx.textAlign = 'center';
        ctx.fillText(state.mode.toUpperCase(), t.x, t.y - 12);

        const target = state.targetId ? this.engine.entityManager.entities.get(state.targetId) : null;
        let targetPos = target ? target.components.get('Transform') : state.fleePos;

        // 대상 엔티티가 없더라도(wander_pos 등) 경로가 있다면 경로의 마지막 점을 타겟으로 삼아 렌더링
        if (!targetPos && state.path && state.path.length > 0) {
            targetPos = state.path[state.path.length - 1];
        }

        if (targetPos) {
            ctx.beginPath();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = isHuman ? 'rgba(0, 242, 255, 0.7)' : 'rgba(255, 255, 255, 0.5)';
            ctx.setLineDash([4, 2]);
            ctx.moveTo(t.x, t.y);

            if (state.path && Array.isArray(state.path) && state.path.length > 0) {
                for (let i = (state.pathIndex || 0); i < state.path.length; i++) {
                    const wp = state.path[i];
                    if (wp && typeof wp.x === 'number' && typeof wp.y === 'number') {
                        ctx.lineTo(wp.x, wp.y);
                    }
                }
            } else {
                ctx.lineTo(targetPos.x, targetPos.y);
            }
            ctx.stroke();

            if (state.path && state.path.length > 0) {
                ctx.setLineDash([]);
                ctx.fillStyle = isHuman ? '#00f2ff' : '#ffffff';
                for (let i = (state.pathIndex || 0); i < state.path.length; i++) {
                    const wp = state.path[i];
                    ctx.beginPath();
                    ctx.arc(wp.x, wp.y, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else if (state.wanderAngle !== undefined) {
            const len = 15;
            const tx = t.x + Math.cos(state.wanderAngle) * len;
            const ty = t.y + Math.sin(state.wanderAngle) * len;
            ctx.beginPath();
            ctx.strokeStyle = isHuman ? 'rgba(0, 242, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)';
            ctx.moveTo(t.x, t.y);
            ctx.lineTo(tx, ty);
            const head = 4;
            ctx.lineTo(tx - head * Math.cos(state.wanderAngle - 0.5), ty - head * Math.sin(state.wanderAngle - 0.5));
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx - head * Math.cos(state.wanderAngle + 0.5), ty - head * Math.sin(state.wanderAngle + 0.5));
            ctx.stroke();
        }
        ctx.restore();
    }
}