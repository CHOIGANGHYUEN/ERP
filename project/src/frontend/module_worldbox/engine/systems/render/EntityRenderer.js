import { AnimalStates } from '../../components/behavior/State.js';
import { AnimalRenders } from '../../objects/renders/AnimalRenders.js';
import { NatureRenders } from '../../objects/renders/NatureRenders.js';
import { TreeRenderer } from '../../objects/renders/nature/TreeRenderer.js';
import { BuildRender } from '../../objects/renders/BuildRender.js';

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
        }

        this.renderParticles(ctx, particles);


    }

    renderResource(entity, ctx, time, wind) {
        const t = entity.components.get('Transform');
        const v = entity.components.get('Visual');
        if (!t || !v) return;

        ctx.save();
        ctx.globalAlpha = v.alpha !== undefined ? v.alpha : 1.0;
        ctx.translate(Math.floor(t.x), Math.floor(t.y));
        
        ctx.beginPath();
        const shadowW = v.type === 'tree' ? 6 : 4;
        const shadowH = v.type === 'tree' ? 3 : 2;
        ctx.ellipse(0, 0, shadowW, shadowH, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        if (v.type === 'tree') {
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
        } else if (v.type === 'building') {
            const structure = entity.components.get('Structure');
            // console.debug(`[EntityRenderer] Dispatching to BuildRender: ${v.subtype}, ID: ${entity.id}`);
            BuildRender.render(ctx, v.subtype || 'default', t, v, structure, time, this.engine);
            
            const storage = entity.components.get('Storage');
            if (storage && structure && structure.isComplete) {
                this.renderStorageResources(ctx, storage, v.size || 40);
            }
            ctx.restore();
        } else {
            NatureRenders.render(ctx, v.type, t, v, time, wind);
            ctx.restore();
        }
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
        AnimalRenders.drawAnimalBody(ctx, entity, time);
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