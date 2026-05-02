import BaseRole from './BaseRole.js';

/**
 * 🏗️ ArchitectRole
 * 건축가 직업. 마을에 건설 과업이 있으면 해당 청사진으로 이동하여 건설합니다.
 */
export default class ArchitectRole extends BaseRole {
    decide(entity, dt) {
        const state = entity.components.get('AIState');
        if (!state) return null;

        // 이미 건설 중이면 유지
        if (state.mode === 'build' && state.targetId) {
            const target = this.em.entities.get(state.targetId);
            if (target?.components.get('Structure')?.isComplete === false) return 'build';
            // 건설 완료 → 목표 해제
            state.targetId = null;
        }

        // 마을의 건설 과업 확인
        const civ = entity.components.get('Civilization');
        const vs = this.engine.systemManager?.villageSystem;
        if (!civ || !vs) return null;
        const village = vs.getVillage(civ.villageId);
        if (!village?.currentTask || village.currentTask.type !== 'build') return null;

        const blueprint = this.em.entities.get(village.currentTask.targetId);
        if (!blueprint) return null;

        state.targetId = village.currentTask.targetId;
        return 'build';
    }
}
