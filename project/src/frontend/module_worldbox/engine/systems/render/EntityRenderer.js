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
                } else if (v.type === 'poop') {
                    this.drawPoop(ctx, t, v, entity, time);
                } else if (v.icon) {
                    ctx.font = `${v.size || 10}px serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(v.icon, t.x, t.y);
                } else if (r && r.isGrass) {
                    // NATURAL PERLIN WIND GUSTS
                    const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };
                    const sway = wv.x;
                    const bendY = Math.abs(sway) * 0.3;
                    
                    const baseColor = v.color;
                    const darkColor = this.adjustColor(baseColor, -20);

                    // Root
                    ctx.fillStyle = darkColor;
                    ctx.fillRect(t.x, t.y, 1, 1);
                    
                    // Blades
                    ctx.fillStyle = baseColor;
                    ctx.fillRect(t.x + (sway * 0.6) - 1, t.y - 1 + bendY, 1, 1);
                    ctx.fillRect(t.x + sway + 1, t.y - 1 + bendY, 1, 1);
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