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

        // 1. 🚀 가상의 도화지(Offscreen Canvas) 생성
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = engine.width;
        this.offscreenCanvas.height = engine.height;
        this.offCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
        
        console.log("RenderCoordinator: Offscreen Canvas Initialized", this.offscreenCanvas.width, this.offscreenCanvas.height);
    }

    /**
     * 화면 크기가 변경될 때 오프스크린 캔버스 크기도 동기화합니다.
     */
    resize(width, height) {
        this.offscreenCanvas.width = width;
        this.offscreenCanvas.height = height;
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
        
        // [레이어 1] 지형 (Terrain)
        offCtx.drawImage(engine.terrainCanvas, 0, 0);

        // [레이어 2] 엔티티 및 자원 (Entities)
        engine.renderer.render(
            offCtx, 
            this.entityManager, 
            engine.particleSystem.particles, 
            performance.now(), 
            engine.wind
        );

        offCtx.restore();

        // [레이어 3] UI 및 툴팁 (Screen Space)
        if (engine.viewFlags.fertilityValue && engine.inputSystem && engine.inputSystem.mouseWorld) {
            this.renderFertilityTooltip(offCtx);
        }

        // 4. 🚀 [대미의 장식] 완성된 가상 도화지를 메인 화면에 한 번에 복사!
        mainCtx.setTransform(1, 0, 0, 1, 0, 0);
        mainCtx.drawImage(this.offscreenCanvas, 0, 0);
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
}