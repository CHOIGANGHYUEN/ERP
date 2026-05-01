import { AnimalStates } from '../../components/behavior/State.js';
import { AnimalRenders } from '../../objects/renders/AnimalRenders.js';
import { NatureRenders } from '../../objects/renders/NatureRenders.js';
import { TreeRenderer } from '../../objects/renders/nature/TreeRenderer.js';
import { BuildRender } from '../../objects/renders/BuildRender.js';

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

        // 3. 건물 AI 경로 정보 오버레이 (debugAI 모드)
        if (this.engine.viewFlags.debugAI) {
            this.renderBuildingDebugInfo(ctx, entityManager);
        }
    }

    /** 🌿 환경 자원 렌더링 조율 */
    renderResource(entity, ctx, time, wind) {
        const t = entity.components.get('Transform');
        const v = entity.components.get('Visual');
        if (!t || !v) return;

        ctx.save();
        ctx.globalAlpha = v.alpha !== undefined ? v.alpha : 1.0;
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
            // 🌲 쓰러지는 나무: fallProgress 업데이트
            const res = entity.components.get('Resource');
            if (res && res.isFalling) {
                const FALL_DURATION = 0.8; // 쓰러지는 데 0.8초
                res.fallProgress = Math.min(1.0, (res.fallProgress || 0) + (0.016 / FALL_DURATION));
                if (res.fallProgress >= 1.0) {
                    // 쓰러짐 완료 → 엔티티 제거
                    ctx.restore();
                    this.engine.entityManager.removeEntity(entity.id);
                    return;
                }
            }
            ctx.restore(); // Shadow용 translate 복구 후 전용 메서드로 위임 (내부에서 다시 save함)
            this.drawTreeCached(ctx, t, v, entity, time, wind);
        } else if (v.type === 'building') {
            const structure = entity.components.get('Structure');
            BuildRender.render(ctx, v.subtype || 'default', t, v, structure);
            
            // 📦 창고(Storage) 자원 렌더링 (건물 외부에 쌓이는 모습 및 아이콘)
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

    /** 📦 창고 아이템 및 시각적 쌓임 효과 렌더링 */
    renderStorageResources(ctx, storage, size) {
        if (!storage.items) return;
        
        let woodCount = storage.items['wood'] || 0;
        let foodCount = storage.items['food'] || 0;
        let stoneCount = storage.items['stone'] || 0;
        
        // 1. 자원 무더기 시각화 (건물 주변에)
        ctx.save();
        
        // 나무 장작 무더기 (오른쪽 아래)
        if (woodCount > 0) {
            const pileSize = Math.min(woodCount / 50, 5); // 수량에 따라 크기 증가
            ctx.translate(size * 0.6, size * 0.4);
            ctx.fillStyle = '#5d4037';
            ctx.strokeStyle = '#3e2723';
            ctx.lineWidth = 1;
            for (let i = 0; i < pileSize; i++) {
                ctx.fillRect(-5 + (i%3)*3, -i*2, 10, 4);
                ctx.strokeRect(-5 + (i%3)*3, -i*2, 10, 4);
            }
            ctx.translate(-size * 0.6, -size * 0.4);
        }
        
        // 식량 자루 무더기 (왼쪽 아래)
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
            ctx.translate(size * 0.6, -size * 0.3);
        }
        ctx.restore();

        // 2. 오버레이 UI (수량 텍스트)
        if (woodCount > 0 || foodCount > 0 || stoneCount > 0) {
            ctx.save();
            ctx.translate(0, -size * 0.8 - 10);
            
            // 반투명 배경
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.roundRect(-20, -10, 40, (woodCount > 0 ? 12 : 0) + (foodCount > 0 ? 12 : 0) + 4, 4);
            ctx.fill();
            
            ctx.font = 'bold 9px Inter, Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            
            let yOffset = -2;
            if (woodCount > 0) {
                ctx.fillStyle = '#795548'; // 나무 아이콘 색상
                ctx.fillText('🪵', -16, yOffset);
                ctx.fillStyle = '#fff';
                ctx.fillText(woodCount.toString(), -2, yOffset + 1);
                yOffset += 12;
            }
            if (foodCount > 0) {
                ctx.fillStyle = '#4caf50'; // 식량 아이콘 색상
                ctx.fillText('🍎', -16, yOffset);
                ctx.fillStyle = '#fff';
                ctx.fillText(foodCount.toString(), -2, yOffset + 1);
            }
            
            ctx.restore();
        }
    }

    /** 🌲 나무 캐싱 및 렌더링 */
    drawTreeCached(ctx, t, v, entity, time, wind) {
        const size = v.size || 15;
        const isWithered = v.isWithered || false;
        const color = isWithered ? '#795548' : (v.color || '#2e7d32');
        const isXRay = this.engine.viewFlags.xray || false;

        // 쓰러지는 나무는 캐시 사용하지 않음 (매 프레임 각도가 달라지므로)
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

    /** 🏛️ 건물 AI 경로 디버그 정보 오버레이 */
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

            // 카메라 뷰포트 밖이면 스킵
            const viewX = camera.x, viewY = camera.y;
            const viewW = camera.width / camera.zoom, viewH = camera.height / camera.zoom;
            if (t.x < viewX || t.x > viewX + viewW || t.y < viewY || t.y > viewY + viewH) continue;

            ctx.save();
            ctx.translate(Math.floor(t.x), Math.floor(t.y));

            // 배경 패널
            const panelW = 80, panelH = structure?.isComplete ? 38 : 52;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.roundRect(-panelW / 2, -panelH - 30, panelW, panelH, 4);
            ctx.fill();

            ctx.font = 'bold 8px Inter, Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 건물 타입
            const typeLabel = `🏠 ${building.type.toUpperCase()}`;
            ctx.fillStyle = '#ffeb3b';
            ctx.fillText(typeLabel, 0, -panelH - 30 + 10);

            // 마을 ID
            ctx.fillStyle = '#aaaaaa';
            ctx.fillText(`Village: ${building.villageId}`, 0, -panelH - 30 + 22);

            // 건설 진행도 (미완성일 때만)
            if (structure && !structure.isComplete) {
                const progress = Math.floor((structure.progress / structure.maxProgress) * 100);
                ctx.fillStyle = '#81c784';
                ctx.fillText(`🔨 ${progress}%`, 0, -panelH - 30 + 34);

                // 진행도 바
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
        const entity = this.engine.entityManager.entities.get(id);
        const isHuman = entity?.components.get('Animal')?.type === 'human';
        
        ctx.save();
        // 인간은 시안색(#00f2ff), 일반 동물은 흰색
        ctx.fillStyle = isHuman ? '#00f2ff' : 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 8px Inter, Arial';
        ctx.textAlign = 'center';
        ctx.fillText(state.mode.toUpperCase(), t.x, t.y - 12);

        // 1. 타겟이 있는 경우: 전체 탐색 경로(Waypoint) 표시
        if (state.targetId) {
            const target = this.engine.entityManager.entities.get(state.targetId);
            if (target) {
                const targetPos = target.components.get('Transform');
                if (targetPos) {
                    ctx.beginPath();
                    ctx.setLineDash([2, 2]);
                    ctx.strokeStyle = isHuman ? 'rgba(0, 242, 255, 0.5)' : 'rgba(255, 255, 255, 0.3)';
                    ctx.moveTo(t.x, t.y);

                    // A* 탐색 경로가 있으면 전체 경로를 따라 선 긋기
                    if (state.path && state.path.length > 0 && state.pathIndex !== undefined) {
                        for (let i = state.pathIndex; i < state.path.length; i++) {
                            const wp = state.path[i];
                            ctx.lineTo(wp.x, wp.y);
                        }
                    } else {
                        // 경로가 없으면 직접 타겟으로 직선 긋기
                        ctx.lineTo(targetPos.x, targetPos.y);
                    }
                    ctx.stroke();
                }
            }
        } 
        // 2. 타겟은 없지만 배회 방향(wanderAngle)이 있는 경우: 진행 방향 화살표 표시
        else if (state.wanderAngle !== undefined) {
            const len = 15;
            const tx = t.x + Math.cos(state.wanderAngle) * len;
            const ty = t.y + Math.sin(state.wanderAngle) * len;
            
            ctx.beginPath();
            ctx.strokeStyle = isHuman ? 'rgba(0, 242, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)';
            ctx.moveTo(t.x, t.y);
            ctx.lineTo(tx, ty);
            // 작은 화살표 머리
            const head = 4;
            ctx.lineTo(tx - head * Math.cos(state.wanderAngle - 0.5), ty - head * Math.sin(state.wanderAngle - 0.5));
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx - head * Math.cos(state.wanderAngle + 0.5), ty - head * Math.sin(state.wanderAngle + 0.5));
            ctx.stroke();
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