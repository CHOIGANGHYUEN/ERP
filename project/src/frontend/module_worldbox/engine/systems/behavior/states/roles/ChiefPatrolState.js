import State from '../State.js';
import Pathfinder from '../../../../utils/Pathfinder.js';
import { GlobalLogger } from '../../../../utils/Logger.js';

/**
 * 🛡️ ChiefPatrolState
 * 촌장이 마을의 주요 거점들을 순찰하며 주민들을 독려하고 상황을 점검하는 상태입니다.
 */
export default class ChiefPatrolState extends State {
    enter(entityId, entity) {
        const state = entity.components.get('AIState');
        if (state) {
            state.patrolTimer = 0;
            state.patrolSubState = 'MOVING';
        }
    }

    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const civ = entity.components.get('Civilization');
        if (!state || !transform || !civ) return 'idle';

        const villageId = civ.villageId;
        const vs = this.system.engine.systemManager.villageSystem;
        const village = vs?.getVillage(villageId);
        if (!village) return 'idle';

        // 1. 타겟이 없으면 새로운 순찰 지점 선정
        if (!state.targetId) {
            state.targetId = this._getNewPatrolPoint(village);
            if (!state.targetId) return 'idle';
            state.patrolSubState = 'MOVING';
        }

        // 2. 순찰 로직 FSM
        switch (state.patrolSubState) {
            case 'MOVING':
                const targetEnt = this.system.entityManager.entities.get(state.targetId);
                const tPos = targetEnt?.components.get('Transform');
                if (!tPos) {
                    state.targetId = null;
                    return null;
                }

                const distSq = (tPos.x - transform.x) ** 2 + (tPos.y - transform.y) ** 2;
                if (distSq < 2500) { // 50px 이내 도달
                    state.patrolSubState = 'SURVEYING';
                    state.patrolTimer = 3.0 + Math.random() * 2.0; // 3~5초간 머물며 점검
                    transform.vx = 0;
                    transform.vy = 0;
                } else {
                    Pathfinder.followPath(transform, state, tPos, 60, this.system.engine);
                }
                break;

            case 'SURVEYING':
                state.patrolTimer -= dt;
                
                // 👑 [Leadership Aura] 점검 중 주변 주민들에게 버프 부여
                this._applyAura(entity, village, transform, civ);

                if (state.patrolTimer <= 0) {
                    state.targetId = null; // 다음 지점으로
                    return 'idle'; // 한 사이클 완료 후 다시 판단
                }
                break;
        }

        return null;
    }

    _getNewPatrolPoint(village) {
        const candidates = [];
        
        // 마을 회관
        if (village.centerEntityId) candidates.push(village.centerEntityId);
        
        // 창고
        if (village.storageIds) {
            for (const sid of village.storageIds) candidates.push(sid);
        }

        // 건설 중인 건물
        for (const bid of village.buildings) {
            const b = this.system.entityManager.entities.get(bid);
            const structure = b?.components.get('Structure');
            if (structure && !structure.isComplete) {
                candidates.push(bid);
            }
        }

        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    _applyAura(chiefEntity, village, transform, civ) {
        const buffRadius = 150;
        this.system.engine.spatialHash?.eachInRange(transform.x, transform.y, buffRadius, (id) => {
            if (id === chiefEntity.id) return;
            const ent = this.system.entityManager.entities.get(id);
            const memberCiv = ent?.components.get('Civilization');
            if (!memberCiv || memberCiv.villageId !== civ.villageId) return;

            const jobCtrl = ent.components.get('JobController');
            const social = ent.components.get('Social');
            
            // 일하고 있는(WORKING) 주민들에게만 속도 버프 부여
            if (jobCtrl && jobCtrl.jobState === 'WORKING' && social) {
                social.workSpeedBuff = 1.2; // 20% 속도 향상
                social.workSpeedBuffExpiry = Date.now() + 5000; // 5초간 지속
                
                // 시각적 피드백 (황금색 입자 추가)
                if (Math.random() < 0.1) {
                    this.system.eventBus?.emit('SPAWN_EFFECT_PARTICLES', {
                        x: transform.x + (Math.random() - 0.5) * 10,
                        y: transform.y - 20,
                        count: 1,
                        type: 'ZZZ',
                        text: '⭐',
                        color: '#ffd700',
                        speed: 0.8
                    });
                }
            }
        });
    }
}
