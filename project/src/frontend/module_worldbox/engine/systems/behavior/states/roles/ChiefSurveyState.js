import State from '../State.js';

export default class ChiefSurveyState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const civ = entity.components.get('Civilization');
        const vs = this.system.engine.systemManager?.villageSystem;
        const village = vs?.getVillage(civ?.villageId);
        const tm = vs?.territoryManager;

        if (!state || !village || !tm) return 'idle';

        const candidates = tm.getExpansionCandidates(village);
        if (candidates.length === 0) return 'idle';

        // 가장 가까운 확장 후보지 선택
        const transform = entity.components.get('Transform');
        let bestCandidate = null;
        let minDistSq = Infinity;

        for (const c of candidates) {
            const dx = c.tx * 16 + 8 - transform.x;
            const dy = c.ty * 16 + 8 - transform.y;
            const dSq = dx * dx + dy * dy;
            if (dSq < minDistSq) {
                minDistSq = dSq;
                bestCandidate = c;
            }
        }

        if (bestCandidate) {
            state.wanderTarget = { 
                x: bestCandidate.tx * 16 + 8, 
                y: bestCandidate.ty * 16 + 8, 
                tx: bestCandidate.tx, 
                ty: bestCandidate.ty 
            };
            return 'chief_expand';
        }

        return 'idle';
    }
}
