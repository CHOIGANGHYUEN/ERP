import ObjectPool from '../../utils/ObjectPool.js';
import StrategyRegistry from './strategies/StrategyRegistry.js';

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

        // 🎯 [Strategy Pattern] 전략 레지스트리를 통한 탐색 위임 (OCP 달성)
        const strategy = StrategyRegistry.get(targetType);
        
        if (strategy) {
            bestTargetId = strategy.execute(this, entity, transform, criteria, req.intent, forceDeferred);
            
            // 🚀 [Expert Optimization] 첫 탐색에서 실패 시, 즉시 전역 탐색하지 않고 저우선순위 큐로 지연
            if ((bestTargetId === null || bestTargetId === undefined) && !forceDeferred) {
                const needsDeferred = ['RESOURCE', 'BLUEPRINT', 'STORAGE'].includes(targetType);
                if (needsDeferred) {
                    req.isDeferred = true;
                    this.lowPriorityQueue.push(req);
                    return;
                }
            }
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
                // 🛠️ [Architect Flexibility] 건축가 등 비전문화된 채집 행동은 구역 제한을 완화합니다.
                const isGatherIntent = intent === 'gather_wood' || intent === 'gather_plant' || intent === 'gather_stone';
                
                if (isGatherIntent) {
                    const jobType = civ.jobType;
                    // 벌목꾼, 광부, 채집가만 구역(LumberZone)에 묶이고, 나머지는 자유롭게 채집 가능
                    const isProfessionalGatherer = jobType === 'logger' || jobType === 'miner' || jobType === 'gatherer';
                    
                    if (isProfessionalGatherer) {
                        return zm.getZone(village.lumberZoneId);
                    } else {
                        // 건축가 등은 구역 제한 없이 근처 자원을 채집하도록 허용 (null 반환)
                        return null;
                    }
                }
                
                if (intent === 'build') return zm.getZone(village.residentialZoneId);
                
                // forage, eat 등은 구역 제한 없이 전역 탐색 유도 (null 반환)
                return null;
            }
        }
        return null;
    }
}
