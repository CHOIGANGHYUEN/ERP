import System from '../../core/System.js';
import VillageOverlayRenderer from './overlays/VillageOverlayRenderer.js';
import ZoneOverlayRenderer from './overlays/ZoneOverlayRenderer.js';
import HUDOverlayRenderer from './ui/HUDOverlayRenderer.js';
import InfluenceOverlayRenderer from './overlays/InfluenceOverlayRenderer.js';
import DebugAIOverlayRenderer from './overlays/DebugAIOverlayRenderer.js';
import EnvironmentOverlayRenderer from './overlays/EnvironmentOverlayRenderer.js';

/**
 * 🖼️ RenderCoordinator (Coordinator)
 * 오프스크린 캔버스 더블 버퍼링 및 레이어별 렌더링 호출을 조율하는 통합 시스템입니다.
 * 리팩토링을 통해 개별 그리기 책임은 전문 서브 렌더러들로 분산되었습니다.
 */
export default class RenderCoordinator extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;

        // 1. 🚀 오프스크린 버퍼 초기화
        this.maxResW = 1920;
        this.maxResH = 1080;
        this.updateResolution(engine.width, engine.height);
        this.offCtx = this.offscreenCanvas.getContext('2d', { alpha: false });

        // 2. 🚀 전문 서브 렌더러 초기화
        this.ui = new HUDOverlayRenderer(this);
        this.influence = new InfluenceOverlayRenderer(this);
        this.debugAI = new DebugAIOverlayRenderer(this);
        this.env = new EnvironmentOverlayRenderer(this);

        this._initListeners();
    }

    _initListeners() {
        this.eventBus.on('SPAWN_FLOATING_TEXT', (data) => {
            this.ui.spawnFloatingText(data.x, data.y, data.text, data.color, data.options);
        });
    }

    updateResolution(w, h) {
        if (!this.offscreenCanvas) this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = Math.min(w, this.maxResW);
        this.offscreenCanvas.height = Math.min(h, this.maxResH);

        if (this.influence) {
            this.influence.updateInfluenceBuffer(this.engine.systemManager?.nationSystem, this.engine.systemManager?.villageSystem);
        }
    }

    resize(width, height) {
        this.updateResolution(width, height);
    }

    /** 🧹 [Expert Cleanup] */
    clearCaches() {
        this.ui.clearCaches();
        this.influence.clearCaches();
    }

    /**
     * 렌더링 통합 루프
     * 가상 도화지에 레이어 순서대로 그림을 완성한 뒤 메인 캔버스에 복사합니다.
     */
    render(mainCtx) {
        const engine = this.engine;
        const camera = engine.camera;
        const offCtx = this.offCtx;

        // 🚀 배경 초기화
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.fillStyle = '#000';
        offCtx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

        // 🚀 해상도 캡핑에 따른 내부 스케일 보정
        const internalScaleX = this.offscreenCanvas.width / Math.max(1, engine.width || 1);
        const internalScaleY = this.offscreenCanvas.height / Math.max(1, engine.height || 1);
        offCtx.scale(Math.min(4.0, internalScaleX), Math.min(4.0, internalScaleY));

        // 🚀 카메라 트랜스폼 (World Space 시작)
        offCtx.save();
        offCtx.imageSmoothingEnabled = false;
        offCtx.scale(camera.zoom, camera.zoom);
        offCtx.translate(-camera.renderX, -camera.renderY);

        // [Layer 1] 지형 (Terrain)
        engine.chunkManager.render(offCtx, camera);

        // [Layer 2] 국가 영향력 (Influence)
        if (engine.viewFlags.influence || engine.viewFlags.NATIONTILE || engine.viewFlags.nation) {
            this.influence.render(offCtx);
        }

        // [Layer 3] 엔티티 및 자원 (Entities)
        engine.renderer.render(offCtx, this.entityManager, engine.particleSystem.particles, performance.now(), engine.wind);

        // [Layer 4] 환경 효과 (Wind, Global Illumination)
        if (engine.viewFlags.wind) this.env.renderWind(offCtx);
        this.env.renderGlobalIllumination(offCtx, camera);

        // [Layer 5] 디버그 오버레이 (AI Debug)
        if (engine.viewFlags.debugAI || engine.viewFlags.debugSelectedAI) {
            this.debugAI.render(offCtx);
        }

        offCtx.restore(); // (World Space 끝)

        // [Layer 6] 월드 오버레이 (마을/구역 경계)
        const vs = engine.systemManager?.villageSystem;
        const zm = engine.systemManager?.zoneManager;
        if (vs) VillageOverlayRenderer.render(offCtx, camera, vs, engine);
        if (zm) ZoneOverlayRenderer.render(offCtx, camera, zm, engine);

        // [Layer 7] UI 및 툴팁 (Screen Space)
        this.ui.render(offCtx);

        // 🚀 메인 캔버스에 최종 결과물 도장 찍기
        mainCtx.setTransform(1, 0, 0, 1, 0, 0);
        mainCtx.drawImage(this.offscreenCanvas, 0, 0, engine.width, engine.height);
    }
}
