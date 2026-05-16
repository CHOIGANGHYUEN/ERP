import CollisionResolver from './physics/CollisionResolver.js';
import FlockingSolver from './physics/FlockingSolver.js';

/**
 * 🛡️ CollisionSystem (Legacy Facade)
 * 기존 시스템과의 호환성을 유지하기 위한 퍼사드 클래스입니다.
 * 모든 실제 연산 로직은 physics/ 폴더 산하의 전용 Solver들로 이관되었습니다.
 */
export default class CollisionSystem {
    /** @deprecated Use CollisionResolver.resolveSeparation instead */
    static resolveSeparation(id, x, y, spatialHash, em, radius = 15) {
        return CollisionResolver.resolveSeparation(id, x, y, spatialHash, em, radius);
    }

    /** @deprecated Use FlockingSolver.resolveAlignment instead */
    static resolveAlignment(id, x, y, spatialHash, em, radius = 40) {
        return FlockingSolver.resolveAlignment(id, x, y, spatialHash, em, radius);
    }

    /** @deprecated Use FlockingSolver.resolveCohesion instead */
    static resolveCohesion(id, x, y, spatialHash, em, radius = 50) {
        return FlockingSolver.resolveCohesion(id, x, y, spatialHash, em, radius);
    }
}