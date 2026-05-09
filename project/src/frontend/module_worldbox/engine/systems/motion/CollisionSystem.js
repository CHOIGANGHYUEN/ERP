export default class CollisionSystem {
    /**
     * 🛡️ [Step 29] Separation Steering (회피 비헤이비어)
     * 주변 엔티티들과의 거리를 계산하여 밀어내는 벡터를 반환합니다.
     */
    static resolveSeparation(id, x, y, spatialHash, em, radius = 15) {
        if (!spatialHash) return { pushX: 0, pushY: 0 };
        
        let pushX = 0;
        let pushY = 0;
        let count = 0;
        const radSq = radius * radius;

        // 🚀 [Expert Optimization] query() 대신 garbage-free 콜백 기반 eachInRange() 사용
        spatialHash.eachInRange(x, y, radius, (otherId) => {
            if (otherId === id) return;
            
            const otherIdx = otherId * 2;
            const ox = em.transformBuffer[otherIdx];
            const oy = em.transformBuffer[otherIdx + 1];

            const dx = x - ox;
            const dy = y - oy;
            const distSq = dx * dx + dy * dy;

            if (distSq < radSq && distSq > 0.01) {
                const dist = Math.sqrt(distSq);
                const force = (radius - dist) / radius;
                pushX += (dx / dist) * force;
                pushY += (dy / dist) * force;
                count++;
            }
        });

        if (count > 0) {
            return { pushX: pushX / count, pushY: pushY / count };
        }
        return { pushX: 0, pushY: 0 };
    }

    /** 🕊️ [Alignment] 주변 개체들과 이동 방향을 맞춥니다. */
    static resolveAlignment(id, x, y, spatialHash, em, radius = 40) {
        if (!spatialHash) return { avgVx: 0, avgVy: 0 };

        let avgVx = 0;
        let avgVy = 0;
        let count = 0;

        spatialHash.eachInRange(x, y, radius, (otherId) => {
            if (otherId === id) return;
            const otherIdx = otherId * 4; // VelocityBuffer index (vx, vy, ax, ay)
            if (!em.velocityBuffer) return;

            avgVx += em.velocityBuffer[otherIdx];
            avgVy += em.velocityBuffer[otherIdx + 1];
            count++;
        });

        if (count > 0) {
            return { avgVx: avgVx / count, avgVy: avgVy / count };
        }
        return { avgVx: 0, avgVy: 0 };
    }

    /** 🌌 [Cohesion] 주변 개체들의 중심점으로 모입니다. */
    static resolveCohesion(id, x, y, spatialHash, em, radius = 50) {
        if (!spatialHash) return { centerX: x, centerY: y };

        let sumX = 0;
        let sumY = 0;
        let count = 0;

        spatialHash.eachInRange(x, y, radius, (otherId) => {
            if (otherId === id) return;
            const otherIdx = otherId * 2;
            sumX += em.transformBuffer[otherIdx];
            sumY += em.transformBuffer[otherIdx + 1];
            count++;
        });

        if (count > 0) {
            return { centerX: sumX / count, centerY: sumY / count };
        }
        return { centerX: x, centerY: y };
    }
}