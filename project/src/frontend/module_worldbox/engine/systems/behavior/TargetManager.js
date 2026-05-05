/**
 * 🎯 TargetManager.js
 * 전역 타겟 할당 관제탑입니다.
 * 개체가 타겟을 요청하면 최적의 대상을 찾아 직접 주입합니다.
 */
export default class TargetManager {
    constructor(entityManager, eventBus, blackboard, engine) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.blackboard = blackboard;
        this.engine = engine;
        this.pendingRequests = []; // [ { entityId, type, criteria } ]
    }

    /**
     * 개체가 타겟을 요청할 때 호출
     */
    requestTarget(entityId, targetType, criteria = {}, intent = null) {
        this.pendingRequests.push({ entityId, targetType, criteria, intent });
    }

    /**
     * 저주기로 호출되어 대기 중인 요청들을 처리
     */
    update(dt) {
        // 🚀 [Stability] 오래된 요청(5초 이상)은 큐에서 제거하여 무한 누적 방지
        const now = Date.now();
        this.pendingRequests = this.pendingRequests.filter(req => {
            if (!req.timestamp) req.timestamp = now;
            return (now - req.timestamp) < 5000;
        });

        if (this.pendingRequests.length === 0) return;

        // 🚀 [Optimization] 프레임당 처리 요청 수를 대폭 줄여 프레임 드랍 방지 (20 -> 5)
        const processCount = Math.min(this.pendingRequests.length, 5);
        const requests = this.pendingRequests.splice(0, processCount);

        for (const req of requests) {
            this._processRequest(req);
        }
    }

    _processRequest(req) {
        const { entityId, targetType, criteria } = req;
        const entity = this.entityManager.entities.get(entityId);
        if (!entity) return;

        const transform = entity.components.get('Transform');
        if (!transform) return;

        let bestTargetId = null;

        // 🚀 [Expert Logic] 구역(Zone) 우선 탐색 후, 없으면 전역 탐색(Fallback) 수행
        switch (targetType) {
            case 'RESOURCE':
                bestTargetId = this._findBestResource(transform.x, transform.y, criteria.resourceType, entity, req.intent, false);
                if (!bestTargetId) {
                    bestTargetId = this._findBestResource(transform.x, transform.y, criteria.resourceType, entity, req.intent, true);
                }
                break;
            case 'STORAGE':
            case 'STORAGE_DEPOSIT':
                bestTargetId = this._findBestStorage(transform.x, transform.y, criteria.resourceType, true, entity);
                break;
            case 'STORAGE_WITHDRAW':
                bestTargetId = this._findBestStorage(transform.x, transform.y, criteria.resourceType, false, entity);
                break;
            case 'BLUEPRINT':
                bestTargetId = this._findBestBlueprint(transform.x, transform.y, entity, req.intent, false);
                if (!bestTargetId) {
                    bestTargetId = this._findBestBlueprint(transform.x, transform.y, entity, req.intent, true);
                }
                break;
            case 'WANDER':
                break;
        }

        if (bestTargetId) {
            const aiState = entity.components.get('AIState');
            if (aiState) {
                // 🚫 [Blacklist Check] 최근에 실패한 타겟은 무시
                if (aiState.isBlacklisted && aiState.isBlacklisted(bestTargetId)) {
                    this.eventBus.emit('TARGET_NOT_FOUND', { entityId, targetType, intent: req.intent });
                    return;
                }

                aiState.isTargetRequested = false;
                aiState.targetRequestFailed = false;

                const isSubTask = ['STORAGE', 'RESOURCE', 'STORAGE_WITHDRAW'].includes(targetType);
                if (req.intent === 'build' && isSubTask) {
                    aiState.storageTargetId = bestTargetId;
                } else {
                    aiState.targetId = bestTargetId;
                }

                const targetEnt = this.entityManager.entities.get(bestTargetId);
                if (targetEnt) {
                    const res = targetEnt.components.get('Resource');
                    const anim = targetEnt.components.get('Animal');
                    const struc = targetEnt.components.get('Structure');
                    if (res) res.claimedBy = entityId;
                    if (anim) anim.claimedBy = entityId;

                    aiState.targetName = (struc?.type || res?.type || anim?.type || 'Entity').toUpperCase();
                }

                if (req.intent) aiState.mode = req.intent;

                this.eventBus.emit('TARGET_ASSIGNED', {
                    entityId,
                    targetId: bestTargetId,
                    intent: req.intent
                });
            }

            const jobCtrl = entity.components.get('JobController');
            if (jobCtrl && req.intent === jobCtrl.currentJob) {
                if (targetType === 'STORAGE_WITHDRAW' && req.intent === 'build') {
                    jobCtrl.storageTargetId = bestTargetId;
                } else {
                    jobCtrl.targetId = bestTargetId;
                }
                jobCtrl.isTargetRequested = false;
            }
        } else {
            const aiState = entity.components.get('AIState');
            if (aiState) {
                aiState.isTargetRequested = false;
                aiState.targetRequestFailed = true;
                aiState.lastRequestTime = Date.now();
            }

            const jobCtrl = entity.components.get('JobController');
            if (jobCtrl && jobCtrl.zoneId && !['WANDER'].includes(targetType)) {
                this.eventBus.emit('ZONE_RESOURCE_EXHAUSTED', {
                    entityId,
                    zoneId: jobCtrl.zoneId,
                    targetType,
                    resourceType: criteria?.resourceType
                });
            }

            this.eventBus.emit('TARGET_NOT_FOUND', { entityId, targetType, intent: req.intent });
        }
    }

    _isInZone(x, y, zone) {
        if (!zone) return true;
        return zone.contains(x, y);
    }

    _getZone(entity, intent) {
        const isSurvivalCrisis = ['eat', 'forage', 'sleep'].includes(intent);
        if (isSurvivalCrisis) return null;

        const jobCtrl = entity.components.get('JobController');
        const zm = this.engine.systemManager?.zoneManager;
        if (!zm) return null;

        // 1. 구체적인 구역이 할당된 경우 최우선
        if (jobCtrl && jobCtrl.zoneId) {
            return zm.getZone(jobCtrl.zoneId);
        }

        // 2. 구체적인 구역이 없더라도 마을 소속이라면 마을의 주요 구역을 자동 추천
        const civ = entity.components.get('Civilization');
        if (civ && civ.villageId !== -1) {
            const vs = this.engine.systemManager?.villageSystem;
            const village = vs?.getVillage(civ.villageId);
            if (village) {
                // 인텐트에 따라 적절한 마을 구역 반환 (나무 채집은 벌목 구역, 건설은 주거 구역 등)
                if (intent === 'gather_wood' || intent === 'forage') return zm.getZone(village.lumberZoneId);
                if (intent === 'build') return zm.getZone(village.residentialZoneId);
                return zm.getZone(village.residentialZoneId);
            }
        }
        return null;
    }

    _findBestResource(x, y, resourceType, entity, intent, forceGlobal = false) {
        const type = (resourceType || '').toLowerCase();
        const nodes = this.blackboard.resourceNodes.get(type) || [];
        const MAX_RADIUS_SQ = 1200 * 1200;

        let minDistSq = Infinity;
        let bestId = null;
        const aiState = entity.components.get('AIState');
        if (aiState) aiState.searchRange = 1200; // 🔍 [Debug] 탐색 반경 기록

        // forceGlobal이 true면 구역을 무시하고 전역 탐색
        const zone = forceGlobal ? null : this._getZone(entity, intent);

        for (const node of nodes) {
            if (!this._isInZone(node.x, node.y, zone)) continue;

            const dx = node.x - x;
            const dy = node.y - y;
            const distSq = dx * dx + dy * dy;

            if (distSq > MAX_RADIUS_SQ || distSq >= minDistSq) continue;

            if (aiState && aiState.isBlacklisted && aiState.isBlacklisted(node.id)) continue;

            const ent = this.entityManager.entities.get(node.id);
            if (ent) {
                const res = ent.components.get('Resource');
                const drop = ent.components.get('DroppedItem');

                // ⛏️ [Logic Enhancement] 자원 채집 시 살아있는 자원(나무 등)이 없으면 드롭된 아이템이라도 찾도록 허용
                if (res && res.value > 0 && !res.isFalling) {
                    if (!res.claimedBy || res.claimedBy === entity.id) {
                        minDistSq = distSq;
                        bestId = node.id;
                    }
                } else if (drop) {
                    const reqCiv = entity.components.get('Civilization');
                    const isOwner = drop.villageId === -1 || (reqCiv && drop.villageId === reqCiv.villageId);

                    if (isOwner && (!drop.claimedBy || drop.claimedBy === entity.id)) {
                        minDistSq = distSq;
                        bestId = node.id;
                    }
                }
            }
        }
        return bestId;
    }

    _findBestStorage(x, y, resourceType, isDeposit, entity) {
        const storages = this.blackboard.storages;
        let minDistSq = Infinity;
        let bestId = null;

        for (const s of storages) {
            const dx = s.x - x;
            const dy = s.y - y;
            const distSq = dx * dx + dy * dy;

            if (distSq < minDistSq) {
                const ent = this.entityManager.entities.get(s.id);
                if (!ent) continue;

                const storageComp = ent.components.get('Storage');
                const structureComp = ent.components.get('Structure');
                const civComp = ent.components.get('Civilization');
                const reqCiv = entity.components.get('Civilization');

                // 🏗️ [Strict Validation] 
                // 1. Storage 컴포넌트가 반드시 있어야 함
                // 2. Structure가 있다면 반드시 완공(isComplete) 상태여야 함 (청사진 제외)
                // 3. 요청자와 같은 마을 소속이어야 함
                const isComplete = !structureComp || structureComp.isComplete;
                const isSameVillage = civComp && reqCiv && civComp.villageId === reqCiv.villageId;

                if (!storageComp || !isComplete || !isSameVillage) continue;

                if (isDeposit) {
                    if (!storageComp.isFull) {
                        minDistSq = distSq;
                        bestId = s.id;
                    }
                } else {
                    if ((storageComp.items[resourceType] || 0) >= 5) { // 최소 5개 이상 있을 때만
                        minDistSq = distSq;
                        bestId = s.id;
                    }
                }
            }
        }
        return bestId;
    }

    _findBestBlueprint(x, y, entity, intent, forceGlobal = false) {
        const blueprints = this.blackboard.blueprints || [];
        let bestId = null;
        let minDistSq = Infinity;
        
        const aiState = entity.components.get('AIState');
        if (aiState) aiState.searchRange = 500; // 🔍 [Debug] 청사진 탐색 반경

        // forceGlobal이 true면 구역을 무시하고 전역 탐색
        const zone = forceGlobal ? null : this._getZone(entity, intent);

        // 1. Blackboard 캐시 활용 (우선순위)
        for (const bp of blueprints) {
            const bpEntity = this.entityManager.entities.get(bp.id);
            if (!bpEntity) continue;
            const t = bpEntity.components.get('Transform');
            if (!t) continue;

            // 🗺️ [Zone System] 구역 제한 검사 (구역 내 청사진만 탐색)
            if (!this._isInZone(t.x, t.y, zone)) continue;

            const distSq = (t.x - x) ** 2 + (t.y - y) ** 2;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                bestId = bp.id;
            }
        }

        // 🚀 [Critical Fix] 전수 조사를 원천 차단하고 SpatialHash 기반 근거리 탐색만 수행
        if (!bestId) {
            bestId = this.entityManager.findNearestEntityWithComponent(x, y, 500, (ent) => {
                const struc = ent.components.get('Structure');
                const t = ent.components.get('Transform');
                if (t && !this._isInZone(t.x, t.y, zone)) return false;
                return struc && struc.isBlueprint && !struc.isComplete;
            }); // spatialHash는 내부적으로 사용됨
        }

        return bestId;
    }
}
