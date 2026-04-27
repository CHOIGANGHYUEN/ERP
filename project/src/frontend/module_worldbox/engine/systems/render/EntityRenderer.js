export default class EntityRenderer {
    constructor(engine) {
        this.engine = engine;
    }

    render(ctx, entityManager, particles, time, wind) {
        const timeVal = time; // Time is handled inside wind system
        const entities = entityManager.entities;

        // RENDER WIND VECTORS (Debug View)
        if (wind && this.engine.viewFlags?.wind) {
            ctx.save();
            ctx.strokeStyle = 'rgba(79, 195, 247, 0.6)';
            ctx.fillStyle = 'rgba(79, 195, 247, 0.8)';
            ctx.lineWidth = 1;
            const step = 25;
            for (let wy = 0; wy < 1000; wy += step) {
                for (let wx = 0; wx < 1000; wx += step) {
                    const wv = wind.getSway(wx, wy, time);
                    const mag = Math.sqrt(wv.x * wv.x + wv.y * wv.y);

                    if (mag < 0.1) {
                        ctx.fillRect(wx, wy, 1, 1); // Dot when no wind
                    } else {
                        ctx.beginPath();
                        ctx.moveTo(wx, wy);
                        ctx.lineTo(wx + wv.x * 12, wy + wv.y * 12); // Stretching bar
                        ctx.stroke();
                    }
                }
            }
            ctx.restore();
        }

        for (const [id, entity] of entities) {
            const t = entity.components.get('Transform');
            const v = entity.components.get('Visual');
            const r = entity.components.get('Resource');

            if (t && v) {
                // Visual Selection Feedback
                if (id === this.engine.selectedId) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.arc(t.x, t.y, 8, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }

                if (v.type === 'sheep') {
                    this.drawSheep(ctx, t, v, entity, time);
                } else if (v.type === 'cow') {
                    this.drawCow(ctx, t, v, entity, time);
                } else if (['wolf', 'hyena', 'wild_dog'].includes(v.type)) {
                    this.drawPredator(ctx, t, v, entity, time);
                } else if (v.type === 'flower') {
                    this.drawFlower(ctx, t, v, entity, time, wind);
                } else if (v.type === 'tree') {
                    this.drawTree(ctx, t, v, entity, time, wind);

                    // X-Ray 모드 시 벌집의 꿀 수치 디버그 렌더링
                    if (this.engine.viewFlags?.xray && v.treeType === 'beehive') {
                        ctx.save();
                        ctx.fillStyle = '#ffeb3b';
                        ctx.font = 'bold 9px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(`🍯 ${Math.floor(r?.honey || 0)}`, t.x, t.y - (v.size || 5) - 8);
                        ctx.restore();
                    }
                } else if (v.type === 'bee') {
                    const state = entity.components.get('AIState');
                    const isInside = state && state.mode === 'bee_inside';
                    if (!isInside) {
                        this.drawBee(ctx, t, v, entity, time);
                    } else if (this.engine.viewFlags?.xray) {
                        // X-Ray 모드 시 집 안에 있는 벌들을 반투명하게 퍼트려서 렌더링
                        ctx.save();
                        ctx.globalAlpha = 0.6;
                        const tempT = { ...t, x: t.x + Math.sin(id * 13) * 5, y: t.y + Math.cos(id * 17) * 5 };
                        this.drawBee(ctx, tempT, v, entity, time);
                        ctx.restore();
                    }
                } else if (v.type === 'poop') {
                    this.drawPoop(ctx, t, v, entity, time);
                } else if (v.icon) {
                    ctx.font = `${v.size || 10}px serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(v.icon, t.x, t.y);
                } else if (r && r.isGrass) {
                    // 🌾 ADVANCED ORGANIC GRASS RENDERING
                    const quality = v.quality || 0.5;
                    const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };

                    // Natural oscillation (Subtle swaying)
                    const osc = Math.sin(time * 0.005 + (t.x * 0.1) + (t.y * 0.05)) * 0.4;
                    const windForce = (wv.x * 5) + osc; // Dampened wind influence
                    const lean = windForce * 0.1; // More vertical by default
                    const bend = Math.abs(lean) * 0.3;

                    const baseColor = v.color;
                    const highlightColor = this.adjustColor(baseColor, 40);
                    const shadowColor = this.adjustColor(baseColor, -30);

                    // 1. Root / Shadow
                    ctx.fillStyle = shadowColor;
                    ctx.fillRect(t.x, t.y, 1, 1);

                    // 2. Main Blade (Stem)
                    ctx.fillStyle = baseColor;
                    const height = Math.round(1 + quality * 1.5);
                    for (let h = 1; h <= height; h++) {
                        const hLean = (h / height) * lean;
                        ctx.fillRect(t.x + hLean, t.y - h, 1, 1);

                        // Add tips/highlights to the tallest blade
                        if (h === height) {
                            ctx.fillStyle = highlightColor;
                            ctx.fillRect(t.x + hLean + (lean > 0 ? 0.5 : -0.5), t.y - h, 1, 1);
                        }
                    }

                    // 3. Side Leaves (V-Shape Cluster)
                    ctx.fillStyle = baseColor;
                    if (quality > 0.4) {
                        ctx.fillRect(t.x - 1 + lean * 0.5, t.y - 1 + bend, 1, 1);
                    }
                    if (quality > 0.7) {
                        ctx.fillRect(t.x + 1 + lean * 0.5, t.y - 1 + bend, 1, 1);
                    }
                } else {
                    // Default Entity Render
                    ctx.fillStyle = v.color;
                    ctx.fillRect(t.x, t.y, 1.2, 1.2);
                }
            }
        }

        // Render Particles
        for (const p of particles) {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 1.5, 1.5);
        }
    }

    drawSheep(ctx, t, v, entity, time) {
        const state = entity.components.get('AIState');
        const metabolism = entity.components.get('Metabolism');
        const isEating = state?.mode === 'eat';
        const isPooping = metabolism?.isPooping || false;

        // Environment check
        const ix = Math.floor(t.x);
        const iy = Math.floor(t.y);
        const idx = iy * this.engine.mapWidth + ix;
        const tg = this.engine.terrainGen;
        const currentTerrain = tg.biomeBuffer ? tg.biomeBuffer[idx] : 1;
        const isInWater = currentTerrain === 0; // BIOMES.OCEAN is 0

        ctx.save();
        ctx.translate(t.x, t.y);

        // Direction: Flip based on significant vx to prevent jitter
        if (!t.lastFlip) t.lastFlip = 1;
        if (Math.abs(t.vx) > 0.1) {
            t.lastFlip = t.vx < 0 ? -1 : 1;
        }
        ctx.scale(t.lastFlip, 1);

        // --- WATER CLIPPING ---
        if (isInWater) {
            // Clip bottom half
            ctx.beginPath();
            ctx.rect(-10, -10, 20, 11); // Show only top 10px
            ctx.clip();

            // Submerge offset (sink a bit)
            ctx.translate(0, 1);
        }

        // 1. LEGS (Animated if moving)
        const speed = Math.sqrt((t.vx || 0) ** 2 + (t.vy || 0) ** 2);
        const legSway = speed > 5 ? Math.sin(time * 0.015) : 0;

        ctx.fillStyle = '#000000';
        ctx.fillRect(1, 2 + legSway, 1, 1);
        ctx.fillRect(-2, 2 - legSway, 1, 1);
        ctx.fillRect(0, 2 - legSway, 1, 1);
        ctx.fillRect(-1, 2 + legSway, 1, 1);

        // 2. WOOL BODY
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -1, 4, 3);
        ctx.fillRect(-1, -2, 3, 1);

        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(-2, 1, 4, 1);

        // 3. HEAD (Face)
        ctx.fillStyle = '#333333';
        const headY = isEating ? 1 : -1;
        const headX = 2;
        ctx.fillRect(headX, headY, 2, 2);

        ctx.fillStyle = '#ffffff';
        if (!isEating) ctx.fillRect(headX + 1, headY, 1, 1);

        ctx.fillStyle = '#444444';
        ctx.fillRect(headX - 1, headY, 1, 1);

        if (isPooping) {
            ctx.translate(Math.sin(time * 0.1) * 0.5, 0);
        }

        ctx.restore();

        // 4. WATER RIPPLE (Drawn outside clipping)
        if (isInWater) {
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            const rippleSize = 3 + Math.sin(time * 0.01) * 1;
            ctx.beginPath();
            ctx.ellipse(0, 1, rippleSize, rippleSize * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    drawCow(ctx, t, v, entity, time) {
        const state = entity.components.get('AIState');
        const metabolism = entity.components.get('Metabolism');
        const isEating = state?.mode === 'eat';
        const isPooping = metabolism?.isPooping || false;
        const isDairy = v.cowType === 'dairy';

        // Environment check
        const ix = Math.floor(t.x);
        const iy = Math.floor(t.y);
        const idx = iy * this.engine.mapWidth + ix;
        const tg = this.engine.terrainGen;
        const currentTerrain = tg.biomeBuffer ? tg.biomeBuffer[idx] : 1;
        const isInWater = currentTerrain === 0;

        ctx.save();
        ctx.translate(t.x, t.y);

        // Direction flip
        if (!t.lastFlip) t.lastFlip = 1;
        if (Math.abs(t.vx) > 0.1) t.lastFlip = t.vx < 0 ? -1 : 1;
        ctx.scale(t.lastFlip, 1);

        if (isInWater) {
            ctx.beginPath();
            ctx.rect(-15, -15, 30, 16);
            ctx.clip();
            ctx.translate(0, 2);
        }

        const speed = Math.sqrt((t.vx || 0) ** 2 + (t.vy || 0) ** 2);
        const legSway = speed > 3 ? Math.sin(time * 0.012) * 1.5 : 0;

        // 1. LEGS
        ctx.fillStyle = '#222';
        ctx.fillRect(3, 4 + legSway, 1.5, 2);
        ctx.fillRect(-4, 4 - legSway, 1.5, 2);
        ctx.fillRect(1, 4 - legSway, 1.5, 2);
        ctx.fillRect(-2, 4 + legSway, 1.5, 2);

        // 2. BODY
        if (isDairy) {
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(-5, -2, 9, 6);
            ctx.fillStyle = '#111'; // Spots
            ctx.fillRect(-3, -1, 3, 3);
            ctx.fillRect(1, 1, 2, 2);
            ctx.fillStyle = '#f48fb1'; // Udders
            ctx.fillRect(-1, 4, 3, 1.5);
        } else {
            ctx.fillStyle = '#795548'; // Brown
            ctx.fillRect(-5, -2, 9, 6);
            ctx.fillStyle = '#5d4037'; // Shadow
            ctx.fillRect(-5, 2, 9, 2);
        }

        // 3. HEAD
        const headY = isEating ? 2 : -1;
        const headX = 4;
        ctx.fillStyle = isDairy ? '#f0f0f0' : '#8d6e63';
        ctx.fillRect(headX, headY, 4, 4);
        ctx.fillStyle = isDairy ? '#f48fb1' : '#5d4037'; // Snout
        ctx.fillRect(headX + 2, headY + 2, 2, 2);
        ctx.fillStyle = '#e0e0e0'; // Horns
        ctx.fillRect(headX, headY - 1, 1, 1);
        ctx.fillRect(headX + 2, headY - 1, 1, 1);
        ctx.fillStyle = '#000'; // Eye
        if (!isEating) ctx.fillRect(headX + 1, headY + 1, 1, 1);

        // 4. TAIL
        ctx.fillStyle = isDairy ? '#111' : '#5d4037';
        ctx.fillRect(-6, -1, 1, 3);

        if (isPooping) ctx.translate(Math.sin(time * 0.1) * 0.5, 0);
        ctx.restore();

        // WATER RIPPLE
        if (isInWater) {
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1.5;
            const rippleSize = 4 + Math.sin(time * 0.01) * 1.5;
            ctx.beginPath();
            ctx.ellipse(0, 2, rippleSize, rippleSize * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    drawPredator(ctx, t, v, entity, time) {
        const state = entity.components.get('AIState');
        const type = v.type;
        const speed = Math.sqrt((t.vx || 0) ** 2 + (t.vy || 0) ** 2);
        const legSway = speed > 5 ? Math.sin(time * 0.02) * 1.5 : 0;

        ctx.save();
        ctx.translate(t.x, t.y);

        if (!t.lastFlip) t.lastFlip = 1;
        if (Math.abs(t.vx) > 0.1) t.lastFlip = t.vx < 0 ? -1 : 1;
        ctx.scale(t.lastFlip, 1);

        // Color profiles
        let bodyColor = '#757575'; // Wolf default
        let shadowColor = '#424242';
        if (type === 'hyena') {
            bodyColor = '#bcaaa4';
            shadowColor = '#8d6e63';
        } else if (type === 'wild_dog') {
            bodyColor = '#8d6e63';
            shadowColor = '#5d4037';
        }

        // 1. LEGS
        ctx.fillStyle = shadowColor;
        ctx.fillRect(2, 2 + legSway, 1, 2);
        ctx.fillRect(-3, 2 - legSway, 1, 2);
        ctx.fillRect(0, 2 - legSway, 1, 2);
        ctx.fillRect(-2, 2 + legSway, 1, 2);

        // 2. BODY
        ctx.fillStyle = bodyColor;
        ctx.fillRect(-3, -1, 6, 3);
        ctx.fillRect(-4, -2, 4, 2); // Hind quarters

        // Hyena spots
        if (type === 'hyena') {
            ctx.fillStyle = '#4e342e';
            ctx.fillRect(-2, -1, 1, 1);
            ctx.fillRect(0, 0, 1, 1);
            ctx.fillRect(-3, 1, 1, 1);
        }

        // 3. HEAD & SNOUT (Longer for predators)
        const headY = state?.mode === 'eat' ? 1 : -2;
        const headX = 3;
        ctx.fillStyle = bodyColor;
        ctx.fillRect(headX, headY, 3, 3); // Head
        ctx.fillRect(headX + 2, headY + 1, 2, 1); // Snout
        ctx.fillStyle = '#111'; // Nose
        ctx.fillRect(headX + 3, headY + 1, 1, 1);
        // Ears
        ctx.fillRect(headX, headY - 1, 1, 1);

        // 4. TAIL (Bushy)
        ctx.fillStyle = shadowColor;
        ctx.fillRect(-5, -1, 2, 2);
        ctx.fillRect(-6, 0, 1, 2);

        ctx.restore();
    }

    drawPoop(ctx, t, v, entity, time) {
        ctx.save();
        ctx.translate(t.x, t.y);

        ctx.fillStyle = '#4e342e'; // Dark brown
        ctx.fillRect(-1, 0, 2, 1);
        ctx.fillRect(0, -1, 1, 1); // Peak

        // Highlights for texture
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(-1, 0, 1, 1);

        ctx.restore();
    }

    drawFlower(ctx, t, v, entity, time, wind) {
        const quality = v.quality || 0.5;
        const isWithered = quality < 0.4;
        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };

        // Swaying (Withered flowers sway more rigidly or less)
        const osc = Math.sin(time * 0.006 + (t.x * 0.15)) * (isWithered ? 0.3 : 0.5);
        const lean = (wv.x * 5 + osc) * 0.15;

        // 1. Stem (Healthy: Dark Green | Withered: Yellowish Brown)
        ctx.fillStyle = isWithered ? '#8d6e63' : '#2e7d32';
        ctx.fillRect(t.x, t.y, 1, 1);
        ctx.fillRect(t.x + lean * 0.5, t.y - 1, 1, 1);

        // 2. Petals (Vibrant or Desaturated)
        const px = t.x + lean;
        const py = t.y - 2;

        let petalColor = v.color;
        if (isWithered) {
            // Desaturate the color manually for withered look
            petalColor = '#a0a0a0'; // Grayish dead look
        }
        ctx.fillStyle = petalColor;

        // Size scales with quality
        const s = quality > 0.6 ? 1 : 0;

        // Cross shape (+)
        ctx.fillRect(px, py, 1, 1); // Center
        ctx.fillRect(px - 1, py, 1, 1); // West
        ctx.fillRect(px + 1, py, 1, 1); // East
        ctx.fillRect(px, py - 1, 1, 1); // North
        if (s > 0) ctx.fillRect(px, py + 1, 1, 1); // South 

        // 3. Center (Pollen - Dulls out when withered)
        ctx.fillStyle = isWithered ? '#d4bd8a' : '#ffeb3b';
        ctx.fillRect(px, py, 1, 1);
    }

    drawTree(ctx, t, v, entity, time, wind) {
        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };
        const size = v.size || 5; // 5 ~ 10
        const isWithered = v.isWithered;

        // 흔들림 연산도 정수화하여 도트 픽셀 유지
        const osc = Math.sin(time * 0.003 + t.x * 0.1) * (size * 0.1);
        const sway = Math.floor((wv.x * 1.5) + osc);

        ctx.save();
        ctx.translate(Math.floor(t.x), Math.floor(t.y));

        // 1. 나무 기둥 (Trunk) - 도트 블록
        ctx.fillStyle = isWithered ? '#5d4037' : '#4e342e';
        const trunkW = Math.max(1, Math.floor(size / 3));
        const trunkH = size;
        ctx.fillRect(-Math.floor(trunkW / 2), -trunkH, trunkW, trunkH);

        ctx.translate(sway, -trunkH);

        // 2. 잎사귀 (Leaves) - 픽셀 사각형 조합으로 도트 그래픽 구현
        const cSize = isWithered ? Math.floor(size * 0.7) : size;

        if (cSize > 0) {
            ctx.fillStyle = this.adjustColor(v.color, -20); // 그림자
            ctx.fillRect(-Math.floor(cSize / 2), -Math.floor(cSize * 0.6), cSize, Math.floor(cSize * 0.8));

            ctx.fillStyle = v.color; // 메인
            ctx.fillRect(-Math.floor(cSize / 2) + 1, -Math.floor(cSize * 0.8), cSize - 2, Math.floor(cSize * 0.8));
            ctx.fillRect(-Math.floor(cSize / 2) - 1, -Math.floor(cSize * 0.5), cSize + 2, Math.floor(cSize * 0.5));

            // 시들지 않았을 때만 싱싱한 하이라이트 픽셀 표시
            if (!isWithered) {
                ctx.fillStyle = this.adjustColor(v.color, 30);
                ctx.fillRect(-Math.floor(cSize / 4), -Math.floor(cSize * 0.9), Math.floor(cSize / 2), 2);
                ctx.fillRect(-Math.floor(cSize / 2), -Math.floor(cSize * 0.6), 2, 2);
            }
        }

        // 3. 열매 / 벌집 (픽셀형 - 시들었을 경우 열리지 않음)
        if (v.treeType === 'fruit' && !isWithered) {
            ctx.fillStyle = '#e53935';
            ctx.fillRect(-Math.floor(cSize * 0.3), -Math.floor(cSize * 0.2), 2, 2);
            ctx.fillRect(Math.floor(cSize * 0.2), -Math.floor(cSize * 0.5), 2, 2);
            ctx.fillRect(-Math.floor(cSize * 0.1), -Math.floor(cSize * 0.7), 2, 2);
        } else if (v.treeType === 'beehive' && !isWithered) {
            ctx.fillStyle = '#fbc02d';
            ctx.fillRect(Math.floor(trunkW / 2) + 1, -Math.floor(size * 0.3), 3, 3);
            ctx.fillStyle = '#f57f17';
            ctx.fillRect(Math.floor(trunkW / 2) + 1, -Math.floor(size * 0.3) + 1, 3, 1);
        }
        ctx.restore();
    }

    drawBee(ctx, t, v, entity, time) {
        ctx.save();
        ctx.translate(Math.floor(t.x), Math.floor(t.y));

        // 방향 전환 (좌/우)
        if (t.vx !== undefined && Math.abs(t.vx) > 0.1) {
            ctx.scale(t.vx < 0 ? -1 : 1, 1);
        }

        const role = v.role || 'worker';
        if (role === 'larva') {
            ctx.fillStyle = '#fff9c4';
            ctx.fillRect(0, 0, 2, 1); // 2px 크기 애벌레
        } else if (role === 'queen') {
            ctx.fillStyle = '#ffb300'; // 몸통
            ctx.fillRect(-1, -1, 3, 2); // 3x2 px 여왕
            ctx.fillStyle = '#212121';
            ctx.fillRect(0, -1, 1, 2);
        } else {
            // 리얼 픽셀 사이즈 일벌 (2x1)
            const hover = Math.sin(time * 0.05 + t.x) > 0 ? 1 : 0;
            ctx.translate(0, hover);

            // 투명한 날개 1px
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(0, -1, 1, 1);

            // 노란/검정 몸통 2px
            ctx.fillStyle = '#fbc02d';
            ctx.fillRect(-1, 0, 1, 1);
            ctx.fillStyle = '#212121';
            ctx.fillRect(0, 0, 1, 1);
        }
        ctx.restore();
    }

    adjustColor(color, amount) {
        const match = color.match(/\d+/g);
        if (!match) return color;
        const [r, g, b] = match.map(Number);
        const nr = Math.min(255, Math.max(0, r + amount));
        const ng = Math.min(255, Math.max(0, g + amount));
        const nb = Math.min(255, Math.max(0, b + amount));
        return `rgb(${nr},${ng},${nb})`;
    }
}