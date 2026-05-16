import ObjectPool from '../../../utils/ObjectPool.js';
import { BIOME_PROPERTIES_MAP } from '../../../world/TerrainGen.js';

/**
 * ⏳ HUDOverlayRenderer
 * 상단 HUD, 마우스 툴팁, 플로팅 텍스트 등 Screen Space UI 렌더링을 담당합니다.
 * RenderCoordinator.js에서 SRP에 따라 분리되었습니다.
 */
export default class HUDOverlayRenderer {
    constructor(coordinator) {
        this.rc = coordinator;
        this.engine = coordinator.engine;
        this.entityManager = coordinator.entityManager;

        this.villageLabelCache = new Map();
        this.floatingTexts = [];
        this.textPool = new ObjectPool(
            () => ({}),
            (t) => {
                for (const key in t) delete t[key];
            },
            50
        );
    }

    render(ctx) {
        const engine = this.engine;
        const camera = engine.camera;

        this.renderTimeHUD(ctx);

        if (engine.viewFlags.fertilityValue && engine.inputSystem?.mouseWorld) {
            this.renderFertilityTooltip(ctx);
        }

        if ((engine.viewFlags.showNames || (engine.activeTool?.id === 'inspect_entity')) && engine.inputSystem?.mouseWorld) {
            this.renderEntityNamesTooltip(ctx);
        }

        if (engine.viewFlags.village || engine.viewFlags.showVillageInfo) {
            this.renderVillageView(ctx);
        }

        if (engine.viewFlags.zone || engine.viewFlags.showZones) {
            this.renderZoneView(ctx);
        }

        this.updateAndRenderFloatingTexts(ctx, performance.now());
    }

    renderTimeHUD(ctx) {
        const timeStr = this.engine.timeSystem.getFormattedTime();
        const w = 120, h = 40;
        const x = (this.rc.offscreenCanvas.width / 2) - (w / 2);
        const y = 20;

        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.fillStyle = 'rgba(20, 20, 25, 0.7)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        this.drawRoundedRect(ctx, x, y, w, h, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#00e676';
        ctx.fillStyle = '#00e676';
        ctx.fillText(timeStr, x + w / 2, y + h / 2 + 2);
        ctx.restore();
    }

    renderFertilityTooltip(ctx) {
        const worldPos = this.engine.inputSystem.mouseWorld;
        const screenPos = this.engine.inputSystem.mouseScreen;
        const idx = this.engine.terrainGen.getIndex(worldPos.x, worldPos.y);

        if (this.engine.terrainGen.isValidIndex(idx)) {
            const fert = this.engine.terrainGen.fertilityBuffer[idx] / 100;
            const text = `FERTILITY: ${(fert * 100).toFixed(1)}%`;
            ctx.font = 'bold 14px "Courier New", monospace';
            const metrics = ctx.measureText(text);
            const padding = 8, w = metrics.width + padding * 2, h = 24;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.fillRect(screenPos.x + 15, screenPos.y + 15, w, h);
            ctx.strokeRect(screenPos.x + 15, screenPos.y + 15, w, h);

            ctx.fillStyle = '#00ff00';
            ctx.fillText(text, screenPos.x + 15 + padding, screenPos.y + 15 + 18);

            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(screenPos.x + 15, screenPos.y + 15 + h, w, 4);
            const barColor = fert < 0.2 ? '#ff5252' : (fert < 0.6 ? '#ffeb3b' : '#00e676');
            ctx.fillStyle = barColor;
            ctx.fillRect(screenPos.x + 15, screenPos.y + 15 + h, w * fert, 4);
        }
    }

    renderEntityNamesTooltip(ctx) {
        const worldPos = this.engine.inputSystem.mouseWorld;
        const screenPos = this.engine.inputSystem.mouseScreen;
        let yOffset = 0;
        ctx.font = 'bold 12px "Inter", sans-serif';

        const drawBox = (text, icon, color = '#ffffff') => {
            const fullText = `${icon} ${text}`;
            const metrics = ctx.measureText(fullText);
            const padding = 8, w = metrics.width + padding * 2, h = 24;
            const boxX = screenPos.x + 15, boxY = screenPos.y + 15 + yOffset;

            ctx.save();
            ctx.fillStyle = 'rgba(10, 15, 20, 0.9)';
            ctx.strokeStyle = color + '88';
            ctx.lineWidth = 1.5;
            this.drawRoundedRect(ctx, boxX, boxY, w, h, 6);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = color;
            ctx.fillText(fullText, boxX + padding, boxY + 16);
            ctx.restore();
            yOffset += h + 6;
        };

        const ix = Math.floor(worldPos.x), iy = Math.floor(worldPos.y);
        if (this.engine.terrainGen.isValidIndex(this.engine.terrainGen.getIndex(ix, iy))) {
            const biomeId = this.engine.terrainGen.getBiomeAt(ix, iy);
            const biomeName = BIOME_PROPERTIES_MAP.get(biomeId)?.name || 'Unknown';
            drawBox(String(biomeName).toUpperCase(), '🌍', '#4fc3f7');
        }

        const radius = 20;
        const nearbyIds = this.engine.spatialHash?.queryRect(worldPos.x - radius, worldPos.y - radius, radius * 2, radius * 2) || [];
        for (const id of nearbyIds) {
            const entity = this.entityManager.entities.get(id);
            const transform = entity?.components.get('Transform');
            if (transform && Math.hypot(transform.x - worldPos.x, transform.y - worldPos.y) <= radius) {
                let name = 'Unknown';
                if (entity.components.has('Resource')) name = entity.components.get('Resource').type;
                else if (entity.components.has('Tree')) name = 'Tree';
                else if (entity.components.has('Plant')) name = 'Plant';
                drawBox(String(name).toUpperCase(), '🏷️');
            }
        }
    }

    renderVillageView(ctx) {
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs) return;

        const camera = this.engine.camera;
        ctx.save();
        for (const [id, village] of vs.villages) {
            const dist = 300;
            if (village.centerX < camera.x - dist || village.centerX > camera.x + (camera.width / camera.zoom) + dist ||
                village.centerY < camera.y - dist || village.centerY > camera.y + (camera.height / camera.zoom) + dist) continue;

            const pop = village.members.size, loyalty = Math.floor(village.loyalty || 100);
            const wood = Math.floor(village.resources?.wood || 0), food = Math.floor(village.resources?.food || 0);
            const cacheKey = `${id}:${pop}:${loyalty}:${wood}:${food}:${camera.zoom > 0.8 ? 'high' : 'low'}`;
            let cached = this.villageLabelCache.get(id);

            if (!cached || cached.key !== cacheKey) {
                cached = this.createVillageLabelSprite(village, pop, loyalty, wood, food);
                cached.key = cacheKey;
                this.villageLabelCache.set(id, cached);
            }

            const screenX = (village.centerX - camera.x) * camera.zoom;
            const screenY = (village.centerY - camera.y) * camera.zoom;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            const labelScale = Math.max(0.4, Math.min(1.0, camera.zoom * 2));
            const dw = cached.width * labelScale, dh = cached.height * labelScale;
            ctx.drawImage(cached.canvas, screenX - dw / 2, screenY - dh - (25 * labelScale), dw, dh);

            const loyaltyColor = loyalty > 70 ? '#4caf50' : (loyalty > 30 ? '#ffeb3b' : '#ff5252');
            ctx.beginPath(); ctx.arc(screenX, screenY, 5 * camera.zoom, 0, Math.PI * 2);
            ctx.fillStyle = loyaltyColor; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.restore();
    }

    createVillageLabelSprite(village, pop, loyalty, wood, food) {
        const tempCanvas = document.createElement('canvas');
        const tctx = tempCanvas.getContext('2d');
        const lines = [`🏘️ ${village.name}`, `👥 Pop: ${pop} | 🚩 Loyalty: ${loyalty}%`, `🪵 W: ${wood} | 🍖 F: ${food}`];
        tctx.font = 'bold 11px "Inter", sans-serif';
        const maxWidth = Math.max(...lines.map(l => tctx.measureText(l).width));
        const padding = 12, boxWidth = maxWidth + padding * 2, boxHeight = lines.length * 16 + padding * 2;
        tempCanvas.width = boxWidth + 4; tempCanvas.height = boxHeight + 4;
        tctx.font = 'bold 11px "Inter", sans-serif'; tctx.translate(2, 2);
        const loyaltyColor = loyalty > 70 ? '#4caf50' : (loyalty > 30 ? '#ffeb3b' : '#ff5252');
        tctx.fillStyle = 'rgba(15, 20, 25, 0.95)'; tctx.strokeStyle = loyaltyColor + 'aa'; tctx.lineWidth = 2;
        this.drawRoundedRect(tctx, 0, 0, boxWidth, boxHeight, 10);
        tctx.fill(); tctx.stroke();
        tctx.fillStyle = 'rgba(255,255,255,0.1)'; tctx.fillRect(padding, boxHeight - 8, boxWidth - padding * 2, 3);
        tctx.fillStyle = loyaltyColor; tctx.fillRect(padding, boxHeight - 8, (boxWidth - padding * 2) * (loyalty / 100), 3);
        tctx.fillStyle = '#ffffff'; tctx.textAlign = 'left'; tctx.textBaseline = 'top';
        lines.forEach((line, i) => tctx.fillText(line, padding, padding + i * 16));
        return { canvas: tempCanvas, width: tempCanvas.width, height: tempCanvas.height };
    }

    renderZoneView(ctx) {
        const zm = this.engine.systemManager?.zoneManager;
        if (!zm?.zones) return;
        ctx.save();
        const colors = { 'residential': '#4fc3f7', 'lumber': '#8d6e63', 'mining': '#9e9e9e', 'agricultural': '#81c784' };
        for (const [id, zone] of zm.zones) {
            const sx = (zone.bounds.minX - this.engine.camera.x) * this.engine.camera.zoom;
            const sy = (zone.bounds.minY - this.engine.camera.y) * this.engine.camera.zoom;
            const sw = zone.bounds.width * this.engine.camera.zoom;
            const sh = zone.bounds.height * this.engine.camera.zoom;
            if (sx + sw < 0 || sx > this.rc.offscreenCanvas.width || sy + sh < 0 || sy > this.rc.offscreenCanvas.height) continue;
            const color = colors[zone.type] || '#ffffff';
            ctx.strokeStyle = color + '88'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
            ctx.strokeRect(sx, sy, sw, sh); ctx.setLineDash([]);
            ctx.font = 'bold 10px "Inter", sans-serif';
            const label = ` ${zone.type.toUpperCase()} `;
            const metrics = ctx.measureText(label);
            ctx.fillStyle = color; ctx.fillRect(sx, sy - 18, metrics.width + 4, 18);
            ctx.fillStyle = '#000'; ctx.fillText(label, sx + 2, sy - 5);
        }
        ctx.restore();
    }

    spawnFloatingText(x, y, text, color = '#ffffff', options = {}) {
        const t = this.textPool.get();
        Object.assign(t, { x, y, text, color, vx: options.vx || (Math.random() - 0.5) * 0.5, vy: options.vy || -1.5, life: options.life || 1.2, maxLife: options.life || 1.2, size: options.size || 14, alpha: 1.0, isScreenSpace: options.isScreenSpace || false });
        this.floatingTexts.push(t);
    }

    updateAndRenderFloatingTexts(ctx, time) {
        const dt = 0.016;
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.x += t.vx; t.y += t.vy; t.vy += 0.05;
            t.life -= dt; t.alpha = Math.max(0, t.life / t.maxLife);
            if (t.life <= 0) { this.floatingTexts.splice(i, 1); this.textPool.release(t); continue; }
            ctx.globalAlpha = t.alpha; ctx.font = `bold ${t.size}px "Courier New", monospace`;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; ctx.lineWidth = 3; ctx.strokeText(t.text, t.x, t.y);
            ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
    }

    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius); ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius); ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
    }

    clearCaches() {
        this.villageLabelCache.forEach(item => { item.canvas.width = 1; item.canvas.height = 1; });
        this.villageLabelCache.clear();
    }
}
