import System from '../../../core/System.js';
import { JobTypes } from '../../../config/JobTypes.js';
import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * 👥 VillageRecruitmentSystem
 * 마을의 거주민 영입, 인구 관리, 촌장 승계 및 사망 처리를 전담합니다.
 * VillageSystem에서 SRP에 따라 분리되었습니다.
 */
export default class VillageRecruitmentSystem extends System {
    constructor(entityManager, eventBus, engine, villageSystem) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.villageSystem = villageSystem;
        this._recruitTimer = 0;

        // 📡 Listen for events
        this.eventBus.on('VILLAGER_DEATH', (data) => this._onVillagerDeath(data));
        this.eventBus.on('ENTITY_SPAWNED', (data) => this._onEntitySpawned(data));
    }

    _onVillagerDeath(data) {
        const { entityId, villageId } = data;
        const village = this.villageSystem.villages.get(villageId);
        if (village) {
            village.members.delete(entityId);
            if (entityId === village.chiefId) {
                this._handleLeadershipSuccession(village);
            }
        }
    }

    _onEntitySpawned(data) {
        if (data.type === 'human') {
            const entityId = data.id || (data.entity ? data.entity.id : null);
            const entity = this.entityManager.entities.get(entityId);
            if (!entity) return;

            const t = entity.components.get('Transform');
            if (t) {
                this._tryJoinNearestVillage(entity, t.x, t.y);
            }
        }
    }

    update(dt) {
        this._recruitTimer -= dt;
        if (this._recruitTimer <= 0) {
            this._recruitVillagers();
            this._recruitTimer = 1.5;
        }

        // 정기적인 사망자 청소 및 승계 체크
        for (const village of this.villageSystem.villages.values()) {
            if (!village.chiefId || !this.entityManager.entities.has(village.chiefId)) {
                this._cleanupDeadMembers(village);
            }
        }
    }

    _tryJoinNearestVillage(entity, x, y) {
        const civ = entity.components.get('Civilization');
        if (!civ || civ.villageId !== -1) return;

        let hostVillage = null;
        const tg = this.engine.terrainGen;

        if (tg && tg.territoryBuffer) {
            const idx = tg.getIndex(x, y);
            const villageId = tg.territoryBuffer[idx];
            if (villageId > 0) {
                hostVillage = this.villageSystem.villages.get(villageId);
            }
        }

        if (!hostVillage && this.engine.spatialHash) {
            const nearestCenterId = this.entityManager.findNearestEntityWithComponent(x, y, 600, (ent) => {
                return ent.components.has('VillageCenter');
            }, this.engine.spatialHash);

            if (nearestCenterId !== null) {
                const centerEnt = this.entityManager.entities.get(nearestCenterId);
                const vc = centerEnt?.components.get('VillageCenter');
                if (vc) hostVillage = this.villageSystem.villages.get(vc.villageId);
            }
        }

        if (hostVillage) {
            civ.villageId = hostVillage.id;
            civ.nationId = hostVillage.nationId;
            hostVillage.members.add(entity.id);
            civ.jobType = JobTypes.UNEMPLOYED;
        }
    }

    _recruitVillagers() {
        const em = this.entityManager;
        const MAX_PROCESS_PER_TICK = 50;
        let processed = 0;

        for (const id of em.humanIds) {
            if (processed >= MAX_PROCESS_PER_TICK) break;

            const entity = em.entities.get(id);
            if (!entity) continue;

            const civ = entity.components.get('Civilization');
            if (!civ || civ.villageId !== -1) continue;

            processed++;
            const transform = entity.components.get('Transform');
            if (!transform) continue;

            let hostVillage = null;
            let minCenterDist = Infinity;

            const tg = this.engine.terrainGen;
            if (tg && tg.territoryBuffer) {
                const idx = tg.getIndex(transform.x, transform.y);
                const villageId = tg.territoryBuffer[idx];
                if (villageId > 0) hostVillage = this.villageSystem.villages.get(villageId);
            }

            if (!hostVillage && this.engine.spatialHash) {
                const searchRadius = 800;
                const nearestCenterId = em.findNearestEntityWithComponent(transform.x, transform.y, searchRadius, (ent) => {
                    return ent.components.has('VillageCenter');
                }, this.engine.spatialHash);

                if (nearestCenterId !== null) {
                    const centerEnt = em.entities.get(nearestCenterId);
                    const vc = centerEnt?.components.get('VillageCenter');
                    const centerTrans = centerEnt?.components.get('Transform');

                    if (vc && centerTrans) {
                        minCenterDist = Math.hypot(centerTrans.x - transform.x, centerTrans.y - transform.y);
                        if (minCenterDist < 600) hostVillage = this.villageSystem.villages.get(vc.villageId);
                    }
                }
            }

            if (hostVillage) {
                civ.villageId = hostVillage.id;
                civ.nationId = hostVillage.nationId;
                hostVillage.members.add(id);
                civ.jobType = JobTypes.UNEMPLOYED;
            } else if (minCenterDist > 800) {
                this.villageSystem.createVillage({ founderId: id, x: transform.x, y: transform.y, nationIdOverride: -1 });
            }
        }
    }

    _cleanupDeadMembers(village) {
        let chiefDied = false;
        const membersToRemove = [];

        for (const memberId of village.members) {
            const member = this.entityManager.entities.get(memberId);
            const state = member?.components.get('AIState');
            const civ = member?.components.get('Civilization');

            // 🛡️ [Stability] 엔티티가 소멸했거나, 사망 상태이거나, 다른 마을 소속이면 제거 대상
            if (!member || (state && state.mode === 'die') || (civ && civ.villageId !== village.id)) {
                membersToRemove.push(memberId);
                if (memberId === village.chiefId) chiefDied = true;
            }
        }

        for (const id of membersToRemove) {
            village.members.delete(id);
        }

        // 🚀 [Critical] 인구가 0명이면 촌장 정보 즉시 초기화
        if (village.members.size === 0) {
            village.chiefId = null;
            return;
        }

        if (chiefDied || (village.chiefId && !this.entityManager.entities.has(village.chiefId))) {
            this._handleLeadershipSuccession(village);
        }
    }

    _handleLeadershipSuccession(village) {
        if (village.members.size === 0) {
            village.chiefId = null;
            return;
        }

        // 🎖️ 새로운 촌장 선출 (가장 능력치가 좋거나 오래된 주민 우선 - 현재는 첫 번째 후보)
        const candidates = Array.from(village.members).map(id => ({
            id,
            entity: this.entityManager.entities.get(id)
        })).filter(c => c.entity);

        if (candidates.length === 0) {
            village.chiefId = null;
            return;
        }

        const newChief = candidates[0];
        const synchronizer = this.engine.systemManager?.humanBehavior?.jobSynchronizer;
        
        // 🚀 [Expert Atomic Update] 촌장 상태의 원자적 동기화 보장 (SPOF 방지)
        if (synchronizer) {
            synchronizer.syncJob(newChief.id, JobTypes.CHIEF, village.id);
            village.chiefId = newChief.id;

            this.eventBus.emit('SHOW_SPEECH_BUBBLE', {
                entityId: newChief.id, text: '👑 NEW CHIEF!', duration: 3000
            });

            GlobalLogger.info(`👑 [Village] Entity ${newChief.id} succeeded as Chief of Village ${village.id}.`);
        }
    }
}
