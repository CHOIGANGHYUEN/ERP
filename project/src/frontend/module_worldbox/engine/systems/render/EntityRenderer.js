import { AnimalStates } from '../../components/behavior/State.js';
import { AnimalRenders } from '../../objects/renders/AnimalRenders.js';
import { NatureRenders } from '../../objects/renders/NatureRenders.js';
import { TreeRenderer } from '../../objects/renders/nature/TreeRenderer.js';
import { BuildRender } from '../../objects/renders/BuildRender.js';
import FenceRenderer from '../../objects/renders/building/FenceRenderer.js';
import { ItemRenderer } from '../../objects/renders/ItemRenderer.js';
import JobVisualRenderer from './jobs/JobVisualRenderer.js';
import { textureManager } from './TextureManager.js';

/**
 * 🎨 EntityRenderer
 * 월드 내의 모든 개체와 파티클 렌더링을 총괄하는 코디네이터입니다.
 */
export default class EntityRenderer {
    constructor(engine) {
        this.engine = engine;
        this.spriteCache = new Map(); 

        // 👻 [Step 15] 실루엣 렌더링용 오프스크린 버퍼
        this.silhouetteCanvas = document.createElement('canvas');
        this.silhouetteCanvas.width = 64;
        this.silhouetteCanvas.height = 64;
        this.silhouetteCtx = this.silhouetteCanvas.getContext('2d');

        this.jobVisualRenderer = new JobVisualRenderer(engine);
    }

    // (Shadow sprite is now handled by textureManager)

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
        
        const tBuffer = entityManager.transformBuffer;
        const rBuffer = entityManager.renderBuffer;

        for (const id of visibleIds) {
            if (processedIds.has(id)) continue;
            processedIds.add(id);

            const tIdx = id * 2;
            const rIdx = id * 8;

            const x = tBuffer[tIdx];
            const y = tBuffer[tIdx + 1];

            // 🚀 [Expert Optimization] 버퍼에서 직접 좌표 및 렌더링 데이터 추출 (객체 접근 최소화)
            if (x < viewX || x > viewX + viewW || y < viewY || y > viewY + viewH) continue;

            const entity = entityManager.entities.get(id);
            if (!entity) continue;

            // 🧭 [Expert Optimization] Velocity Buffer에서 직접 데이터 추출 (Component Access 최소화)
            const vIdx = id * 4;
            const vx = entityManager.velocityBuffer[vIdx];
            const vy = entityManager.velocityBuffer[vIdx + 1];

            if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
                // 🔄 [Task 85] Smooth Rotation (Angle Damping)
                const targetAngle = Math.atan2(vy, vx);
                const visual = entity.components.get('Visual');
                let dir8 = 0;

                if (visual) {
                    const currentRad = (visual.facingAngle || targetAngle);
                    let diff = targetAngle - currentRad;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    
                    const turnSpeed = 0.2; // 보간 속도
                    const newRad = currentRad + diff * turnSpeed;
                    visual.facingAngle = newRad;

                    let dir = Math.round(((newRad * 180 / Math.PI) + 90) / 45);
                    dir8 = (dir + 8) % 8;
                } else {
                    let dir = Math.round(((targetAngle * 180 / Math.PI) + 90) / 45);
                    dir8 = (dir + 8) % 8;
                }
                
                const mapping = [6, 7, 0, 1, 2, 3, 4, 5];
                const humanFacing = mapping[dir8];
                
                if (rBuffer[rIdx + 6] !== humanFacing) {
                    rBuffer[rIdx + 6] = humanFacing;
                    const flipX = (humanFacing >= 3 && humanFacing <= 5) ? 1 : 0;
                    rBuffer[rIdx + 3] = flipX;

                    if (visual) {
                        visual.facing = humanFacing;
                        visual.flipX = (flipX === 1);
                    }
                }
            }

            // 6. [Task 83] Trail 데이터 업데이트 및 렌더링 (Frustum Culling 적용)
            const trail = entity.components.get('Trail');
            if (trail) {
                // 🚀 [Optimization] 화면 안에 있을 때만 포인트를 추가하고 그림
                const isVisible = (x > viewX && x < viewX + viewW && y > viewY && y < viewY + viewH);
                if (isVisible) {
                    trail.addPoint(x, y);

                    if (trail.points.length > 1) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.strokeStyle = trail.color;
                        ctx.lineWidth = trail.width;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        
                        const pts = trail.points;
                        ctx.moveTo(pts[0].x, pts[0].y);
                        for (let i = 1; i < pts.length; i++) {
                            ctx.lineTo(pts[i].x, pts[i].y);
                        }
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }

            // v는 기존 호환성을 위해 유지 (애니메이션 메타데이터 등)
            const v = entity.components.get('Visual');
            if (!v) continue;

            const isAnimal = entity.components.has('Animal') || 
                             ['animal', 'human', 'sheep', 'cow', 'wolf', 'hyena', 'wild_dog', 'bee', 'tiger', 'lion', 'bear', 'fox', 'crocodile', 'deer', 'rabbit', 'horse', 'elephant', 'goat'].includes(v.type);

            renderList.push({ 
                id, 
                entity, 
                x, y, 
                z: y, 
                size: Math.min(64, rBuffer[rIdx + 4]), 
                alpha: rBuffer[rIdx + 5] / 255,
                frame: rBuffer[rIdx + 2],
                flipX: rBuffer[rIdx + 3] === 1,
                facing: rBuffer[rIdx + 6],
                type: v.type || '',
                isAnimal // 🚀 [Expert Fix] 실루엣 패스에서 사용하기 위해 플래그 추가
            });
        }

        // 🚀 [Task 91] 드로우 콜 배칭 (Batching)
        // Y좌표(Z-depth)가 거의 같은 객체들은 타입별로 묶어서 렌더링 파이프라인의 상태 변경을 최소화합니다.
        renderList.sort((a, b) => {
            const zDiff = a.z - b.z;
            if (Math.abs(zDiff) < 8) { // 8픽셀 이내면 동일 레이어로 간주
                if (a.type < b.type) return -1;
                if (a.type > b.type) return 1;
                return 0;
            }
            return zDiff;
        });
 
        // (Blacklisted IDs logic moved to RenderCoordinator for performance)

        // 1. 🌑 [Unified Shadows] 모든 개체의 그림자를 먼저 렌더링 (Z-Order 최하단)
        for (const item of renderList) {
            this.renderShadow(ctx, item, time);
        }
        textureManager.flush(ctx);

        // 2. 🌊 [Water Ripples] 물 위에 있는 개체들을 위한 파동 효과
        for (const item of renderList) {
            this.renderWaterRipples(ctx, item, time);
        }

        // 3. 🎨 [Main Entities] 실제 개체 렌더링
        for (const item of renderList) {
            const { id, entity, x, y, size, alpha, isAnimal } = item;
            const state = entity.components.get('AIState');
            const v = entity.components.get('Visual');

            if (id === this.engine.selectedId) {
                this.renderSelectionCircle(ctx, x, y);
            }

            const camera = this.engine.camera;
            const zoom = camera.zoom;
            const isFar = zoom < 0.4; 
            const isHighDetail = zoom > 1.5;
            const type = v.type;

            // 🚀 [Expert LOD] 아주 멀리 있을 때는 단순한 점으로 렌더링
            if (isFar) {
                this.renderSimplifiedEntity(entity, ctx, type);
                continue;
            }

            if (isAnimal) {
                this.renderAnimal(entity, ctx, time, isHighDetail);
                // 🛠️ [Step 32] 직업별 추가 시각 효과 (도구 등)
                this.jobVisualRenderer.draw(ctx, entity, state, entity.components.get('Transform'), entity.components.get('JobController'), camera.zoom);
            } else if (type === 'fence') {
                FenceRenderer.draw(ctx, entity, time);
            } else {
                this.renderResource(entity, ctx, time, wind);
            }

            // 🏥 [Health Integration] HP바 표시
            const health = entity.components.get('Health');
            if (health && health.currentHp < health.maxHp && health.currentHp > 0) {
                this.renderHealthBar(ctx, health, x, y, size);
            }

            // (Blacklist display moved to RenderCoordinator)

            // 💕 [Reproduction] 번식 중 하트 아이콘 표시
            const social = entity.components.get('Social');
            if (social && social.isBreeding) {
                ctx.save();
                ctx.font = '14px serif';
                ctx.textAlign = 'center';
                // 하트가 위아래로 둥실거리는 효과
                const floatY = Math.sin(time * 0.005) * 5;
                ctx.fillText('❤️', x, y - (v.size || 10) - 20 + floatY);
                ctx.restore();
            }
        }

        this.renderParticles(ctx, particles, { x: viewX, y: viewY, w: viewW, h: viewH });
        
        // 🚀 [Expert Optimization] 모든 배칭 큐를 비우고 최종 렌더링
        textureManager.flush(ctx);

        // 👻 [Step 15] Silhouette X-Ray Pass (Top-most)
        // 나무나 건물 뒤에 가려진 개체를 하얀 실루엣으로 표시하여 시인성 확보
        this.renderSilhouettes(ctx, renderList, time);

        this.lastRenderCount = renderList.length;
    }

    /** 🌑 통합 그림자 렌더링 시스템 */
    renderShadow(ctx, item, time) {
        const { x, y, size, entity, alpha } = item;
        if (alpha === 0) return;

        let breathScale = 1.0;
        if (entity.components.has('Animal')) {
            breathScale = 1.0 + Math.sin(time * 0.003) * 0.05;
        }

        // 🚀 [Expert Design] 최소 그림자 크기 확보 (작은 아이템도 보이도록)
        const baseSize = Math.max(8, size);
        const sw = baseSize * 1.8 * breathScale;
        const sh = baseSize * 0.7 * breathScale;

        // 📦 [Batching Optimization] TextureManager의 큐에 추가
        textureManager.enqueueDraw(
            'common_shadow', 
            Math.floor(x), 
            Math.floor(y + 2), // 💡 본체와 겹치지 않게 약간 아래로 오프셋
            sw, sh,
            { alpha: 0.4 } // 그림자 농도 최적화
        );
    }

    /** 🌊 수면 파동 효과 (타일 기반 감지) */
    renderWaterRipples(ctx, item, time) {
        if (!this.engine.terrainGen) return;
        const { x, y } = item;
        
        const tx = Math.floor(x);
        const ty = Math.floor(y);
        const tile = this.engine.terrainGen.getTileAt?.(tx, ty);
        
        // 물 타일(Deep Water, Shallow Water)에서만 활성화
        if (tile === 0 || tile === 1) { 
            ctx.save();
            ctx.translate(tx, ty);
            const rippleScale = (Math.sin(time * 0.005 + x * 0.1) + 1) * 0.5;
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
            // 🚀 [Expert Fix] 중복 호출 제거: drawBuildingCached 내부에서 모든 것을 처리
            ctx.restore(); 
            this.drawBuildingCached(ctx, t, v, structure, time);
            return; 
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
        
        // 🎯 [Step 15] 기존의 나무 투명화(X-Ray) 로직 제거
        // 매 프레임 모든 나무가 SpatialHash를 쿼리하던 병목을 제거하고,
        // 대신 개체 렌더링 시 실루엣을 그리는 방식으로 전환하여 성능과 시각적 안정성 확보
        let drawAlpha = 1.0;

        const sprite = this.getSprite(key, (sCtx) => {
            TreeRenderer.draw(sCtx, t, v, size, isWithered, time, wind, isXRay, entity);
        }, size * 4, size * 5);

        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };
        const swayAmount = isWithered ? 0.2 : 1.0;
        const osc = Math.sin(time * 0.002 + t.x * 0.05) * (size * 0.1);
        const totalSway = (wv.x * 3 + osc) * swayAmount;

        const shear = totalSway / size;
        
        // 📦 [Batching Optimization] 큐에 추가
        textureManager.enqueueDraw(
            sprite, 
            Math.floor(t.x), 
            Math.floor(t.y), 
            sprite.width, sprite.height,
            { 
                rotation: shear * 0.5,
                pivotX: 0.5,
                pivotY: 0.9,
                alpha: drawAlpha // 🛡️ [Expert Fix] 배칭 시스템에 알파값 명시적 전달
            } 
        );
    }

    drawBuildingCached(ctx, t, v, structure, time) {
        const size = v.size || 30;
        const type = v.subtype || 'default';
        const alpha = v.alpha !== undefined ? v.alpha : 1.0;
        
        // 1. 캐시 키 생성 (청사진 여부 및 진행 단계 포함)
        const isComplete = !structure || structure.isComplete;
        const progressLevel = structure ? Math.floor(structure.progress / (Math.max(1, structure.maxProgress) / 4)) : 4;
        const key = `build_${type}_${size}_${isComplete ? 'full' : 'p' + progressLevel}`;
        
        // 2. 본체(Body) 스프라이트 가져오기 (정적인 부분만 캐싱)
        const sprite = this.getSprite(key, (sCtx) => {
            const hpPercent = structure ? (structure.hp / structure.maxHp) : 1.0;
            if (!isComplete) sCtx.globalAlpha = 0.6; // 청사진은 캐시 단계에서 반투명하게 기록
            BuildRender._drawBuildingBody(sCtx, { x: 0, y: 0 }, v, type, 0, false, hpPercent);
        }, size * 2.5, size * 2.5);

        // 3. 스프라이트 그리기 (배칭 큐 활용 - 알파값 전달)
        textureManager.enqueueDraw(
            sprite,
            Math.floor(t.x),
            Math.floor(t.y),
            sprite.width, sprite.height,
            {
                pivotX: 0.5,
                pivotY: 0.85,
                alpha: alpha // 🛡️ [Expert Fix] 엔티티 알파값 연동
            }
        );
        
        // 4. 동적 오버레이 및 건설 정보 (캐시하지 않고 매 프레임 즉시 렌더링)
        ctx.save();
        ctx.translate(Math.floor(t.x), Math.floor(t.y));
        
        if (isComplete) {
            // 연기, 불꽃 등 애니메이션 오버레이
            if (['bonfire', 'house', 'farm', 'blacksmith', 'temple'].includes(type)) {
                BuildRender.render(ctx, type, { x: 0, y: 0 }, v, structure, time, this.engine, true);
            }
        } else {
            // 🚧 건설 중인 경우: 먼지 효과 및 청사진 정보 라벨
            BuildRender.renderConstructionDust(ctx, { x: 0, y: 0 }, v, time);
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

    /** 🎨 아주 멀리 있을 때의 초간략 렌더링 (Pixel Dot) */
    renderSimplifiedEntity(entity, ctx, type) {
        const t = entity.components.get('Transform');
        if (!t) return;

        const x = Math.floor(t.x);
        const y = Math.floor(t.y);

        // 유형별 대표 색상 선정
        let color = '#ffffff';
        if (type === 'human') color = '#ffdbac';
        else if (type === 'tree') color = '#2e7d32';
        else if (type === 'building') color = '#9e9e9e';
        else if (type === 'item') color = '#ffeb3b';
        else if (type.includes('wolf') || type.includes('bear')) color = '#5d4037';

        ctx.fillStyle = color;
        // 🚀 [Expert Fix] 화면상에서 항상 최소 2px로 보이도록 줌에 맞춰 역산
        // (worldSize * zoom = screenSize) => (worldSize = screenSize / zoom)
        const zoom = this.engine.camera.zoom;
        const dotSize = Math.min(20, 2 / zoom); // 최대 20px 캡 (거인 방지)
        ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
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

    /** 🏥 [Health Integration] HP바 표시 */
    renderHealthBar(ctx, health, x, y, size) {
        const barW = Math.max(20, size * 1.5);
        const barH = 3;
        const bx = x - barW / 2;
        const by = y - size - 10;

        // 배경
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(bx, by, barW, barH);

        // HP
        const hpWidth = (health.currentHp / health.maxHp) * barW;
        ctx.fillStyle = (health.currentHp / health.maxHp > 0.3) ? '#4caf50' : '#f44336';
        ctx.fillRect(bx, by, hpWidth, barH);
    }

    /** 👻 [Step 15] 실루엣 렌더링 시스템 (가려진 개체 시각화) */
    renderSilhouettes(ctx, renderList, time) {
        const em = this.engine.entityManager;
        const sh = this.engine.spatialHash;
        const zoom = this.engine.camera?.zoom || 1.0;

        // 줌이 너무 낮으면 실루엣을 그리지 않음 (성능 및 시각적 노이즈 방지)
        if (zoom < 0.5) return;

        for (const item of renderList) {
            const { entity, isAnimal, x, y } = item;
            if (!isAnimal) continue;

            const animal = entity.components.get('Animal');
            // 벌(Bee)이나 새 같은 소형/비행 동물은 실루엣 트리거에서 제외 (Requested)
            if (animal?.type === 'bee' || animal?.type === 'bird') continue;

            // 주변에 나보다 앞에 있는(Y가 큰) 나무나 건물이 있는지 확인
            // 🚀 [Expert Accuracy] 탐색 범위를 넓혀 주변 대상을 찾되, 실제 판정은 엄격하게 수행
            const nearby = sh.query(x, y + 10, 40); 
            let isObscured = false;

            for (const nid of nearby) {
                if (nid === entity.id) continue;
                const other = em.entities.get(nid);
                if (!other) continue;

                const otherV = other.components.get('Visual');
                const otherT = other.components.get('Transform');
                
                // 🌲 [Occlusion Logic - Precise]
                if (otherT && (otherV?.type === 'tree' || otherV?.type === 'building')) {
                    const dy = otherT.y - y;
                    const dx = Math.abs(otherT.x - x);

                    // 1. 수직 거리(Depth): 개체가 나무/건물 뒤에 있어야 함 (5px ~ 80px)
                    // 너무 멀면(>80px) 나무 꼭대기보다 한참 위이므로 가려지지 않은 것으로 간주
                    const isBehind = dy > 5 && dy < 80;

                    // 2. 수평 거리(Width): 나무/건물의 가로 폭 안에 겹쳐야 함
                    // 개체의 크기와 나무의 크기를 고려하여 정밀 판정
                    const isOverlapped = dx < 25; 

                    if (isBehind && isOverlapped) {
                        isObscured = true;
                        break;
                    }
                }
            }

            if (isObscured) {
                this.drawSilhouette(ctx, entity, time);
            }
        }
    }

    /** 👤 개체의 하얀색 실루엣을 그립니다. */
    drawSilhouette(ctx, entity, time) {
        const transform = entity.components.get('Transform');
        const visual = entity.components.get('Visual');
        const state = entity.components.get('AIState');
        const animal = entity.components.get('Animal');
        if (!transform || !visual || !state) return;

        const mode = state.mode;
        const type = visual.type;

        // ⚡ 스프라이트 캐시 및 프레임 계산
        let speedMult = 0.008;
        if (mode === AnimalStates.RUN || mode === AnimalStates.HUNT) speedMult = 0.015;
        const frameIdx = time * speedMult;
        const options = { role: animal?.role, entity: entity, nectar: animal?.nectar };

        // 🎨 [Silhouette Effect] 하얀색 실루엣 생성 (형태에 맞춰 정밀하게)
        // 🚀 [Expert Fix] 메인 캔버스에 직접 합성하면 배경까지 하얗게 변하므로 별도 버퍼 사용
        const sCtx = this.silhouetteCtx;
        sCtx.clearRect(0, 0, 64, 64);
        sCtx.save();
        sCtx.translate(32, 44); // 버퍼 내 중앙 정렬
        if (visual.flipX) sCtx.scale(-1, 1);
        
        // 애니메이션 모션 적용
        AnimalRenders.applyAdvancedStateMotion(sCtx, type, mode, time, entity);
        
        const sprite = AnimalRenders.getSprite(type, mode, frameIdx, visual.color, options);
        sCtx.drawImage(sprite, -24, -36, 48, 48);

        // 하얀색으로 덮기 (형태 보존)
        sCtx.globalCompositeOperation = 'source-atop';
        sCtx.fillStyle = '#ffffff';
        sCtx.fillRect(-24, -36, 48, 48);
        sCtx.restore();

        // 메인 캔버스에 결과물 출력
        ctx.save();
        ctx.translate(transform.x, transform.y);
        ctx.globalAlpha = 0.7; // 실루엣 투명도
        const displaySize = visual.size * 22;
        const s = displaySize / 32;
        ctx.drawImage(this.silhouetteCanvas, -32 * s, -44 * s, 64 * s, 64 * s);
        ctx.restore();
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

    renderParticles(ctx, particles, bounds) {
        const { x: vX, y: vY, w: vW, h: vH } = bounds;
        const margin = 20;

        // 🚀 [Expert Optimization] Frustum Culling for Particles
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            // 🛑 Viewport Culling: 화면 밖 파티클은 렌더링 스킵
            if (p.x < vX - margin || p.x > vX + vW + margin || 
                p.y < vY - margin || p.y > vY + vH + margin) {
                continue;
            }

            const alpha = p.alpha !== undefined ? p.alpha : 1.0;
            
            if (p.type === 'ZZZ') {
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.font = `${p.size}px Arial`;
                ctx.fillText(p.text, p.x, p.y);
                ctx.restore();
            } else {
                // 단순 사각형/원형 파티클은 save 없이 렌더링
                ctx.fillStyle = p.color;
                if (alpha < 1.0) {
                    // 투명도가 있는 경우 globalAlpha 대신 색상 스트링 조작 고려 가능하나 여기선 유지
                    ctx.globalAlpha = alpha;
                }
                
                if (p.type === 'DUST') {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                } else if (p.type === 'BLOOD') {
                    ctx.fillRect(p.x, p.y, p.size, p.size);
                } else if (p.type === 'DEBRIS') {
                    // 🏗️ [Task 84] Debris Rendering with Rotation & Z-offset
                    ctx.save();
                    ctx.translate(p.x, p.y + (p.z || 0));
                    ctx.rotate(p.rotation || 0);
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                    ctx.restore();
                } else {
                    const s = p.size || 1.5;
                    ctx.fillRect(p.x, p.y, s, s);
                }
                
                if (alpha < 1.0) ctx.globalAlpha = 1.0;
            }
        }
    }

    renderSelectionCircle(ctx, x, y) {
        ctx.save();
        ctx.beginPath(); 
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; 
        ctx.lineWidth = 2;
        ctx.arc(x, y, 10, 0, Math.PI * 2); 
        ctx.stroke();
        ctx.restore();
    }
}