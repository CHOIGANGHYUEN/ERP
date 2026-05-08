import System from '../../core/System.js';
import { BIOME_PROPERTIES_MAP } from '../../world/TerrainGen.js';
import ObjectPool from '../../utils/ObjectPool.js';

/**
 * 🖼️ RenderCoordinator (렌더링 총괄 시스템)
 * 오프스크린 캔버스를 활용한 더블 버퍼링 기법을 통해
 * 렌더링 병목 현상을 해결하고 프레임 안정성을 확보합니다.
 */
export default class RenderCoordinator extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.villageLabelCache = new Map(); // 🏘️ Label Sprite Cache

        // 1. 🚀 가상의 도화지(Offscreen Canvas) 생성 및 해상도 캡핑 (4K 방지)
        this.maxResW = 1920;
        this.maxResH = 1080;
        this.updateResolution(engine.width, engine.height);

        this.offCtx = this.offscreenCanvas.getContext('2d', { alpha: false });

        // 🚀 [Expert Optimization] Floating Text Pooling
        this.floatingTexts = [];
        this.textPool = new ObjectPool(
            () => ({}),
            (t) => {
                for (const key in t) delete t[key];
            },
            50
        );

        this.eventBus.on('SPAWN_FLOATING_TEXT', (data) => {
            this.spawnFloatingText(data.x, data.y, data.text, data.color, data.options);
        });

        // 🗺️ [Expert Optimization] Offscreen Buffers for Territory/Influence
        this.influenceCanvas = document.createElement('canvas');
        this.influenceCtx = this.influenceCanvas.getContext('2d');
        this.isInfluenceDirty = true;
        this.lastTerritoryHash = '';
        this.colorCache = new Map();
    }

    updateResolution(w, h) {
        if (!this.offscreenCanvas) this.offscreenCanvas = document.createElement('canvas');

        // 🛡️ [Memory Guard] 해상도가 너무 높으면 성능/메모리 보호를 위해 캡핑
        this.offscreenCanvas.width = Math.min(w, this.maxResW);
        this.offscreenCanvas.height = Math.min(h, this.maxResH);

        // Influence canvas size matches world size, not just screen size
        if (this.engine) {
            const worldW = this.engine.mapWidth || 2000;
            const worldH = this.engine.mapHeight || 2000;
            if (this.influenceCanvas) {
                this.influenceCanvas.width = worldW;
                this.influenceCanvas.height = worldH;
                this.isInfluenceDirty = true;
            }
        }
    }

    /**
     * 화면 크기가 변경될 때 오프스크린 캔버스 크기도 동기화합니다.
     */
    resize(width, height) {
        this.updateResolution(width, height);
    }

    /** 🧹 [Expert Cleanup] Memory Guard */
    clearCaches() {
        this.villageLabelCache.forEach(item => {
            item.canvas.width = 1;
            item.canvas.height = 1;
        });
        this.villageLabelCache.clear();
        this.colorCache.clear();
        this.isInfluenceDirty = true;
        this.lastTerritoryHash = '';
    }

    /**
     * 렌더링 통합 루프
     * 가상 도화지에 모든 그림을 완성한 뒤 메인 캔버스에 도장을 찍습니다.
     */
    render(mainCtx) {
        const engine = this.engine;
        const camera = engine.camera;
        const offCtx = this.offCtx;

        // 2. 🚀 가상 도화지 지우기 (초기화)
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.fillStyle = '#000';
        offCtx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

        // 3. 🚀 카메라 트랜스폼 적용 (줌/이동)
        offCtx.save();
        offCtx.imageSmoothingEnabled = false;
        offCtx.scale(camera.zoom, camera.zoom);
        offCtx.translate(-camera.x, -camera.y);

        // --- 레이어별 그리기 작업 ---

        // [레이어 1] 지형 (Terrain) - 청크 기반 렌더링 및 Culling 적용
        engine.chunkManager.render(offCtx, camera);

        // Nation influence belongs under entities so workers and buildings stay readable.
        if (engine.viewFlags.influence || engine.viewFlags.NATIONTILE || engine.viewFlags.nation) {
            this.renderInfluenceOverlay(offCtx);
        }

        // [레이어 2] 엔티티 및 자원 (Entities)
        engine.renderer.render(
            offCtx,
            this.entityManager,
            engine.particleSystem.particles,
            performance.now(),
            engine.wind
        );

        // [바람 뷰 오버레이]
        if (engine.viewFlags.wind) {
            this.renderWindOverlay(offCtx);
        }
        offCtx.restore();

        // [레이어 3] 마을 및 구역 타일 오버레이 (World Space)
        const zm = engine.systemManager?.zoneManager;
        if (zm) {
            zm.render(offCtx, camera);
        }

        // [레이어 4] UI 및 툴팁 (Screen Space)
        this.renderTimeHUD(offCtx); // ⏳ 시간 HUD 추가

        if (engine.viewFlags.fertilityValue && engine.inputSystem && engine.inputSystem.mouseWorld) {
            this.renderFertilityTooltip(offCtx);
        }

        if ((engine.viewFlags.showNames || (engine.activeTool && engine.activeTool.id === 'inspect_entity')) && engine.inputSystem && engine.inputSystem.mouseWorld) {
            this.renderEntityNamesTooltip(offCtx);
        }

        if (engine.viewFlags.village || engine.viewFlags.showVillageInfo) {
            this.renderVillageView(offCtx);
        }

        if (engine.viewFlags.zone || engine.viewFlags.showZones) {
            this.renderZoneView(offCtx);
        }

        if (engine.viewFlags.debugAI) {
            this.renderDebugAI(offCtx);
        }

        // [레이어 5] 플로팅 텍스트 (World Space or Screen Space)
        this.updateAndRenderFloatingTexts(offCtx, performance.now());

        // 4. 🚀 [대미의 장식] 완성된 가상 도화지를 메인 화면에 한 번에 복사!
        // 🛡️ [Scaling Fix] 캡핑된 해상도를 메인 캔버스 크기에 맞춰 확대/축소하여 출력
        mainCtx.setTransform(1, 0, 0, 1, 0, 0);
        mainCtx.drawImage(this.offscreenCanvas, 0, 0, engine.width, engine.height);
    }

    /**
     * ⏳ [Expert Design] 상단 중앙 시간 표시 HUD
     */
    renderTimeHUD(ctx) {
        const timeStr = this.engine.timeSystem.getFormattedTime();
        const w = 120;
        const h = 40;
        const x = (this.offscreenCanvas.width / 2) - (w / 2);
        const y = 20;

        // 1. 글래스모피즘 배경
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.fillStyle = 'rgba(20, 20, 25, 0.7)'; // 어두운 반투명 배경
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;

        // 둥근 사각형 그리기
        this.drawRoundedRect(ctx, x, y, w, h, 8);
        ctx.fill();
        ctx.stroke();

        // 2. 디지털 시간 텍스트
        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 텍스트 광원 효과
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#00e676';
        ctx.fillStyle = '#00e676'; // 사이버틱한 녹색
        ctx.fillText(timeStr, x + w / 2, y + h / 2 + 2);

        ctx.restore();
    }

    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    // Engine.js에 있던 툴팁 로직을 이곳으로 이관하여 통합 관리합니다.
    renderFertilityTooltip(ctx) {
        const engine = this.engine;
        const worldPos = engine.inputSystem.mouseWorld;
        const screenPos = engine.inputSystem.mouseScreen;
        if (!worldPos || !screenPos) return;

        const ix = Math.floor(worldPos.x);
        const iy = Math.floor(worldPos.y);

        if (ix >= 0 && ix < engine.mapWidth && iy >= 0 && iy < engine.mapHeight) {
            const idx = iy * engine.mapWidth + ix;
            const fertRaw = engine.terrainGen.fertilityBuffer[idx];
            const fert = fertRaw / 100; // ⚡ 0~100 정수를 0.0~1.0 소수로 정규화

            const text = `FERTILITY: ${(fert * 100).toFixed(1)}%`;
            ctx.font = 'bold 14px "Courier New", monospace';
            const metrics = ctx.measureText(text);
            const padding = 8;
            const w = metrics.width + padding * 2;
            const h = 24;

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
        const engine = this.engine;
        const worldPos = engine.inputSystem.mouseWorld;
        const screenPos = engine.inputSystem.mouseScreen;
        if (!worldPos || !screenPos) return;

        let yOffset = 0;
        ctx.font = 'bold 12px "Inter", sans-serif';

        const drawBox = (text, icon, color = '#ffffff') => {
            const fullText = `${icon} ${text}`;
            const metrics = ctx.measureText(fullText);
            const padding = 8;
            const w = metrics.width + padding * 2;
            const h = 24;

            const boxX = screenPos.x + 15;
            const boxY = screenPos.y + 15 + yOffset;

            ctx.save();
            ctx.fillStyle = 'rgba(10, 15, 20, 0.9)';
            ctx.strokeStyle = color + '88';
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            this.drawRoundedRect(ctx, boxX, boxY, w, h, 6);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.fillText(fullText, boxX + padding, boxY + 16);
            ctx.restore();
            yOffset += h + 6;
        };

        // 1. 지형 (Terrain) 이름 표시
        const ix = Math.floor(worldPos.x);
        const iy = Math.floor(worldPos.y);
        if (ix >= 0 && ix < engine.mapWidth && iy >= 0 && iy < engine.mapHeight) {
            const idx = iy * engine.mapWidth + ix;
            const biomeId = engine.terrainGen.biomeBuffer[idx];
            const biomeProps = BIOME_PROPERTIES_MAP.get(biomeId);
            const biomeName = biomeProps ? biomeProps.name : 'Unknown';
            drawBox(String(biomeName).toUpperCase(), '🌍', '#4fc3f7');
        }

        // 2. 근처 엔티티 탐색
        const radius = 20;
        let nearbyIds = [];
        if (engine.spatialHash) {
            nearbyIds = engine.spatialHash.queryRect(worldPos.x - radius, worldPos.y - radius, radius * 2, radius * 2);
        }

        for (const id of nearbyIds) {
            const entity = engine.entityManager.entities.get(id);
            if (!entity) continue;

            const transform = entity.components.get('Transform');
            if (!transform) continue;

            const dx = transform.x - worldPos.x;
            const dy = transform.y - worldPos.y;

            if (dx * dx + dy * dy <= radius * radius) {
                if (entity.components.has('Resource')) name = entity.components.get('Resource').type;
                else if (entity.components.has('Tree')) name = 'Tree';
                else if (entity.components.has('Plant')) name = 'Plant';

                // 🛑 [Safety Guard] undefined 등으로 인한 toUpperCase 에러 완벽 방지
                const safeName = String(name || 'Unknown').toUpperCase();
                drawBox(safeName, '🏷️');
            }
        }
    }

    renderVillageView(ctx) {
        const engine = this.engine;
        const vs = engine.systemManager?.villageSystem;
        if (!vs || vs.villages.size === 0) return;

        const camera = engine.camera;
        const viewRect = {
            x: camera.x,
            y: camera.y,
            w: camera.width / camera.zoom,
            h: camera.height / camera.zoom
        };

        ctx.save();

        // 🚀 [Expert Optimization] Cache Eviction (remove labels for destroyed villages)
        if (vs.villages.size < this.villageLabelCache.size) {
            for (const id of this.villageLabelCache.keys()) {
                if (!vs.villages.has(id)) this.villageLabelCache.delete(id);
            }
        }

        for (const [id, village] of vs.villages) {
            // 🚀 [Optimization] Spatial Culling
            const dist = 300; // Search radius for labels
            if (village.centerX < viewRect.x - dist || village.centerX > viewRect.x + viewRect.w + dist ||
                village.centerY < viewRect.y - dist || village.centerY > viewRect.y + viewRect.h + dist) {
                continue;
            }

            const pop = village.members.size;
            const loyalty = Math.floor(village.loyalty || 100);
            const wood = Math.floor(village.resources?.wood || 0);
            const food = Math.floor(village.resources?.food || 0);

            // 🚀 [Expert Optimization] Label Caching
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
            ctx.drawImage(cached.canvas, screenX - cached.width / 2, screenY - cached.height - 25);

            // Marker
            const loyaltyColor = loyalty > 70 ? '#4caf50' : (loyalty > 30 ? '#ffeb3b' : '#ff5252');
            ctx.beginPath();
            ctx.arc(screenX, screenY, 5 * camera.zoom, 0, Math.PI * 2);
            ctx.fillStyle = loyaltyColor;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
    }

    createVillageLabelSprite(village, pop, loyalty, wood, food) {
        const tempCanvas = document.createElement('canvas');
        const tctx = tempCanvas.getContext('2d');

        const loyaltyColor = loyalty > 70 ? '#4caf50' : (loyalty > 30 ? '#ffeb3b' : '#ff5252');
        const lines = [
            `🏘️ ${village.name}`,
            `👥 Pop: ${pop} | 🚩 Loyalty: ${loyalty}%`,
            `🪵 W: ${wood} | 🍖 F: ${food}`
        ];

        tctx.font = 'bold 11px "Inter", sans-serif';
        let maxWidth = 0;
        lines.forEach(l => {
            const w = tctx.measureText(l).width;
            if (w > maxWidth) maxWidth = w;
        });

        const padding = 12;
        const boxWidth = maxWidth + padding * 2;
        const lineHeight = 16;
        const boxHeight = lines.length * lineHeight + padding * 2;

        tempCanvas.width = boxWidth + 4;
        tempCanvas.height = boxHeight + 4;

        tctx.font = 'bold 11px "Inter", sans-serif';
        tctx.translate(2, 2);

        // Background
        tctx.fillStyle = 'rgba(15, 20, 25, 0.95)';
        tctx.strokeStyle = loyaltyColor + 'aa';
        tctx.lineWidth = 2;
        this.drawRoundedRect(tctx, 0, 0, boxWidth, boxHeight, 10);
        tctx.fill();
        tctx.stroke();

        // Loyalty Bar
        tctx.fillStyle = 'rgba(255,255,255,0.1)';
        tctx.fillRect(padding, boxHeight - 8, boxWidth - padding * 2, 3);
        tctx.fillStyle = loyaltyColor;
        tctx.fillRect(padding, boxHeight - 8, (boxWidth - padding * 2) * (loyalty / 100), 3);

        // Text
        tctx.fillStyle = '#ffffff';
        tctx.textAlign = 'left';
        tctx.textBaseline = 'top';
        lines.forEach((line, i) => {
            tctx.fillText(line, padding, padding + i * lineHeight);
        });

        return {
            canvas: tempCanvas,
            width: tempCanvas.width,
            height: tempCanvas.height
        };
    }

    renderInfluenceOverlay(ctx) {
        const nationSystem = this.engine.systemManager?.nationSystem;
        const vs = this.engine.systemManager?.villageSystem;
        if (!nationSystem || !vs) return;

        // 🚀 [Expert Optimization] Check if redraw is needed
        let currentHash = '';
        for (const nation of nationSystem.nations.values()) {
            currentHash += `${nation.id}:${nation.villages.size}:${nation.color}|`;
        }

        // Also check total territory count for more precision
        let totalTerritoryCount = 0;
        for (const [id, village] of vs.villages) {
            totalTerritoryCount += village.territory?.size || 0;
        }
        currentHash += `T:${totalTerritoryCount}`;

        if (this.lastTerritoryHash !== currentHash) {
            this.isInfluenceDirty = true;
            this.lastTerritoryHash = currentHash;
        }

        if (this.isInfluenceDirty) {
            this.updateInfluenceBuffer(nationSystem, vs);
            this.isInfluenceDirty = false;
        }

        // Draw the cached influence map
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(this.influenceCanvas, 0, 0);

        // Draw Capitals and Names (Still dynamic but lightweight)
        this.renderNationLabels(ctx, nationSystem, vs);
        ctx.restore();
    }

    updateInfluenceBuffer(nationSystem, vs) {
        const tileSize = 16;
        const worldWidth = this.engine.mapWidth || 2000;
        const worldHeight = this.engine.mapHeight || 2000;

        if (this.influenceCanvas.width !== worldWidth || this.influenceCanvas.height !== worldHeight) {
            this.influenceCanvas.width = worldWidth;
            this.influenceCanvas.height = worldHeight;
        }

        const ictx = this.influenceCtx;
        ictx.clearRect(0, 0, worldWidth, worldHeight);

        const parseColor = (hex) => {
            if (this.colorCache.has(hex)) return this.colorCache.get(hex);
            const safeHex = String(hex || '#ffffff').replace('#', '');
            const expanded = safeHex.length === 3
                ? safeHex.split('').map(ch => ch + ch).join('')
                : safeHex.padEnd(6, 'f').slice(0, 6);
            const result = {
                r: parseInt(expanded.slice(0, 2), 16) || 255,
                g: parseInt(expanded.slice(2, 4), 16) || 255,
                b: parseInt(expanded.slice(4, 6), 16) || 255
            };
            this.colorCache.set(hex, result);
            return result;
        };

        ictx.save();
        for (const nation of nationSystem.nations.values()) {
            const { r, g, b } = parseColor(nation.color);

            for (const villageId of nation.villages) {
                const village = vs.getVillage(villageId);
                if (!village) continue;

                const radius = Math.max(96, 120 + Math.sqrt(village.members?.size || 1) * 12);

                // 1. Draw influence circle (Radial Gradient)
                const grad = ictx.createRadialGradient(
                    village.centerX, village.centerY, radius * 0.1,
                    village.centerX, village.centerY, radius
                );
                grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.15)`);
                grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                ictx.fillStyle = grad;
                ictx.beginPath();
                ictx.arc(village.centerX, village.centerY, radius, 0, Math.PI * 2);
                ictx.fill();

                // 2. Draw territory tiles (Batch Fill)
                if (village.territory) {
                    ictx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.25)`;
                    for (const key of village.territory) {
                        const tx = key & 0xFFFF;
                        const ty = key >> 16;
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
                if (!village) continue;

                if (nation.capitalId === village.id) {
                    const sx = (village.centerX - camera.x) * camera.zoom;
                    const sy = (village.centerY - camera.y) * camera.zoom;
                    if (sx > 0 && sx < this.engine.width && sy > 0 && sy < this.engine.height) {
                        ctx.save();
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.font = `${Math.max(16, 24 * camera.zoom)}px serif`;
                        ctx.textAlign = 'center';
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = 'gold';
                        ctx.fillText('👑', sx, sy - 20 * camera.zoom);
                        ctx.restore();
                    }
                }
            }

            if (nation.territorySize > 0 && camera.zoom > 0.25) {
                const sx = (nation.visualCentroidX - camera.x) * camera.zoom;
                const sy = (nation.visualCentroidY - camera.y) * camera.zoom;

                if (sx > 0 && sx < this.engine.width && sy > 0 && sy < this.engine.height) {
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.font = `bold ${Math.max(14, 20 * camera.zoom)}px "Inter", sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#ffffff';
                    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`;
                    ctx.lineWidth = 4;
                    ctx.strokeText(nation.name.toUpperCase(), sx, sy);
                    ctx.fillText(nation.name.toUpperCase(), sx, sy);
                    ctx.restore();
                }
            }
        }
    }

    /** 🌬️ [Wind View] 월드 전역 바람 흐름 시각화 */
    renderWindOverlay(ctx) {
        const wind = this.engine.wind;
        const spacing = 40; // 화살표 간격
        const camera = this.engine.camera;

        // 화면에 보이는 영역만 렌더링 (Culling)
        const startX = Math.floor(camera.x / spacing) * spacing;
        const startY = Math.floor(camera.y / spacing) * spacing;
        const endX = startX + this.engine.width / camera.zoom + spacing;
        const endY = startY + this.engine.height / camera.zoom + spacing;

        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
        ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';

        for (let y = startY; y < endY; y += spacing) {
            for (let x = startX; x < endX; x += spacing) {
                const sway = wind.getSway(x, y);

                ctx.save();
                ctx.translate(x, y);

                // 화살표 그리기
                const angle = Math.atan2(sway.y, sway.x);
                const length = Math.sqrt(sway.x * sway.x + sway.y * sway.y) * 10;

                ctx.rotate(angle);

                // 몸통
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(length, 0);
                ctx.stroke();

                // 촉 (Head)
                if (length > 2) {
                    ctx.beginPath();
                    ctx.moveTo(length, 0);
                    ctx.lineTo(length - 4, -3);
                    ctx.lineTo(length - 4, 3);
                    ctx.fill();
                }

                ctx.restore();
            }
        }
        ctx.restore();
    }

    renderZoneView(ctx) {
        const engine = this.engine;
        const zm = engine.systemManager?.zoneManager;
        if (!zm || !zm.zones || zm.zones.size === 0) return;

        ctx.save();

        const zoneColors = {
            'residential': '#4fc3f7',
            'lumber': '#8d6e63',
            'mining': '#9e9e9e',
            'agricultural': '#81c784'
        };

        for (const [id, zone] of zm.zones) {
            const screenX = (zone.bounds.minX - engine.camera.x) * engine.camera.zoom;
            const screenY = (zone.bounds.minY - engine.camera.y) * engine.camera.zoom;
            const screenW = zone.bounds.width * engine.camera.zoom;
            const screenH = zone.bounds.height * engine.camera.zoom;

            if (screenX + screenW < 0 || screenX > this.offscreenCanvas.width ||
                screenY + screenH < 0 || screenY > this.offscreenCanvas.height) {
                continue;
            }

            const color = zoneColors[zone.type] || '#ffffff';

            // Draw zone pattern/border
            ctx.strokeStyle = color + '88';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX, screenY, screenW, screenH);
            ctx.setLineDash([]);

            // Zone Label
            ctx.font = 'bold 10px "Inter", sans-serif';
            const label = ` ${zone.type.toUpperCase()} `;
            const metrics = ctx.measureText(label);

            ctx.fillStyle = color;
            ctx.fillRect(screenX, screenY - 18, metrics.width + 4, 18);

            ctx.fillStyle = '#000';
            ctx.fillText(label, screenX + 2, screenY - 5);
        }

        ctx.restore();
    }

    /** 🧠 [AI Debug View] 개체별 AI 경로 및 타겟 시각화 */
    renderDebugAI(ctx) {
        const engine = this.engine;
        const camera = engine.camera;
        const margin = 50;
        const viewX = camera.x - margin;
        const viewY = camera.y - margin;
        const viewW = (camera.width / camera.zoom) + (margin * 2);
        const viewH = (camera.height / camera.zoom) + (margin * 2);

        const visibleIds = engine.spatialHash?.queryRect(viewX, viewY, viewW, viewH) || [];

        ctx.save();
        ctx.lineWidth = 1.5;

        for (const id of visibleIds) {
            const entity = engine.entityManager.entities.get(id);
            if (!entity) continue;

            const state = entity.components.get('AIState');
            const transform = entity.components.get('Transform');
            if (!state || !transform) continue;

            const x = transform.x;
            const y = transform.y;

            // Task-based colors
            let pathColor = '#ffffff';
            const mode = state.mode;
            if (mode.includes('gather')) pathColor = '#81c784';
            else if (mode.includes('hunt') || mode === 'attack') pathColor = '#ff5252';
            else if (mode === 'build') pathColor = '#ffca28';
            else if (mode === 'wander') pathColor = '#b0bec5';

            // 1. Draw Target Line
            const target = state.targetId ? engine.entityManager.entities.get(state.targetId) : null;
            let targetPos = target ? target.components.get('Transform') : null;

            if (targetPos) {
                ctx.beginPath();
                ctx.strokeStyle = pathColor + '66';
                ctx.setLineDash([5, 5]);
                ctx.moveTo(x, y);
                ctx.lineTo(targetPos.x, targetPos.y);
                ctx.stroke();
            }

            // 2. Draw HPA* Path
            if (state.path && state.path.length > 0) {
                ctx.beginPath();
                ctx.strokeStyle = pathColor;
                ctx.setLineDash([]);
                ctx.moveTo(x, y);
                for (let i = state.pathIndex || 0; i < state.path.length; i++) {
                    const wp = state.path[i];
                    ctx.lineTo(wp.x, wp.y);
                }
                ctx.stroke();

                // Draw Waypoints
                ctx.fillStyle = pathColor;
                for (let i = state.pathIndex || 0; i < state.path.length; i++) {
                    const wp = state.path[i];
                    ctx.beginPath();
                    ctx.arc(wp.x, wp.y, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // 3. Draw Abstract Path (HPA* Hierarchical)
            if (state.abstractPath && state.abstractPath.length > 0) {
                ctx.beginPath();
                ctx.strokeStyle = '#4fc3f7';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.moveTo(x, y);
                for (let i = state.abstractIndex || 0; i < state.abstractPath.length; i++) {
                    const node = state.abstractPath[i];
                    ctx.lineTo(node.x, node.y);
                }
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    /** 🚀 [Expert Design] 플로팅 텍스트 생성 (데미지, 상태창 등) */
    spawnFloatingText(x, y, text, color = '#ffffff', options = {}) {
        const t = this.textPool.get();
        t.x = x;
        t.y = y;
        t.text = text;
        t.color = color;
        t.vx = options.vx || (Math.random() - 0.5) * 0.5;
        t.vy = options.vy || -1.5;
        t.life = options.life || 1.2;
        t.maxLife = t.life;
        t.size = options.size || 14;
        t.alpha = 1.0;
        t.isScreenSpace = options.isScreenSpace || false;

        this.floatingTexts.push(t);
    }

    /** 🚀 [Expert Design] 플로팅 텍스트 업데이트 및 렌더링 */
    updateAndRenderFloatingTexts(ctx, time) {
        const dt = 0.016; // 대략적인 deltaTime (추후 엔진 dt 연동 고려)

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];

            // 위치 업데이트
            t.x += t.vx;
            t.y += t.vy;
            t.vy += 0.05; // 약간의 중력 효과 또는 감속

            // 수명 및 알파 업데이트
            t.life -= dt;
            t.alpha = Math.max(0, t.life / t.maxLife);

            if (t.life <= 0) {
                this.floatingTexts.splice(i, 1);
                this.textPool.release(t);
                continue;
            }

            // 그리기
            ctx.globalAlpha = t.alpha;
            ctx.font = `bold ${t.size}px "Courier New", monospace`;

            // 텍스트 외곽선 (가독성 향상)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 3;
            ctx.strokeText(t.text, t.x, t.y);

            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x, t.y);
        }

        ctx.restore();
    }
}
