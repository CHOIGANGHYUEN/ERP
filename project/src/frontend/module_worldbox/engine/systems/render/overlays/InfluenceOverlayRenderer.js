/**
 * 👑 InfluenceOverlayRenderer
 * 국가 영향력 및 영토 오버레이 렌더링을 담당합니다.
 * RenderCoordinator.js에서 SRP에 따라 분리되었습니다.
 */
export default class InfluenceOverlayRenderer {
    constructor(coordinator) {
        this.rc = coordinator;
        this.engine = coordinator.engine;
        
        this.influenceCanvas = document.createElement('canvas');
        this.influenceCtx = this.influenceCanvas.getContext('2d');
        this.isInfluenceDirty = true;
        this.lastTerritoryHash = '';
        this.colorCache = new Map();
    }

    render(ctx) {
        const nationSystem = this.engine.systemManager?.nationSystem;
        const vs = this.engine.systemManager?.villageSystem;
        if (!nationSystem || !vs) return;

        let currentHash = '';
        for (const nation of nationSystem.nations.values()) {
            currentHash += `${nation.id}:${nation.villages.size}:${nation.color}|`;
        }
        let totalTerritoryCount = 0;
        for (const village of vs.villages.values()) totalTerritoryCount += village.territory?.size || 0;
        currentHash += `T:${totalTerritoryCount}`;

        if (this.lastTerritoryHash !== currentHash) {
            this.isInfluenceDirty = true;
            this.lastTerritoryHash = currentHash;
        }

        if (this.isInfluenceDirty) {
            this.updateInfluenceBuffer(nationSystem, vs);
            this.isInfluenceDirty = false;
        }

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(this.influenceCanvas, 0, 0);
        this.renderNationLabels(ctx, nationSystem, vs);
        ctx.restore();
    }

    updateInfluenceBuffer(nationSystem, vs) {
        const tileSize = 16, worldW = this.engine.mapWidth || 2000, worldH = this.engine.mapHeight || 2000;
        if (this.influenceCanvas.width !== worldW || this.influenceCanvas.height !== worldH) {
            this.influenceCanvas.width = worldW; this.influenceCanvas.height = worldH;
        }
        const ictx = this.influenceCtx;
        ictx.clearRect(0, 0, worldW, worldH);

        const parseColor = (hex) => {
            if (this.colorCache.has(hex)) return this.colorCache.get(hex);
            const safeHex = String(hex || '#ffffff').replace('#', '');
            const expanded = safeHex.length === 3 ? safeHex.split('').map(ch => ch + ch).join('') : safeHex.padEnd(6, 'f').slice(0, 6);
            const res = { r: parseInt(expanded.slice(0, 2), 16) || 255, g: parseInt(expanded.slice(2, 4), 16) || 255, b: parseInt(expanded.slice(4, 6), 16) || 255 };
            this.colorCache.set(hex, res); return res;
        };

        ictx.save();
        for (const nation of nationSystem.nations.values()) {
            const { r, g, b } = parseColor(nation.color);
            for (const villageId of nation.villages) {
                const village = vs.getVillage(villageId);
                if (!village) continue;
                const radius = Math.max(96, 120 + Math.sqrt(village.members?.size || 1) * 12);
                const grad = ictx.createRadialGradient(village.centerX, village.centerY, radius * 0.1, village.centerX, village.centerY, radius);
                grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.15)`); grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                ictx.fillStyle = grad; ictx.beginPath(); ictx.arc(village.centerX, village.centerY, radius, 0, Math.PI * 2); ictx.fill();
                if (village.territory) {
                    ictx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.25)`;
                    for (const key of village.territory) {
                        const tx = key & 0xFFFF, ty = key >> 16;
                        ictx.fillRect(tx * tileSize + 1, ty * tileSize + 1, tileSize - 2, tileSize - 2);
                    }
                }
            }
        }
        ictx.restore();
    }

    renderNationLabels(ctx, nationSystem, vs) {
        const camera = this.engine.camera;
        for (const nation of nationSystem.nations.values()) {
            const color = this.colorCache.get(nation.color) || { r: 255, g: 255, b: 255 };
            for (const villageId of nation.villages) {
                const village = vs.getVillage(villageId);
                if (village && nation.capitalId === village.id) {
                    const sx = (village.centerX - camera.x) * camera.zoom, sy = (village.centerY - camera.y) * camera.zoom;
                    if (sx > 0 && sx < this.engine.width && sy > 0 && sy < this.engine.height) {
                        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.font = `${Math.max(16, 24 * camera.zoom)}px serif`; ctx.textAlign = 'center';
                        ctx.shadowBlur = 10; ctx.shadowColor = 'gold'; ctx.fillText('👑', sx, sy - 20 * camera.zoom); ctx.restore();
                    }
                }
            }
            if (nation.territorySize > 0 && camera.zoom > 0.25) {
                const sx = (nation.visualCentroidX - camera.x) * camera.zoom, sy = (nation.visualCentroidY - camera.y) * camera.zoom;
                if (sx > 0 && sx < this.engine.width && sy > 0 && sy < this.engine.height) {
                    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.font = `bold ${Math.max(14, 20 * camera.zoom)}px "Inter", sans-serif`; ctx.textAlign = 'center';
                    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`; ctx.lineWidth = 4;
                    ctx.strokeText(nation.name.toUpperCase(), sx, sy); ctx.fillText(nation.name.toUpperCase(), sx, sy); ctx.restore();
                }
            }
        }
    }

    clearCaches() {
        this.colorCache.clear();
        this.isInfluenceDirty = true;
        this.lastTerritoryHash = '';
    }
}
