import System from '../../core/System.js';

/**
 * 🕶️ CullingSystem (화면 밖 렌더링 차단 시스템)
 * 카메라의 시야 범위(Frustum)를 벗어난 개체들을 식별하여
 * 불필요한 렌더링 연산을 방지합니다.
 */
export default class CullingSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
    }

    update(dt, time) {
        const em = this.entityManager;
        const camera = this.engine.camera;
        
        if (!camera) return;

        // 1. 카메라 시야 범위 가져오기 (약간의 여유 마진 50px 추가)
        const margin = 50;
        const camX = camera.x - margin;
        const camY = camera.y - margin;
        const camW = (camera.viewportWidth / camera.zoom) + (margin * 2);
        const camH = (camera.viewportHeight / camera.zoom) + (margin * 2);

        // 2. 그려야 할 모든 개체를 순회하며 화면 내 존재 여부 판별
        for (const [id, entity] of em.entities) {
            const transform = entity.components.get('Transform');
            const visual = entity.components.get('Visual');

            if (transform && visual) {
                const ex = transform.x;
                const ey = transform.y;

                // 카메라 바운딩 박스 안에 있는지 검사
                const isOutside = (
                    ex < camX || 
                    ex > camX + camW || 
                    ey < camY || 
                    ey > camY + camH
                );

                // 명세서 지침대로 isCulled 마킹
                visual.isCulled = isOutside;
            }
        }
    }
}
