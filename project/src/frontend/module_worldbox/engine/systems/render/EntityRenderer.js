import { AnimalStates } from '../../components/behavior/State.js';
import { AnimalRenders } from '../../objects/renders/AnimalRenders.js';

export default class EntityRenderer {
    constructor(engine) {
        this.engine = engine;
        this.spriteCache = new Map(); // 🚀 High-speed Sprite Buffer
    }


    render(ctx, entityManager, particles, time, wind) {
        const entities = entityManager.entities;
        
        // Periodic cache clearing to handle memory/state changes
        if (time % 60000 < 20) this.spriteCache.clear();

        for (const [id, entity] of entities) {
            const t = entity.components.get('Transform');
            const v = entity.components.get('Visual');
            const state = entity.components.get('AIState');

            if (t && v) {
                // 🕶️ [Step 3: Culling] Skip rendering if off-screen
                if (v.isCulled) continue;

                const zoom = this.engine.camera.zoom;
                const type = v.type;
                const isWithered = v.isWithered || false;

                // 🚀 [Step 4: LOD System]
                if (zoom <= 0.5) {
                    const dotSize = 2 / zoom;
                    ctx.fillStyle = v.color || '#ffffff';
                    ctx.globalAlpha = v.alpha !== undefined ? v.alpha : 1.0;
                    ctx.fillRect(t.x, t.y, dotSize, dotSize);
                    ctx.globalAlpha = 1.0;
                    continue;
                }

                // Visual Selection Feedback
                if (id === this.engine.selectedId) {
                    ctx.save();
                    ctx.beginPath(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 2;
                    ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); ctx.stroke();
                    ctx.restore();
                }

                const isHighDetail = zoom > 1.5;

                // 🐾 동물 상태별 렌더링 통합 처리
                const animalTypes = ['sheep', 'cow', 'human', 'wolf', 'hyena', 'wild_dog'];
                
                // type이 없을 경우를 대비한 방어 코드
                if (!type) {
                    this.drawResourceFallback(ctx, t, v);
                }
                else if (animalTypes.includes(type) && state) {
                    this.renderAnimal(entity, ctx, time, isHighDetail);
                    
                    // 🔍 [7단계: AI 디버그 시각화]
                    if (this.engine.viewFlags.debugAI && zoom > 0.8) {
                        this.renderAIDebug(ctx, t, state, id);
                    }
                }
                else if (type === 'tree') this.drawTreeCached(ctx, t, v, entity, time, wind);
                else if (type === 'plant') this.drawPlant(ctx, t, v, entity, time, wind);

                else if (type === 'flower') this.drawFlower(ctx, t, v, entity, time, wind);
                else if (type === 'wild_mushroom') this.drawMushroom(ctx, t, v, isWithered);
                else if (type === 'cactus') this.drawCactus(ctx, t, v, isWithered);
                else if (type === 'wild_berries') this.drawBerries(ctx, t, v, isWithered);
                else if (type === 'lotus') this.drawLotus(ctx, t, v, isWithered);
                else if (['seaweed', 'deep_sea_kelp', 'waterweed'].includes(type)) this.drawKelp(ctx, t, v, time, isWithered);
                else if (type === 'reed') this.drawReed(ctx, t, v, isWithered);
                else if (type === 'gems' || type.includes('crystal')) this.drawGem(ctx, t, v, time);
                else if (type.includes('ore')) this.drawOre(ctx, t, v, time);
                else if (type === 'bee') this.drawBee(ctx, t, v, entity, time);
                else if (type === 'poop') this.drawPoop(ctx, t, v, entity, time);
                else this.drawResourceFallback(ctx, t, v);
            }

        }


        // --- 💨 PARTICLE RENDERING LAYER (TOP LAYER) ---
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
                // 기본 파티클 (BIOME_TOOL 등)
                const s = p.size || 1.5;
                ctx.fillRect(p.x, p.y, s, s);
            }
            
            ctx.restore();
        }

    }

    // --- 🚀 SPRITE CACHING SYSTEM ---

    getSprite(key, drawFn, width, height) {
        if (this.spriteCache.has(key)) return this.spriteCache.get(key);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const sCtx = canvas.getContext('2d');
        
        // Draw the high-res art onto the cache canvas
        sCtx.translate(width / 2, height - 2); 
        drawFn(sCtx);

        this.spriteCache.set(key, canvas);
        return canvas;
    }

    // --- 🌳 CACHED NATURE METHODS ---

    drawTreeCached(ctx, t, v, entity, time, wind) {
        const size = v.size || 15;
        const isWithered = v.isWithered;
        const color = isWithered ? '#795548' : v.color;
        const key = `tree_${size}_${color}_${isWithered}_${v.treeType}`;

        const sprite = this.getSprite(key, (sCtx) => {
            // Re-use the high-res dot logic for the one-time draw
            const trunkW = Math.max(1, Math.floor(size / 4));
            const trunkH = isWithered ? Math.floor(size * 0.7) : size;
            sCtx.fillStyle = isWithered ? '#3e2723' : '#4e342e';
            sCtx.fillRect(-Math.floor(trunkW / 2) - 1, -1, trunkW + 2, 1);
            sCtx.fillRect(-Math.floor(trunkW / 2), -trunkH, trunkW, trunkH);

            sCtx.translate(0, -trunkH);
            const cSize = isWithered ? Math.floor(size * 0.6) : size;
            if (cSize > 0) {
                const leafColor = isWithered ? '#795548' : v.color;
                const darkLeaf = this.adjustColor(leafColor, -30);
                const lightLeaf = this.adjustColor(leafColor, 40);

                const drawCluster = (ox, oy, radius, col) => {
                    sCtx.fillStyle = col;
                    for (let ry = -radius; ry <= radius; ry += 0.5) {
                        for (let rx = -radius; rx <= radius; rx += 0.5) {
                            if (rx * rx + ry * ry <= radius * radius) {
                                sCtx.fillRect(ox + rx, oy + ry, 0.6, 0.6);
                            }
                        }
                    }
                };

                drawCluster(0, -cSize * 0.2, cSize * 0.6, darkLeaf);
                drawCluster(0, -cSize * 0.4, cSize * 0.5, leafColor);
                drawCluster(-cSize * 0.3, -cSize * 0.2, cSize * 0.4, leafColor);
                drawCluster(cSize * 0.3, -cSize * 0.2, cSize * 0.4, leafColor);
                if (!isWithered) {
                    drawCluster(0, -cSize * 0.6, cSize * 0.3, lightLeaf);
                    drawCluster(-cSize * 0.2, -cSize * 0.5, cSize * 0.2, lightLeaf);
                }
            }

            if (v.treeType === 'fruit' && !isWithered) {
                sCtx.fillStyle = '#e53935'; sCtx.fillRect(-2, -cSize * 0.3, 1.2, 1.2); sCtx.fillRect(2, -cSize * 0.1, 1.2, 1.2);
            } else if (v.treeType === 'beehive' && !isWithered) {
                sCtx.fillStyle = '#fbc02d'; sCtx.fillRect(trunkW, -Math.floor(size * 0.3), 2, 2.5);
            }
        }, size * 3, size * 4);

        // Render the cached sprite with wind sway
        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };
        const sway = isWithered ? 0 : (wv.x * 2 + Math.sin(time * 0.003 + t.x * 0.1) * (size * 0.1));
        
        ctx.save();
        ctx.translate(Math.floor(t.x), Math.floor(t.y));
        ctx.drawImage(sprite, -sprite.width / 2 + sway, -sprite.height + 2);
        ctx.restore();
    }

    // --- 🐾 ANIMAL & HUMAN METHODS (LOD Optimized) ---

    drawSheep(ctx, frameIdx, size = 0.7) {
        const s = size;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-3 * s, -4 * s, 6 * s, 4 * s); ctx.fillRect(-4 * s, -3 * s, 8 * s, 2 * s);
        ctx.fillStyle = '#eeeeee'; ctx.fillRect(3 * s, -4 * s, 2 * s, 2.5 * s);
        ctx.fillStyle = '#000000'; ctx.fillRect(4.5 * s, -3 * s, 0.5 * s, 0.5 * s);
        
        // Leg Animation based on frameIdx
        // 0: idle, 1: leg1, 2: leg2
        const legOsc = frameIdx === 1 ? -2 * s : (frameIdx === 2 ? 2 * s : 0);
        ctx.fillStyle = '#bdbdbd'; 
        ctx.fillRect(-2 * s + legOsc, 0, 0.8 * s, 1.2 * s); 
        ctx.fillRect(1.5 * s - legOsc, 0, 0.8 * s, 1.2 * s);
    }

    drawCow(ctx, frameIdx, size = 0.8) {
        const s = size;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-4 * s, -5 * s, 8 * s, 5 * s);
        ctx.fillStyle = '#212121'; ctx.fillRect(-1 * s, -5 * s, 2 * s, 2 * s); ctx.fillRect(2 * s, -3 * s, 2 * s, 1.5 * s);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(4 * s, -5 * s, 3.5 * s, 3.5 * s);
        ctx.fillStyle = '#ffca28'; ctx.fillRect(6 * s, -2.5 * s, 2 * s, 1.5 * s);
        
        const legOsc = frameIdx === 1 ? -2 * s : (frameIdx === 2 ? 2 * s : 0);
        ctx.fillStyle = '#4e342e'; 
        ctx.fillRect(-3 * s + legOsc, 0, 1 * s, 1.5 * s); 
        ctx.fillRect(3 * s - legOsc, 0, 1 * s, 1.5 * s);
    }

    drawPredator(ctx, frameIdx, size = 0.7, type = 'wolf') {
        const s = size;
        let mainColor = type === 'hyena' ? '#a1887f' : (type === 'wild_dog' ? '#8d6e63' : '#757575');
        ctx.fillStyle = mainColor; ctx.fillRect(-4 * s, -3 * s, 7 * s, 3 * s);
        ctx.fillRect(3 * s, -4.5 * s, 2.5 * s, 2.5 * s); ctx.fillRect(5.5 * s, -3.5 * s, 1.5 * s, 1.5 * s);
        ctx.fillStyle = '#ff1744'; ctx.fillRect(4.5 * s, -3.5 * s, 0.5 * s, 0.5 * s);
        
        const legOsc = frameIdx === 1 ? -2 * s : (frameIdx === 2 ? 2 * s : 0);
        ctx.fillStyle = mainColor;
        ctx.fillRect(-3 * s + legOsc, 0, 0.8 * s, 1.2 * s);
        ctx.fillRect(2 * s - legOsc, 0, 0.8 * s, 1.2 * s);
    }

    drawHuman(ctx, frameIdx, size = 0.7) {
        const s = size;
        ctx.fillStyle = '#1e88e5'; ctx.fillRect(-2 * s, -6 * s, 4 * s, 6 * s);
        ctx.fillStyle = '#ffccbc'; ctx.fillRect(-1.5 * s, -9 * s, 3 * s, 3 * s);
        ctx.fillStyle = '#3e2723'; ctx.fillRect(-1.5 * s, -10 * s, 3 * s, 1.5 * s);
        
        const legOsc = frameIdx === 1 ? -2 * s : (frameIdx === 2 ? 2 * s : 0);
        ctx.fillStyle = '#37474f'; 
        ctx.fillRect(-2 * s + legOsc, 0, 1.5 * s, 2.5 * s); 
        ctx.fillRect(0.5 * s - legOsc, 0, 1.5 * s, 2.5 * s);
    }


    // --- 🍄 OTHER NATURE METHODS ---



    // --- 🍄 OTHER NATURE METHODS ---

    drawPlant(ctx, t, v, entity, time, wind) {
        const isWithered = v.isWithered;
        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };
        const osc = Math.sin(time * 0.005 + t.x * 0.1) * 0.3;
        const lean = isWithered ? 0 : (wv.x * 4 + osc) * 0.2;
        ctx.save(); ctx.translate(t.x, t.y);
        const s = 0.6; ctx.fillStyle = isWithered ? '#8d6e63' : v.color;
        ctx.fillRect(-0.5 * s, -1 * s, 1 * s, 1.5 * s);
        ctx.fillRect(lean - 1 * s, -2 * s, 0.8 * s, 2 * s);
        ctx.restore();
    }

    drawFlower(ctx, t, v, entity, time, wind) {
        const isWithered = v.isWithered;
        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };
        const osc = Math.sin(time * 0.006 + t.x * 0.15) * 0.5;
        const lean = isWithered ? 0 : (wv.x * 5 + osc) * 0.2;
        ctx.save(); ctx.translate(t.x, t.y);
        const s = 0.6; ctx.fillStyle = isWithered ? '#5d4037' : '#2e7d32';
        ctx.fillRect(-0.2 * s, -3 * s, 0.4 * s, 3 * s);
        if (!isWithered) {
            ctx.fillStyle = v.color; ctx.fillRect(lean - 1.2 * s, -4.2 * s, 2.4 * s, 0.8 * s);
            ctx.fillStyle = '#ffeb3b'; ctx.fillRect(lean - 0.3 * s, -4.1 * s, 0.6 * s, 0.6 * s);
        }
        ctx.restore();
    }

    drawMushroom(ctx, t, v, isWithered) {
        ctx.save(); ctx.translate(Math.floor(t.x), Math.floor(t.y));
        const s = 0.6; ctx.fillStyle = isWithered ? '#d7ccc8' : '#ffffff'; ctx.fillRect(-0.5 * s, 0, 1 * s, 1.5 * s);
        ctx.fillStyle = isWithered ? '#8d6e63' : '#d32f2f';
        ctx.fillRect(-2 * s, -1.5 * s, 4 * s, 1.5 * s); ctx.fillRect(-1.2 * s, -2.2 * s, 2.4 * s, 0.8 * s);
        ctx.restore();
    }

    drawCactus(ctx, t, v, isWithered) {
        ctx.save(); ctx.translate(Math.floor(t.x), Math.floor(t.y));
        const s = 0.7; ctx.fillStyle = isWithered ? '#795548' : '#2e7d32';
        ctx.fillRect(-1 * s, -4 * s, 2 * s, 5 * s);
        if (!isWithered) {
            ctx.fillRect(-3 * s, -3 * s, 2 * s, 1 * s); ctx.fillRect(1 * s, -2 * s, 2 * s, 1 * s);
        }
        ctx.restore();
    }

    drawBerries(ctx, t, v, isWithered) {
        ctx.save(); ctx.translate(Math.floor(t.x), Math.floor(t.y));
        const s = 0.8; ctx.fillStyle = isWithered ? '#5d4037' : '#1b5e20';
        ctx.fillRect(-2 * s, -2 * s, 4 * s, 2.5 * s);
        if (!isWithered) { ctx.fillStyle = '#e53935'; ctx.fillRect(-1.2 * s, -1.5 * s, 0.6 * s, 0.6 * s); }
        ctx.restore();
    }

    drawLotus(ctx, t, v, isWithered) {
        ctx.save(); ctx.translate(Math.floor(t.x), Math.floor(t.y));
        const s = 0.7; ctx.fillStyle = isWithered ? '#4e342e' : '#2e7d32';
        ctx.fillRect(-3 * s, -0.5 * s, 6 * s, 1 * s);
        if (!isWithered) { ctx.fillStyle = '#f48fb1'; ctx.fillRect(-0.8 * s, -2 * s, 1.6 * s, 1.2 * s); }
        ctx.restore();
    }

    drawKelp(ctx, t, v, time, isWithered) {
        ctx.save(); ctx.translate(Math.floor(t.x), Math.floor(t.y));
        const s = 0.6; ctx.fillStyle = isWithered ? '#3e2723' : '#004d40';
        const sway = isWithered ? 0 : Math.sin(time * 0.005 + t.x) * 3;
        for(let i=0; i<4; i++) { ctx.fillRect(Math.sin(i * 1.5 + time * 0.002) * (sway * 0.5) - s/2, -i * 2 * s, 1.2 * s, 2 * s); }
        ctx.restore();
    }

    drawReed(ctx, t, v, isWithered) {
        ctx.save(); ctx.translate(Math.floor(t.x), Math.floor(t.y));
        const s = 0.7; ctx.fillStyle = isWithered ? '#5d4037' : '#2e7d32';
        const h = isWithered ? 4 : 7; ctx.fillRect(-0.3 * s, -h * s, 0.6 * s, h * s);
        if (!isWithered) { ctx.fillStyle = '#3e2723'; ctx.fillRect(-0.5 * s, -h * s, 1 * s, 2 * s); }
        ctx.restore();
    }

    drawGem(ctx, t, v, time) {
        ctx.save(); ctx.translate(Math.floor(t.x), Math.floor(t.y));
        ctx.fillStyle = v.color; ctx.fillRect(0, -2, 1, 3); ctx.fillRect(-1, -1, 3, 1);
        ctx.restore();
    }

    drawOre(ctx, t, v, time) {
        ctx.save(); ctx.translate(Math.floor(t.x), Math.floor(t.y));
        ctx.fillStyle = '#455a64'; ctx.fillRect(-1, -1, 3, 2); ctx.fillStyle = v.color; ctx.fillRect(0, -1, 1, 1);
        ctx.restore();
    }

    drawBee(ctx, t, v, entity, time) {
        if (v.isInside) return;
        ctx.save(); ctx.translate(Math.floor(t.x), Math.floor(t.y));
        if (t.vx !== undefined && Math.abs(t.vx) > 0.1) ctx.scale(t.vx < 0 ? -1 : 1, 1);
        ctx.fillStyle = '#fbc02d'; ctx.fillRect(-1, 0, 1, 1); ctx.fillStyle = '#212121'; ctx.fillRect(0, 0, 1, 1);
        ctx.restore();
    }

    drawPoop(ctx, t, v, entity, time) {
        ctx.save(); ctx.translate(t.x, t.y); ctx.fillStyle = '#4e342e'; ctx.fillRect(-0.6, 0, 1.2, 0.8); ctx.restore();
    }

    drawResourceFallback(ctx, t, v) {
        ctx.fillStyle = v.color; const s = v.size || 0.8; ctx.fillRect(t.x, t.y, s, s);
    }

    // --- 🐾 STATE-BASED ANIMAL RENDERER ---

    renderAnimal(entity, ctx, time, isHighDetail) {
        const v = entity.components.get('Visual');
        if (!v) return;

        const type = v.type;

        // 🎨 AnimalRenders를 통해 상태별 모션과 함께 그리기 실행
        AnimalRenders.drawAnimalBody(ctx, entity, time, (sCtx, frameIdx, size) => {
            if (type === 'sheep') this.drawSheep(sCtx, frameIdx, size);
            else if (type === 'cow') this.drawCow(sCtx, frameIdx, size);
            else if (type === 'human') this.drawHuman(sCtx, frameIdx, size);
            else if (['wolf', 'hyena', 'wild_dog'].includes(type)) {
                this.drawPredator(sCtx, frameIdx, size, type);
            }
        });
    }

    drawSleepParticles(ctx, t, time) {

        const osc = Math.sin(time * 0.002) * 5;
        const alpha = 0.5 + Math.sin(time * 0.005) * 0.5;
        
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px Arial';
        ctx.fillText('Z', t.x + 5, t.y - 10 + osc);
        ctx.fillText('z', t.x + 10, t.y - 15 + osc * 0.5);
        ctx.restore();
    }

    /**
     * AI 상태를 시각적으로 표시합니다. (상태 텍스트 + 타겟 라인)
     */
    renderAIDebug(ctx, t, state, id) {
        ctx.save();
        
        // 1. 상태 텍스트 (머리 위)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 8px Inter, Arial';
        ctx.textAlign = 'center';
        ctx.fillText(state.mode.toUpperCase(), t.x, t.y - 12);

        // 2. 타겟 라인 (추격 중일 때)
        if (state.targetId) {
            const target = this.engine.entityManager.entities.get(state.targetId);
            if (target) {
                const targetPos = target.components.get('Transform');
                if (targetPos) {
                    ctx.beginPath();
                    ctx.setLineDash([2, 2]); // 점선
                    ctx.strokeStyle = state.mode === 'hunt' ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.3)';
                    ctx.moveTo(t.x, t.y);
                    ctx.lineTo(targetPos.x, targetPos.y);
                    ctx.stroke();
                }
            }
        }
        
        ctx.restore();
    }

    adjustColor(color, amount) {
        const match = color.match(/\d+/g); if (!match) return color;
        const [r, g, b] = match.map(Number);
        return `rgb(${Math.min(255, Math.max(0, r + amount))},${Math.min(255, Math.max(0, g + amount))},${Math.min(255, Math.max(0, b + amount))})`;
    }
}