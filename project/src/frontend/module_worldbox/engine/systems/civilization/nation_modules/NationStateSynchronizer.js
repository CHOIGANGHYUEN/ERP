import { GlobalLogger } from '../../../utils/Logger.js';

export default class NationStateSynchronizer {
    constructor(entityManager, eventBus, engine, nationSystem) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.engine = engine;
        this.nationSystem = nationSystem;
    }

    syncVillage(village, nationId, context = {}) {
        if (!village) return false;

        this.engine._nationSyncLock = true;
        try {
            this.eventBus?.emit('NATION_SYNC_BEGIN', {
            villageId: village.id,
            nationId,
            reason: context.reason || 'nation_change'
        });

        const touched = new Set([
            ...(village.members || []),
            ...(village.buildings || [])
        ]);

        for (const entityId of touched) {
            const entity = this.entityManager.entities.get(entityId);
            if (!entity) continue;

            const civ = entity.components.get('Civilization');
            if (civ) {
                civ.villageId = village.id;
                civ.nationId = nationId;
            }

            const social = entity.components.get('Social');
            if (social) {
                social.nationId = nationId;
                social.diplomacy = this.nationSystem.getNationDiplomacy(nationId);
                social.lastDiplomacySync = globalThis.performance?.now?.() || Date.now();
            }

            this._clearCombatTarget(entity);
        }

            this._stageChiefSpeech(village, nationId, context.reason || 'nation_change');
        } finally {
            this.engine._nationSyncLock = false;
        }

        this.eventBus?.emit('NATION_STATE_SYNCED', {
            villageId: village.id,
            nationId,
            entityCount: touched.size,
            reason: context.reason || 'nation_change'
        });
        this.eventBus?.emit('NATION_SYNC_END', { villageId: village.id, nationId });
        GlobalLogger.info(`[NationSync] Village ${village.id} synchronized to nation ${nationId} (${touched.size} entities).`);
        return true;
    }

    syncNation(nationId, context = {}) {
        const nation = this.nationSystem.nations.get(nationId);
        const villageSystem = this.engine.systemManager?.villageSystem;
        if (!nation || !villageSystem) return false;

        for (const villageId of nation.villages || []) {
            const village = villageSystem.getVillage(villageId);
            this.syncVillage(village, nationId, context);
        }
        return true;
    }

    _clearCombatTarget(entity) {
        const state = entity.components.get('AIState');
        if (state) {
            state.targetId = null;
            state.path = null;
            state.pathIndex = 0;
            state.abstractPath = null;
            state.abstractIndex = 0;
            state.unreachableTargets?.clear?.();
            state.blacklist?.clear?.();
        }

        const jobCtrl = entity.components.get('JobController');
        if (jobCtrl) {
            jobCtrl.setData?.('engageTargetId', null);
            if (jobCtrl.jobState === 'ENGAGING' || jobCtrl.jobState === 'ATTACKING') {
                jobCtrl.jobState = 'IDLE';
            }
        }
    }

    _stageChiefSpeech(village, nationId, reason) {
        const chief = this.entityManager.entities.get(village.chiefId);
        const state = chief?.components.get('AIState');
        if (!chief || !state) return;

        state.mode = 'chief_speech';
        state.targetId = village.centerEntityId || null;
        state.speechTarget = { x: village.centerX, y: village.centerY };
        state.speechText = this._getSpeechText(reason);
        state.speechTimer = 0;
        state.speechAnnounced = false;

        const transform = chief.components.get('Transform');
        if (transform) {
            this.eventBus?.emit('SPAWN_EFFECT_PARTICLES', {
                x: transform.x,
                y: transform.y - 20,
                count: 8,
                type: 'EFFECT',
                color: '#ffd54f',
                speed: 1.2
            });
        }
    }

    _getSpeechText(reason) {
        if (reason === 'independence') return 'Independence';
        if (reason === 'capture' || reason === 'war') return 'New banner';
        if (reason === 'transfer' || reason === 'annexation') return 'United';
        return 'Nation';
    }
}
