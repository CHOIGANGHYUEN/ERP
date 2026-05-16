import BaseRole from './BaseRole.js';
import { JobTypes } from '../../config/JobTypes.js';
import { GlobalLogger } from '../../utils/Logger.js';

export default class ChiefRole extends BaseRole {
    constructor(system) {
        super(system);
        this._leadershipTimer = 0;
        this._LEADERSHIP_INTERVAL = 10.0;
        this._surveyTimer = 30.0;
        this._inspectTimer = 15.0;
        this._auditTimer = 5.0;
        this._dispatchTimer = 20.0;
    }

    decide(entity, dt) {
        this._leadershipTimer -= dt;

        const civ = entity.components.get('Civilization');
        if (!civ || civ.villageId === -1) return null;

        const vs = this.engine.systemManager?.villageSystem;
        const village = vs?.getVillage(civ.villageId);
        if (!village) return null;

        const state = entity.components.get('AIState');
        if (!state) return null;

        if (this._leadershipTimer <= 0) {
            this._leadershipTimer = this._LEADERSHIP_INTERVAL;
            this._applyLeadershipAura(entity, village, civ);
        }

        this._auditTimer -= dt;
        if (this._auditTimer <= 0) {
            this._auditTimer = 5.0;
            this._auditVillagers(village);
        }

        if (village.needs?.urgency) {
            const urgency = village.needs.urgency;
            if (urgency.food > 90 || urgency.wood > 90 || urgency.stone > 90) {
                return 'chief_emergency';
            }
        }

        if (state.mode !== 'idle') return null;

        this._surveyTimer -= dt;
        if (this._surveyTimer <= 0) {
            this._surveyTimer = 30.0;
            if (this._checkExpansionNeed(village)) {
                return 'chief_survey';
            }
        }

        this._inspectTimer -= dt;
        if (this._inspectTimer <= 0) {
            this._inspectTimer = 15.0;
            const blueprintId = this._findStalledBlueprint(village);
            if (blueprintId) {
                state.targetId = blueprintId;
                return 'chief_inspect';
            }
        }

        this._dispatchTimer -= dt;
        if (this._dispatchTimer <= 0) {
            this._dispatchTimer = 20.0;
            const order = vs.logisticsMediator?.createDispatchOrder(village);
            if (order) {
                state.dispatchOrder = order;
                state.targetId = order.workerId;
                return 'chief_dispatch';
            }
        }

        if (Math.random() < 0.3) {
            return 'chief_patrol';
        }

        return null;
    }

    _auditVillagers(village) {
        for (const memberId of village.members) {
            const member = this.em.entities.get(memberId);
            if (!member) continue;

            const jobCtrl = member.components.get('JobController');
            if (!jobCtrl || jobCtrl.currentJob === JobTypes.UNEMPLOYED) continue;

            if (
                jobCtrl.jobState === 'STUCK' ||
                (jobCtrl.jobState === 'WAITING_RES' && jobCtrl.getData('stateTimer') > 45.0)
            ) {
                GlobalLogger.info(`[Chief] Audit reset stuck member ${memberId}.`);
                const aiState = member.components.get('AIState');
                if (aiState) {
                    aiState.targetId = null;
                    aiState.mode = 'idle';
                    jobCtrl.interrupt();
                }
            }
        }
    }

    _applyLeadershipAura(chiefEntity, village, civ) {
        const chiefStats = chiefEntity.components.get('BaseStats');
        const transform = chiefEntity.components.get('Transform');
        if (!transform) return;

        const charisma = chiefStats ? Math.min(1.0, (chiefStats.charisma || 50) / 100) : 0.5;
        village.loyalty = Math.min(100, (village.loyalty ?? 70) + 0.5 + charisma);
        village.leadershipBuff = 1.0 + charisma * 0.2;

        const buffRadius = 250;
        this.engine.spatialHash?.eachInRange(transform.x, transform.y, buffRadius, (id) => {
            if (id === chiefEntity.id) return;
            const ent = this.em.entities.get(id);
            const memberCiv = ent?.components.get('Civilization');
            if (!memberCiv || memberCiv.villageId !== civ.villageId) return;

            const social = ent.components.get('Social');
            if (social) {
                social.workSpeedBuff = 1.0 + charisma * 0.3;
                social.workSpeedBuffExpiry = Date.now() + (this._LEADERSHIP_INTERVAL * 1000);
            }
        });

        this.engine.eventBus?.emit('SPAWN_EFFECT_PARTICLES', {
            x: transform.x,
            y: transform.y - 15,
            count: 5,
            type: 'EFFECT',
            color: '#ffd700',
            speed: 1.5
        });
    }

    _checkExpansionNeed(village) {
        const density = village.members.size / (village.territory.size || 1);
        return density > 0.2 && village.members.size >= 5;
    }

    _findStalledBlueprint(village) {
        if (!village.buildings) return null;
        for (const buildingId of village.buildings) {
            const building = this.em.entities.get(buildingId);
            const structure = building?.components.get('Structure');
            if (structure && !structure.isComplete) return buildingId;
        }
        return null;
    }
}
