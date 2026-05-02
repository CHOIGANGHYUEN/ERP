import BaseRole from './BaseRole.js';

/**
 * 🪓 LoggerRole
 * 벌목꾼 직업. 가장 가까운 나무를 찾아 채집(GatherWoodState)으로 전환합니다.
 */
export default class LoggerRole extends BaseRole {
    decide(entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        if (!state || !transform) return null;

        // 인벤토리가 꽉 찼으면 창고에 보관
        if (inventory && inventory.getTotal() >= inventory.capacity) {
            return 'deposit';
        }

        // 이미 나무를 향해 이동 중이면 유지
        if (state.mode === 'gather_wood' && state.targetId) {
            const tgt = this.em.entities.get(state.targetId);
            if (tgt) return 'gather_wood';
            state.targetId = null;
        }

        // 가장 가까운 나무 탐색
        const condition = (ent) => {
            const visual = ent.components.get('Visual');
            if (visual?.type !== 'tree') return false;
            const resource = ent.components.get('Resource');
            if (!resource || resource.value <= 0) return false;

            // 🌱 묘목 보호: 자원량이 적거나 덜 자란 새싹은 채집 대상에서 제외
            if (resource.value < 20 || (visual && visual.size < 10)) return false;

            // 🚫 도달 불가(블랙리스트) 타겟 필터링
            if (state.unreachableTargets && state.unreachableTargets.has(ent.id)) return false;

            // 🔒 타겟 독점 확인 (누군가 이미 캐려고 찜했는지)
            if (resource.claimedBy && resource.claimedBy !== entity.id) {
                const claimer = this.em.entities.get(resource.claimedBy);
                if (claimer) {
                    const claimerState = claimer.components.get('AIState');
                    if (claimerState && claimerState.targetId === ent.id) return false;
                }
                resource.claimedBy = null; // 타겟 포기 시 클레임 자동 해제
            }
            return true;
        };

        const nearestId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, 3000, condition, this.engine.spatialHash
        );

        if (nearestId !== null) {
            state.targetId = nearestId;
            // 🔒 타겟 독점권 설정
            const targetEnt = this.em.entities.get(nearestId);
            const targetRes = targetEnt?.components.get('Resource');
            if (targetRes) targetRes.claimedBy = entity.id;

            return 'gather_wood';
        }

        return null;
    }
}
