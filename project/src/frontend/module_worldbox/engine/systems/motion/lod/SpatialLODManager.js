/**
 * 🛰️ SpatialLODManager
 * 카메라 가시 영역(Frustum) 및 엔티티 위치 기반의 Tick Slicing 및 LOD 레벨을 관리합니다.
 * SRP(단일 책임 원칙)에 따라 KinematicSystem과 HerdingSystem에서 분리되었습니다.
 */
export default class SpatialLODManager {
    /**
     * 🚀 [Expert Optimization] 엔티티의 현재 LOD 상태를 계산합니다.
     * @param {number} id 엔티티 ID (틱 슬라이싱 오프셋용)
     * @param {number} x 현재 X 좌표
     * @param {number} y 현재 Y 좌표
     * @param {Object} view 카메라 가시 영역 { x, y, w, h }
     * @param {number} frameCount 엔진 프레임 카운트
     * @param {Object} config LOD 설정 (skipFar, skipNear 등)
     * @returns {Object} LOD 정보 { isVisible, shouldUpdate, skipFactor }
     */
    static getLODLevel(id, x, y, view, frameCount, config = {}) {
        const { x: vx, y: vy, w: vw, h: vh } = view;
        
        // 1. 뷰포트 내부 여부 확인 (기본 가시성)
        const isVisible = (x >= vx && x <= vx + vw && y >= vy && y <= vy + vh);
        
        if (isVisible) {
            return { isVisible: true, shouldUpdate: true, skipFactor: 1 };
        }

        // 2. 화면 밖 거리 계산 (맨해튼 거리로 성능 최적화)
        const centerX = vx + vw / 2;
        const centerY = vy + vh / 2;
        const dist = Math.abs(x - centerX) + Math.abs(y - centerY);
        
        // 3. 원거리 임계값 판별 (화면 크기의 약 2배 이상 벗어난 경우)
        const farThreshold = config.farThreshold || (vw + vh);
        const isFar = dist > farThreshold;
        
        // 4. 틱 슬라이싱(Tick Slicing) 팩터 결정
        // 원거리는 10프레임당 1번, 근거리 화면 밖은 3프레임당 1번 업데이트
        const skipFactor = isFar ? (config.farFactor || 10) : (config.nearFactor || 3);
        
        // 5. 업데이트 시점 여부 (ID 기반 오프셋으로 연산 분산)
        const shouldUpdate = ((id + frameCount) % skipFactor === 0);

        return {
            isVisible: false,
            isFar,
            shouldUpdate,
            skipFactor
        };
    }

    /** 🚀 [Expert AI] 원거리 허딩 연산 전용 생략 조건 판별 */
    static shouldSkipHerding(id, x, y, view, frameCount) {
        const lod = this.getLODLevel(id, x, y, view, frameCount, {
            farThreshold: (view.w + view.h) * 2, // 허딩은 더 넓은 범위를 허용
            farFactor: 60, // 원거리는 거의 연산 안함 (1초에 1번)
            nearFactor: 15 // 근거리 화면 밖은 15프레임당 1번
        });

        // 원거리(Far)면 즉시 생략, 아니면 틱 슬라이싱 결과에 따름
        if (lod.isFar) return true;
        return !lod.shouldUpdate;
    }
}
