/**
 * 🕊️ FlockingSolver
 * Boids 알고리즘(Alignment, Cohesion) 및 무리(Herd) 추종 로직을 전담합니다.
 * HerdingSystem에서 복잡한 벡터 연산 및 상태 전파 로직이 분리되었습니다.
 */
export default class FlockingSolver {
    /** 🕊️ [Alignment] 주변 개체들의 평균 속도를 계산하여 방향을 정렬합니다. */
    static resolveAlignment(id, x, y, spatialHash, em, radius = 40) {
        if (!spatialHash || !em.velocityBuffer) return { avgVx: 0, avgVy: 0 };

        let avgVx = 0;
        let avgVy = 0;
        let count = 0;
        const velocityBuffer = em.velocityBuffer;

        spatialHash.eachInRange(x, y, radius, (otherId) => {
            if (otherId === id) return;
            const otherIdx = otherId * 4; // VelocityBuffer (vx, vy, ax, ay)
            avgVx += velocityBuffer[otherIdx];
            avgVy += velocityBuffer[otherIdx + 1];
            count++;
        });

        if (count > 0) {
            return { avgVx: avgVx / count, avgVy: avgVy / count };
        }
        return { avgVx: 0, avgVy: 0 };
    }

    /** 🌌 [Cohesion] 주변 개체들의 중심점(Centroid)을 계산하여 응집력을 생성합니다. */
    static resolveCohesion(id, x, y, spatialHash, em, radius = 50) {
        if (!spatialHash || !em.transformBuffer) return { centerX: x, centerY: y };

        let sumX = 0;
        let sumY = 0;
        let count = 0;
        const transformBuffer = em.transformBuffer;

        spatialHash.eachInRange(x, y, radius, (otherId) => {
            if (otherId === id) return;
            const otherIdx = otherId * 2;
            sumX += transformBuffer[otherIdx];
            sumY += transformBuffer[otherIdx + 1];
            count++;
        });

        if (count > 0) {
            return { centerX: sumX / count, centerY: sumY / count };
        }
        return { centerX: x, centerY: y };
    }

    /** 🐏 [Leader Following] 무리의 리더 상태를 전파하여 일관된 행동을 유도합니다. */
    static updateHerdStatus(id, animal, herds, em) {
        const members = herds.get(animal.herdId);
        if (!members || members.length <= 1) return;

        const leaderId = members[0];
        // 본인이 리더면 전파할 필요 없음
        if (id === leaderId) return;

        const leaderEntity = em.entities.get(leaderId);
        if (!leaderEntity) return;

        const leaderState = leaderEntity.components.get('AIState');
        const myState = em.entities.get(id)?.components.get('AIState');

        if (leaderState && myState) {
            // 🚨 리더의 위급 상황(flee)을 무리 전체에 즉시 전파
            if (leaderState.mode === 'flee' && myState.mode !== 'flee') {
                myState.mode = 'flee';
                myState.targetId = leaderState.targetId; // 포식자 정보 공유
            } else if (leaderState.mode === 'wander' && myState.mode === 'flee') {
                // 리더가 평온해지면 무리도 다시 배회 모드로 복귀
                myState.mode = 'wander';
                myState.targetId = null;
            }
        }
    }
}
