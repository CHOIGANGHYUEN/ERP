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

        switch (targetType) {
            case 'RESOURCE':
                bestTargetId = this._findBestResource(transform.x, transform.y, criteria.resourceType, entity, req.intent);
                break;
            case 'STORAGE':
            case 'STORAGE_DEPOSIT':
                bestTargetId = this._findBestStorage(transform.x, transform.y, criteria.resourceType, true);
                break;
            case 'STORAGE_WITHDRAW':
                bestTargetId = this._findBestStorage(transform.x, transform.y, criteria.resourceType, false);
                break;
            case 'BLUEPRINT':
                bestTargetId = this._findBestBlueprint(transform.x, transform.y, entity);
                break;
            case 'WANDER':
                // 배회는 별도 타겟 없이 위치만 결정 (State에서 처리)
                break;
        }

        if (bestTargetId) {
            const aiState = entity.components.get('AIState');
            if (aiState) {
                // 🛑 [Blacklist Safety] 도달 불가 타겟이면 즉시 포기
                if (aiState.unreachableTargets && aiState.unreachableTargets.has(bestTargetId)) {
                    this.eventBus.emit('TARGET_NOT_FOUND', { entityId, targetType, intent: req.intent });
                    return;
                }

                // 할당 성공 시 요청 상태 해제
                aiState.isTargetRequested = false;
                aiState.targetRequestFailed = false;

                // 🏗️ [Architect Protection] 건설 중인 개체는 메인 타겟(청사진)을 보호해야 함
                // 모든 자원/창고 관련 요청은 서브 타겟(storageTargetId)에 할당하여 메인 타겟 유실 방지
                const isSubTask = ['STORAGE', 'RESOURCE', 'STORAGE_WITHDRAW'].includes(targetType);
                if (req.intent === 'build' && isSubTask) {
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

    _findBestResource(x, y, resourceType, entity, intent) {
        const type = (resourceType || '').toLowerCase();
        const nodes = this.blackboard.resourceNodes.get(type) || [];
        const MAX_RADIUS_SQ = 1200 * 1200; // 🚀 [Optimization] 최대 탐색 반경 제한
        
        let minDistSq = Infinity;
        let bestId = null;
        const aiState = entity.components.get('AIState');

        for (const node of nodes) {
            const dx = node.x - x;
            const dy = node.y - y;
            const distSq = dx * dx + dy * dy;

            if (distSq > MAX_RADIUS_SQ || distSq >= minDistSq) continue;

            if (aiState && aiState.unreachableTargets && aiState.unreachableTargets.has(node.id)) continue;

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
                    if (!drop.claimedBy || drop.claimedBy === entity.id) {
                        minDistSq = distSq;
                        bestId = node.id;
                    }
                }
            }
        }
        return bestId;
    }

    _findBestStorage(x, y, resourceType, isDeposit) {
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

    _findBestBlueprint(x, y, entity) {
        const blueprints = this.blackboard.blueprints || [];
        let bestId = null;
        let minDistSq = Infinity;

        // 1. Blackboard 캐시 활용 (우선순위)
        for (const bp of blueprints) {
            const bpEntity = this.entityManager.entities.get(bp.id);
            if (!bpEntity) continue;
            const t = bpEntity.components.get('Transform');
            if (!t) continue;

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
                return struc && struc.isBlueprint && !struc.isComplete;
            }); // spatialHash는 내부적으로 사용됨
        }

        return bestId;
    }
}
