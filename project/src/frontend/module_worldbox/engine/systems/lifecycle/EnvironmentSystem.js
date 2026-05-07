import System from '../../core/System.js';

/**
 * 🌍 EnvironmentSystem (환경 시스템)
 * 지형 시뮬레이션 로직이 SimulationWorker로 이관됨에 따라,
 * 메인 스레드에서는 시뮬레이션 상태 모니터링 및 시각적 피드백 위주로 동작합니다.
 */
export default class EnvironmentSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.tg = engine.terrainGen;
    }

    update(dt, time) {
        // 기존 바이옴 확산 및 비옥도 계산 로직은 simulationWorker.js로 이전되었습니다.
        // 메인 스레드 업데이트 부하를 줄이기 위해 로직을 제거합니다.
    }
}