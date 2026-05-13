/* 개체가 타겟을 요청하면 최적의 대상을 찾아 직접 주입합니다.
*/
import ObjectPool from '../../utils/ObjectPool.js';

export default class TargetManager {
    constructor(entityManager, eventBus, blackboard, engine) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.blackboard = blackboard;
        this.engine = engine;
        this.pendingRequests = []; // [ { entityId, type, criteria } ]
        this.lowPriorityQueue = []; // 🚀 [Expert AI] 원거리/저우선순위 탐색 큐

        // 🚀 [Expert Optimization] Object Pool for Target Requests
        this.requestPool = new ObjectPool(
            () => ({ entityId: -1, targetType: '', criteria: null, intent: null, timestamp: 0 }),
            (r) => {
                r.entityId = -1; r.targetType = ''; r.criteria = null; r.intent = null; r.timestamp = 0;
            },
            100
        );
    }

    /**
     * 개체가 타겟을 요청할 때 호출
     */
    requestTarget(entityId, targetType, criteria = {}, intent = null) {
        const req = this.requestPool.get();
        req.entityId = entityId;
        req.targetType = targetType;
        req.criteria = criteria;
        req.intent = intent;
        req.timestamp = Date.now();
        this.pendingRequests.push(req);
    }

    /**
     * 저주기로 호출되어 대기 중인 요청들을 처리
     */
    update(dt) {
        const now = Date.now();

        // 🚀 [Stability] 오래된 요청(5초 이상)은 큐에서 제거 및 풀에 반환
        for (let i = this.pendingRequests.length - 1; i >= 0; i--) {
            const req = this.pendingRequests[i];
            if (now - req.timestamp > 5000) {
                this.pendingRequests.splice(i, 1);
                this.requestPool.release(req);
            }
        }

        if (this.pendingRequests.length === 0) return;

        // 🚀 [Optimization] 처리 효율 향상
        const processCount = Math.min(this.pendingRequests.length, 15);
        const requests = this.pendingRequests.splice(0, processCount);

        for (const req of requests) {
            this._processRequest(req);
            // _processRequest에서 lowPriorityQueue로 넘어간 경우엔 여기서 풀에 반환하지 않음
            if (!req.isDeferred) {
                this.requestPool.release(req);
            }
        }

        // 🚀 [Expert AI] 저우선순위(원거리) 탐색 시분할 처리
        if (this.lowPriorityQueue.length > 0) {
            const LOW_PRIORITY_LIMIT = 2; // 프레임당 최대 2개만 원거리 탐색 허용
            const lowPriorityRequests = this.lowPriorityQueue.splice(0, LOW_PRIORITY_LIMIT);
            for (const req of lowPriorityRequests) {
                this._processRequest(req, true); // forceGlobal 실행
                this.requestPool.release(req);
            }
        }
    }

    _processRequest(req, forceDeferred = false) {
        const { entityId, targetType, criteria } = req;
        const entity = this.entityManager.entities.get(entityId);
        if (!entity) return;

        const transform = entity.components.get('Transform');
        if (!transform) return;

        let bestTargetId = null;

        // 🚀 [Expert Logic] 구역(Zone) 우선 탐색 후, 없으면 전역 탐색(Fallback) 수행
        switch (targetType) {
            case 'RESOURCE':
                bestTargetId = this._findBestResource(transform.x, transform.y, criteria.resourceType, entity, req.intent, forceDeferred);
                if (bestTargetId === null || bestTargetId === undefined) {
                    if (!forceDeferred) {
                        // 🚀 [Expert Optimization] 첫 탐색에서 실패 시, 즉시 전역 탐색하지 않고 저우선순위 큐로 지연
                        req.isDeferred = true;
                        this.lowPriorityQueue.push(req);
                        return;
                    }
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
                bestTargetId = this._findBestBlueprint(transform.x, transform.y, entity, req.intent, forceDeferred);
                if (bestTargetId === null || bestTargetId === undefined) {
                    if (!forceDeferred) {
                        req.isDeferred = true;
                        this.lowPriorityQueue.push(req);
                        return;
                    }
                }
                break;
            case 'WANDER':
                break;
        }

        if (bestTargetId !== null && bestTargetId !== undefined) {
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

                // 📦 [Batching & Pooling Optimization]
                const payload = this.eventBus.acquirePayload();
                payload.entityId = entityId;
                payload.targetId = bestTargetId;
                payload.intent = req.intent;
                this.eventBus.emit('TARGET_ASSIGNED', payload);
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

            const payload = this.eventBus.acquirePayload();
            payload.entityId = entityId;
            payload.targetType = targetType;
            payload.intent = req.intent;
            this.eventBus.emit('TARGET_NOT_FOUND', payload);
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
                // 🍎 [Expert Fix] 식량 수급(forage/eat)은 벌목 구역에 얽매이지 않고 자유롭게 찾을 수 있도록 함
                if (intent === 'gather_wood' || intent === 'gather_plant' || intent === 'gather_stone') {
                    return zm.getZone(village.lumberZoneId);
                }
                if (intent === 'build') return zm.getZone(village.residentialZoneId);
                
                // forage, eat 등은 구역 제한 없이 전역 탐색 유도 (null 반환)
                return null;

            }
        }
        return null;
    }

    _findBestResource(x, y, resourceType, entity, intent, forceGlobal = false) {
        const type = (resourceType || '').toLowerCase();
        const MAX_RADIUS = 1200;

        const aiState = entity.components.get('AIState');
        if (aiState) aiState.searchRange = MAX_RADIUS;

        // forceGlobal이 true면 구역을 무시하고 전역 탐색
        const zone = forceGlobal ? null : this._getZone(entity, intent);
        const spatialHash = this.engine.spatialHash;

        // 🚀 [Tiered Search] 근거리부터 원거리로 점진적 확장 (O(N) 방지)
        const searchSteps = forceGlobal ? [MAX_RADIUS] : [300, 600, MAX_RADIUS];

        for (const radius of searchSteps) {
            let minDistSq = radius * radius;
            let bestId = null;

            if (spatialHash) {
                // 🚀 [Expert Optimization] eachInRange 대신 eachInSpiral을 사용하여 가장 가까운 자원을 즉시 확보
                spatialHash.eachInSpiral(x, y, radius, (id) => {
                    const ent = this.entityManager.entities.get(id);
                    if (!ent) return false;

                    // 🗺️ [Zone System] 구역 제한 검사
                    const transform = ent.components.get('Transform');
                    if (!transform) return false;
                    if (!this._isInZone(transform.x, transform.y, zone)) return false;

                    const res = ent.components.get('Resource');
                    const drop = ent.components.get('DroppedItem');

                    // 타입 및 카테고리 교차 검사
                    if (res) {
                        const resType = (res.type || '').toLowerCase();
                        const resCat = (res.category || '').toLowerCase();
                        const searchType = type;

                        // 🔍 [Intelligence] 'wood'를 찾으면 'tree' 카테고리도 인정, 'food'를 찾으면 'plant'/'food' 카테고리 인정
                        let isMatch = (resType === searchType || resCat === searchType);
                        if (!isMatch) {
                            if (searchType === 'wood' && (resCat === 'tree' || resType.includes('tree') || res.isTree)) isMatch = true;
                            if (searchType === 'food' && (resCat === 'food' || resCat === 'plant' || resCat === 'berry' || resCat === 'fruit' || res.edible)) isMatch = true;
                            if ((searchType === 'stone' || searchType === 'mineral') && (resCat === 'mineral' || resCat === 'ore' || res.isMineral)) isMatch = true;
                            if (searchType === 'iron_ore' && (resType.includes('iron') || resType.includes('ore') || resCat === 'mineral' || res.isMineral)) isMatch = true;
                        }

                        if (!isMatch) return false;
                        if (res.value <= 0 || res.isFalling) return false;
                        if (res.claimedBy && res.claimedBy !== entity.id) return false;
                    } else if (drop) {
                        const dType = (drop.itemType || '').toLowerCase();
                        const dCat = (drop.category || '').toLowerCase();
                        
                        // 🔍 [Flexible Item Match]
                        let isMatch = (dType === type || dCat === type);
                        if (!isMatch) {
                            if (type === 'food' && (dCat === 'food' || dCat === 'nature' || dType === 'fruit' || dType === 'berry' || dType === 'meat' || dType === 'bread')) isMatch = true;
                            if (type === 'wood' && (dCat === 'wood' || dType.includes('wood') || dType.includes('log'))) isMatch = true;
                            if (type === 'stone' && (dCat === 'mineral' || dType.includes('stone') || dType.includes('rock'))) isMatch = true;
                        }

                        if (!isMatch) return false;

                        const reqCiv = entity.components.get('Civilization');
                        const isOwner = drop.villageId === -1 || (reqCiv && drop.villageId === reqCiv.villageId);
                        if (!isOwner || (drop.claimedBy && drop.claimedBy !== entity.id)) return false;
                    } else {

                        return false;
                    }

                    if (aiState && aiState.isBlacklisted && aiState.isBlacklisted(id)) return false;

                    const dx = transform.x - x;
                    const dy = transform.y - y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        bestId = id;

                        // 🎯 [Expert Exit] 자원의 경우 가장 가까운 하나만 찾으면 되므로 즉시 종료
                        return true;
                    }
                    return false;
                });
            }

            if (bestId !== null && bestId !== undefined) return bestId;
        }

        return null;
    }

    _findBestStorage(x, y, resourceType, isDeposit, entity) {
        const spatialHash = this.engine.spatialHash;
        const SEARCH_RADIUS = 2000;

        let minDistSq = SEARCH_RADIUS * SEARCH_RADIUS;
        let bestId = null;

        if (spatialHash) {
            spatialHash.eachInSpiral(x, y, SEARCH_RADIUS, (id) => {
                const ent = this.entityManager.entities.get(id);
                if (!ent) return false;

                const storageComp = ent.components.get('Storage');
                if (!storageComp) return false;

                const structureComp = ent.components.get('Structure');
                const civComp = ent.components.get('Civilization');
                const reqCiv = entity.components.get('Civilization');

                // 🏗️ [Strict Validation]
                const isComplete = !structureComp || structureComp.isComplete;
                const isSameVillage = civComp && reqCiv && civComp.villageId === reqCiv.villageId;

                if (!isComplete || !isSameVillage) return false;

                const transform = ent.components.get('Transform');
                if (!transform) return false;

                // 🚫 [Blacklist Check] 최근에 실패한 저장소 제외
                const aiState = entity.components.get('AIState');
                if (aiState && aiState.isBlacklisted && aiState.isBlacklisted(id)) return false;

                const dx = transform.x - x;
                const dy = transform.y - y;
                const distSq = dx * dx + dy * dy;

                if (distSq < minDistSq) {
                    if (isDeposit) {
                        if (!storageComp.isFull) {
                            minDistSq = distSq;
                            bestId = id;
                            return true; // 최적의 저장소 발견
                        }
                    } else {
                        if ((storageComp.items[resourceType] || 0) >= 5) {
                            minDistSq = distSq;
                            bestId = id;
                            return true; // 최적의 저장소 발견
                        }
                    }
                }
                return false;
            });
        }
        return bestId;
    }

    _findBestBlueprint(x, y, entity, intent, forceGlobal = false) {
        const spatialHash = this.engine.spatialHash;
        const SEARCH_RADIUS = forceGlobal ? 2000 : 800;

        const aiState = entity.components.get('AIState');
        if (aiState) aiState.searchRange = SEARCH_RADIUS;

        const zone = forceGlobal ? null : this._getZone(entity, intent);

        // 🚀 [Optimization] Blackboard 순회 대신 SpatialHash 기반 쿼리로 통합
        let bestId = this.entityManager.findNearestEntityWithComponent(x, y, SEARCH_RADIUS, (ent) => {
            const struc = ent.components.get('Structure');
            const transform = ent.components.get('Transform');
            if (!struc || !struc.isBlueprint || struc.isComplete) return false;
            if (transform && !this._isInZone(transform.x, transform.y, zone)) return false;

            // 본인 마을 소속 청사진만
            const civ = ent.components.get('Civilization');
            const reqCiv = entity.components.get('Civilization');
            return civ && reqCiv && civ.villageId === reqCiv.villageId;
        }, spatialHash);

        return bestId;
    }
}
