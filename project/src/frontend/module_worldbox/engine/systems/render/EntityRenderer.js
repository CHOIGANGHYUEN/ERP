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

            if (t && v) {
                // Visual Selection Feedback
                if (id === this.engine.selectedId) {
                    ctx.save();
                    ctx.beginPath(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 2;
                    ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); ctx.stroke();
                    ctx.restore();
                }

                const type = v.type;
                const isWithered = v.isWithered || false;

                // Use High-Res drawing methods
                if (type === 'sheep') this.drawSheep(ctx, t, v, entity, time);
                else if (type === 'cow') this.drawCow(ctx, t, v, entity, time);
                else if (type === 'human') this.drawHuman(ctx, t, v, entity, time);
                else if (['wolf', 'hyena', 'wild_dog'].includes(type)) this.drawPredator(ctx, t, v, entity, time);
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

        for (const p of particles) {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 1.5, 1.5);
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

    // --- 🐾 ANIMAL & HUMAN METHODS (Remains Dot-based for animation) ---

    drawSheep(ctx, t, v, entity, time) {
        ctx.save();
        ctx.translate(Math.floor(t.x), Math.floor(t.y));
        if (t.vx !== undefined && Math.abs(t.vx) > 0.01) ctx.scale(t.vx < 0 ? -1 : 1, 1);
        const s = entity.components.get('Life')?.isBaby ? 0.4 : 0.7;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-3 * s, -4 * s, 6 * s, 4 * s); ctx.fillRect(-4 * s, -3 * s, 8 * s, 2 * s);
        ctx.fillStyle = '#eeeeee'; ctx.fillRect(3 * s, -4 * s, 2 * s, 2.5 * s);
        ctx.fillStyle = '#000000'; ctx.fillRect(4.5 * s, -3 * s, 0.5 * s, 0.5 * s);
        ctx.fillStyle = '#bdbdbd'; ctx.fillRect(-2 * s, 0, 0.8 * s, 1.2 * s); ctx.fillRect(1.5 * s, 0, 0.8 * s, 1.2 * s);
        ctx.restore();
    }

    drawCow(ctx, t, v, entity, time) {
        ctx.save();
        ctx.translate(Math.floor(t.x), Math.floor(t.y));
        if (t.vx !== undefined && Math.abs(t.vx) > 0.01) ctx.scale(t.vx < 0 ? -1 : 1, 1);
        const s = entity.components.get('Life')?.isBaby ? 0.5 : 0.8;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-4 * s, -5 * s, 8 * s, 5 * s);
        ctx.fillStyle = '#212121'; ctx.fillRect(-1 * s, -5 * s, 2 * s, 2 * s); ctx.fillRect(2 * s, -3 * s, 2 * s, 1.5 * s);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(4 * s, -5 * s, 3.5 * s, 3.5 * s);
        ctx.fillStyle = '#ffca28'; ctx.fillRect(6 * s, -2.5 * s, 2 * s, 1.5 * s);
        ctx.fillStyle = '#4e342e'; ctx.fillRect(-3 * s, 0, 1 * s, 1.5 * s); ctx.fillRect(3 * s, 0, 1 * s, 1.5 * s);
        ctx.restore();
    }

    drawPredator(ctx, t, v, entity, time) {
        ctx.save();
        ctx.translate(Math.floor(t.x), Math.floor(t.y));
        if (t.vx !== undefined && Math.abs(t.vx) > 0.01) ctx.scale(t.vx < 0 ? -1 : 1, 1);
        const s = entity.components.get('Life')?.isBaby ? 0.4 : 0.7;
        let mainColor = v.type === 'hyena' ? '#a1887f' : (v.type === 'wild_dog' ? '#8d6e63' : '#757575');
        ctx.fillStyle = mainColor; ctx.fillRect(-4 * s, -3 * s, 7 * s, 3 * s);
        ctx.fillRect(3 * s, -4.5 * s, 2.5 * s, 2.5 * s); ctx.fillRect(5.5 * s, -3.5 * s, 1.5 * s, 1.5 * s);
        ctx.fillStyle = '#ff1744'; ctx.fillRect(4.5 * s, -3.5 * s, 0.5 * s, 0.5 * s);
        ctx.restore();
    }

    drawHuman(ctx, t, v, entity, time) {
        ctx.save();
        ctx.translate(Math.floor(t.x), Math.floor(t.y));
        if (t.vx !== undefined && Math.abs(t.vx) > 0.01) ctx.scale(t.vx < 0 ? -1 : 1, 1);
        const s = entity.components.get('Life')?.isBaby ? 0.4 : 0.7;
        ctx.fillStyle = '#1e88e5'; ctx.fillRect(-2 * s, -6 * s, 4 * s, 6 * s);
        ctx.fillStyle = '#ffccbc'; ctx.fillRect(-1.5 * s, -9 * s, 3 * s, 3 * s);
        ctx.fillStyle = '#3e2723'; ctx.fillRect(-1.5 * s, -10 * s, 3 * s, 1.5 * s);
        ctx.fillStyle = '#37474f'; ctx.fillRect(-2 * s, 0, 1.5 * s, 2.5 * s); ctx.fillRect(0.5 * s, 0, 1.5 * s, 2.5 * s);
        ctx.restore();
    }

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

    adjustColor(color, amount) {
        const match = color.match(/\d+/g); if (!match) return color;
        const [r, g, b] = match.map(Number);
        return `rgb(${Math.min(255, Math.max(0, r + amount))},${Math.min(255, Math.max(0, g + amount))},${Math.min(255, Math.max(0, b + amount))})`;
    }
}