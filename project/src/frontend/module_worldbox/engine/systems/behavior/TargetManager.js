/**
 * 🎯 TargetManager.js
 * 전역 타겟 할당 관제탑입니다.
 * 개체가 타겟을 요청하면 최적의 대상을 찾아 직접 주입합니다.
 */
export default class TargetManager {
    constructor(entityManager, eventBus, blackboard) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.blackboard = blackboard;
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
        if (this.pendingRequests.length === 0) return;

        // 한 프레임에 처리할 최대 요청 수 제한 (성능 조절)
        const processCount = Math.min(this.pendingRequests.length, 20);
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

        switch (targetType) {
            case 'RESOURCE':
                bestTargetId = this._findBestResource(transform, criteria, entityId);
                break;
            case 'STORAGE_DEPOSIT':
                bestTargetId = this._findBestStorageForDeposit(transform, criteria, entityId);
                break;
            case 'STORAGE_WITHDRAW':
                bestTargetId = this._findBestStorageForWithdraw(transform, criteria, entityId);
                break;
            case 'BLUEPRINT':
                bestTargetId = this._findBestBlueprint(transform, criteria, entityId);
                break;
        }

        if (bestTargetId) {
            const aiState = entity.components.get('AIState');
            if (aiState) {
                // 할당 성공 시 요청 상태 해제
                aiState.isTargetRequested = false;
                aiState.targetRequestFailed = false;

                // 건설 중 자원을 가지러 가는 경우, 메인 타겟(청사진)은 유지하고 서브 타겟(창고)에 주입
                if (targetType === 'STORAGE_WITHDRAW' && req.intent === 'build') {
                    aiState.storageTargetId = bestTargetId;
                } else {
                    aiState.targetId = bestTargetId;
                }

                // 🔒 할당받은 자원/엔티티에 예약 정보 기록 (Claiming) 및 이름 추출
                const targetEnt = this.entityManager.entities.get(bestTargetId);
                if (targetEnt) {
                    const res = targetEnt.components.get('Resource');
                    const anim = targetEnt.components.get('Animal');
                    const struc = targetEnt.components.get('Structure');
                    if (res) res.claimedBy = entityId;
                    if (anim) anim.claimedBy = entityId;

                    // UI 표시용 이름 저장
                    aiState.targetName = (struc?.type || res?.type || anim?.type || 'Entity').toUpperCase();
                }

                // 할당받은 타겟의 용도를 명시 (인텐트 복구)
                if (req.intent) aiState.mode = req.intent;

                this.eventBus.emit('TARGET_ASSIGNED', {
                    entityId,
                    targetId: bestTargetId,
                    intent: req.intent
                });
            }

            // JobController가 있는 경우에도 처리
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
            // ❌ 타겟을 실제로 찾지 못한 경우에만 실행
            const aiState = entity.components.get('AIState');
            if (aiState) {
                aiState.isTargetRequested = false;
                aiState.targetRequestFailed = true;
                aiState.lastRequestTime = Date.now();
            }

            this.eventBus.emit('TARGET_NOT_FOUND', { entityId, targetType, intent: req.intent });
        }
    }

    _findBestResource(pos, criteria, requesterId) {
        const resourceType = (criteria.resourceType || '').toLowerCase();
        const nodes = this.blackboard.resourceNodes.get(resourceType) || [];
        let minDistSq = Infinity;
        let bestId = null;

        // 구역 정보 가져오기
        let zoneBounds = null;
        if (criteria.zoneId !== undefined) {
            const zm = this.entityManager.engine?.systemManager?.zoneManager;
            const zone = zm?.getZone(criteria.zoneId);
            if (zone) zoneBounds = zone.bounds;
        }

        for (const node of nodes) {
            // 구역 필터링
            if (zoneBounds) {
                if (node.x < zoneBounds.minX || node.x > zoneBounds.maxX ||
                    node.y < zoneBounds.minY || node.y > zoneBounds.maxY) continue;
            }

            const dx = node.x - pos.x;
            const dy = node.y - pos.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < minDistSq) {
                // 🛑 [Blacklist Check] 도달 불가능하다고 판명된 타겟은 제외
                const aiState = this.entityManager.entities.get(requesterId)?.components.get('AIState');
                if (aiState && aiState.unreachableTargets && aiState.unreachableTargets.has(node.id)) {
                    continue;
                }

                const ent = this.entityManager.entities.get(node.id);
                if (ent) {
                    const res = ent.components.get('Resource');
                    if (res && res.value > 0 && !res.isFalling) {
                        // 🔒 [Ghost Claim Resolution]
                        // 예약자가 있지만, 그 예약자가 이미 죽었거나 다른 일을 하고 있다면 예약을 해제합니다.
                        if (res.claimedBy && res.claimedBy !== requesterId) {
                            const claimer = this.entityManager.entities.get(res.claimedBy);
                            if (!claimer || claimer.components.get('AIState')?.targetId !== node.id) {
                                res.claimedBy = null; // 예약 해제
                            }
                        }

                        if (!res.claimedBy || res.claimedBy === requesterId) {
                            minDistSq = distSq;
                            bestId = node.id;
                        }
                    }
                }
            }
        }
        return bestId;
    }

    _findBestStorageForDeposit(pos, criteria) {
        const storages = this.blackboard.storages;
        let minDistSq = Infinity;
        let bestId = null;

        for (const s of storages) {
            const dx = s.x - pos.x;
            const dy = s.y - pos.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < minDistSq) {
                const ent = this.entityManager.entities.get(s.id);
                const storageComp = ent?.components.get('Storage');
                if (storageComp && !storageComp.isFull) {
                    minDistSq = distSq;
                    bestId = s.id;
                }
            }
        }
        return bestId;
    }

    _findBestStorageForWithdraw(pos, criteria) {
        if (!this.blackboard.storages) return null;
        const { resourceType, amount = 1 } = criteria;
        const storages = this.blackboard.storages;
        let minDistSq = Infinity;
        let bestId = null;

        for (const s of storages) {
            const dx = s.x - pos.x;
            const dy = s.y - pos.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < minDistSq) {
                const ent = this.entityManager.entities.get(s.id);
                const storageComp = ent?.components.get('Storage');
                if (storageComp && (storageComp.items[resourceType] || 0) >= amount) {
                    minDistSq = distSq;
                    bestId = s.id;
                }
            }
        }
        return bestId;
    }

    _findBestBlueprint(pos, criteria, requesterId) {
        let minDistSq = Infinity;
        let bestId = null;
        const blueprints = this.blackboard.blueprints || [];

        for (const bp of blueprints) {
            const id = bp.id;
            const entity = this.entityManager.entities.get(id);
            if (!entity) continue;

            const structure = entity.components.get('Structure');
            const transform = entity.components.get('Transform');
            
            if (structure && structure.isBlueprint && transform && !structure.isComplete) {
                // 🛑 [Blacklist Check] 도달 불가능 타겟 제외
                const aiState = this.entityManager.entities.get(requesterId)?.components.get('AIState');
                if (aiState && aiState.unreachableTargets && aiState.unreachableTargets.has(id)) {
                    continue;
                }

                const dx = transform.x - pos.x;
                const dy = transform.y - pos.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    bestId = id;
                }
            }
        }
        return bestId;
    }
}
