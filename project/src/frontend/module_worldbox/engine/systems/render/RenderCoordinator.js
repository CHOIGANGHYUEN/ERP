import System from '../../core/System.js';

/**
 * 🖼️ RenderCoordinator (렌더링 총괄 시스템)
 * 오프스크린 캔버스를 활용한 더블 버퍼링 기법을 통해
 * 렌더링 병목 현상을 해결하고 프레임 안정성을 확보합니다.
 */
export default class RenderCoordinator extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;

        // 1. 🚀 가상의 도화지(Offscreen Canvas) 생성 및 해상도 캡핑 (4K 방지)
        this.maxResW = 1920;
        this.maxResH = 1080;
        this.updateResolution(engine.width, engine.height);
        
        this.offCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
        console.log("RenderCoordinator: Capped Offscreen Canvas Initialized", this.offscreenCanvas.width, this.offscreenCanvas.height);
    }

    updateResolution(w, h) {
        if (!this.offscreenCanvas) this.offscreenCanvas = document.createElement('canvas');
        
        // 🛡️ [Memory Guard] 해상도가 너무 높으면 성능/메모리 보호를 위해 캡핑
        this.offscreenCanvas.width = Math.min(w, this.maxResW);
        this.offscreenCanvas.height = Math.min(h, this.maxResH);
    }

    /**
     * 화면 크기가 변경될 때 오프스크린 캔버스 크기도 동기화합니다.
     */
    resize(width, height) {
        this.updateResolution(width, height);
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
        
        // [레이어 1] 지형 (Terrain) - 가시 영역만 클리핑하여 렌더링 (성능 최적화)
        const viewW = Math.ceil(this.offscreenCanvas.width / camera.zoom);
        const viewH = Math.ceil(this.offscreenCanvas.height / camera.zoom);
        
        const sx = Math.max(0, Math.floor(camera.x));
        const sy = Math.max(0, Math.floor(camera.y));
        const sw = Math.min(engine.mapWidth - sx, viewW + 2);
        const sh = Math.min(engine.mapHeight - sy, viewH + 2);

        if (sw > 0 && sh > 0) {
            offCtx.drawImage(
                engine.terrainCanvas, 
                sx, sy, sw, sh, // Source (Terrain Canvas)
                sx, sy, sw, sh  // Destination (World Space)
            );
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

        // [레이어 3] UI 및 툴팁 (Screen Space)
        this.renderTimeHUD(offCtx); // ⏳ 시간 HUD 추가
        
        if (engine.viewFlags.fertilityValue && engine.inputSystem && engine.inputSystem.mouseWorld) {
            this.renderFertilityTooltip(offCtx);
        }

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
}