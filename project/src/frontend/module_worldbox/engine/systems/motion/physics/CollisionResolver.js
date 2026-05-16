/**
 * 💥 CollisionResolver
 * 엔티티 간의 물리적 충돌 회피(Separation) 및 장애물 반발 연산을 전담합니다.
 * SRP를 위해 KinematicSystem과 CollisionSystem에서 수식 로직이 분리되었습니다.
 */
export default class CollisionResolver {
    /**
     * 🛡️ Separation Steering (충돌 회피)
     * 주변 엔티티들과의 거리를 계산하여 서로를 밀어내는 벡터(Force)를 반환합니다.
     * @param {number} id 주체 엔티티 ID
     * @param {number} x 현재 X
     * @param {number} y 현재 Y
     * @param {Object} spatialHash 공간 해시 참조
     * @param {Object} em 엔티티 매니저 (버퍼 접근용)
     * @param {number} radius 회피 반경
     */
    static resolveSeparation(id, x, y, spatialHash, em, radius = 15) {
        if (!spatialHash) return { pushX: 0, pushY: 0 };
        
        let pushX = 0;
        let pushY = 0;
        let count = 0;
        const radSq = radius * radius;
        
        // [Expert Optimization] TypedArray 직접 접근으로 메모리 참조 성능 극대화
        const transformBuffer = em.transformBuffer;
        if (!transformBuffer) return { pushX: 0, pushY: 0 };

        spatialHash.eachInRange(x, y, radius, (otherId) => {
            if (otherId === id) return;
            
            const otherIdx = otherId * 2;
            const ox = transformBuffer[otherIdx];
            const oy = transformBuffer[otherIdx + 1];

            const dx = x - ox;
            const dy = y - oy;
            const distSq = dx * dx + dy * dy;

            if (distSq < radSq && distSq > 0.01) {
                const dist = Math.sqrt(distSq);
                // 거리가 가까울수록 더 강한 반발력 생성
                const force = (radius - dist) / radius;
                pushX += (dx / dist) * force;
                pushY += (dy / dist) * force;
                count++;
            }
        });

        if (count > 0) {
            // 평균 벡터 반환
            return { pushX: pushX / count, pushY: pushY / count };
        }
        return { pushX: 0, pushY: 0 };
    }
}
