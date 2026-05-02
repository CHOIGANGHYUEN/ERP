import BaseRole from './BaseRole.js';
import { AnimalStates } from '../../components/behavior/State.js';

/**
 * 🧺 GathererRole
 * 채집가 직업. 마을 자원을 확보하기 위해 주변 식물/열매를 수집(GATHER_PLANT)합니다.
 * (FORAGE는 개인의 허기를 채우기 위한 수색 상태로 남겨둡니다.)
 */
export default class GathererRole extends BaseRole {
    decide(entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        if (!state || !transform) return null;

        // 1. 인벤토리가 꽉 찼으면 창고로 배달
        if (inventory && inventory.getTotal() >= inventory.capacity) return 'deposit';

        // 2. 이미 채집 중이면 상태 유지
        if (state.mode === 'gather_plant' && state.targetId) {
            if (this.em.entities.get(state.targetId)) return 'gather_plant';
            state.targetId = null;
        }

        // 3. 주변 식물 탐색 (FoodSensor 대신 Claim을 완벽히 존중하는 수동 탐색 로직 적용)
        const condition = (ent) => {
            const res = ent.components.get('Resource');
            if (!res || !res.edible || res.value <= 0) return false;

            // 🚫 도달 불가(블랙리스트) 필터링
            if (state.unreachableTargets && state.unreachableTargets.has(ent.id)) return false;

            // 🔒 찜(Claim) 필터링: 이미 다른 개체가 캐고 있다면 무시
            if (res.claimedBy && res.claimedBy !== entity.id) {
                const claimer = this.em.entities.get(res.claimedBy);
                if (claimer && claimer.components.get('AIState')?.targetId === ent.id) return false;
                res.claimedBy = null; // 독점권 해제
            }
            return true;
        };

        const nearestId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, 500, condition, this.engine.spatialHash
        );

        if (nearestId !== null) {
            state.targetId = nearestId;
            const targetEnt = this.em.entities.get(nearestId);
            const targetRes = targetEnt.components.get('Resource');
            if (targetRes) targetRes.claimedBy = entity.id; // 내가 찜함
            return 'gather_plant';
        }

        return null;
    }
}
