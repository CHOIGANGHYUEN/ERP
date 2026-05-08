import BaseJobState from './BaseJobState.js';
import Pathfinder from '../../../../utils/Pathfinder.js';

/**
 * 🚚 TransporterState (고도화)
 * 마을 할일 목록(TaskBoard)의 운반 과업을 수주하고 자원을 물류 이동합니다.
 *
 * FSM:
 *   FINDING_TASK → GOING_TO_SOURCE → PICKING_UP → GOING_TO_DEST → DEPOSITING → FINDING_TASK
 *
 * 특징:
 *   - 마을 TaskBoard에서 가장 우선순위 높은 운반 과업 자동 수주
 *   - 드롭된 아이템 픽업 또는 창고 인출 모두 처리
 *   - 인벤토리 용량 초과 시 즉시 창고로 복귀
 *   - 목적지 창고가 가득 찼을 때 대안 창고 탐색
 */
export default class TransporterState extends BaseJobState {

    enter(entityId, entity) {
        const jobCtrl = entity.components.get('JobController');
        if (jobCtrl) {
            jobCtrl.jobState = 'FINDING_TASK';
            jobCtrl.setData('transportTask', null);
            jobCtrl.setData('waitTimer', 0);
            jobCtrl.setData('carriedType', null);
            jobCtrl.setData('carriedAmount', 0);
        }
    }

    update(entityId, entity, dt) {
        const jobCtrl = entity.components.get('JobController');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        if (!jobCtrl || !transform) return null;

        switch (jobCtrl.jobState) {
            case 'FINDING_TASK':
                return this._findTask(entity, jobCtrl, inventory);
            case 'GOING_TO_SOURCE':
                return this._goToSource(entity, jobCtrl, transform, dt);
            case 'PICKING_UP':
                return this._pickUp(entity, jobCtrl, transform, inventory, dt);
            case 'GOING_TO_DEST':
                return this._goToDest(entity, jobCtrl, transform, dt);
            case 'DEPOSITING':
                return this._deposit(entity, jobCtrl, inventory, dt);
        }

        return null;
    }

    // ─────────────────────────────────────────────────
    // 1. 과업 수주
    // ─────────────────────────────────────────────────
    _findTask(entity, jobCtrl, inventory) {
        const civ = entity.components.get('Civilization');
        const vs = this.system.engine.systemManager?.villageSystem;
        if (!civ || !vs) return null;

        const village = vs.getVillage(civ.villageId);
        if (!village || !village.taskBoard) return null;

        // 인벤토리에 이미 짐을 들고 있으면 곧장 창고로
        const carriedType = jobCtrl.getData('carriedType');
        const carriedAmount = jobCtrl.getData('carriedAmount') || 0;
        if (carriedType && carriedAmount > 0) {
            jobCtrl.jobState = 'GOING_TO_DEST';
            return null;
        }

        // TaskBoard에서 pickup 또는 gather 타입의 과업 중 우선순위 최고 항목 수주
        const tasks = village.taskBoard
            .filter(t => t.status === 'AVAILABLE' && (t.type === 'pickup_wood' || t.type === 'pickup_food' || t.type === 'pickup_stone'))
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

        if (tasks.length === 0) {
            // 과업 없음 — 짧게 대기 후 재시도 (idle 상태로 돌아가지 않음)
            const waitTimer = (jobCtrl.getData('waitTimer') || 0);
            jobCtrl.setData('waitTimer', waitTimer + 0.5);
            if (waitTimer > 3.0) {
                jobCtrl.setData('waitTimer', 0);
                return 'idle'; // 3초 이상 과업 없으면 idle로 귀환
            }
            return null;
        }

        const task = tasks[0];
        task.status = 'CLAIMED';
        task.claimedBy = entity.id;
        jobCtrl.setData('transportTask', task);
        jobCtrl.setData('waitTimer', 0);

        // 타입 → 리소스 타입 파싱
        const resType = task.type.replace('pickup_', '');
        jobCtrl.setData('carriedType', resType);
        jobCtrl.jobState = 'GOING_TO_SOURCE';

        return null;
    }

    // ─────────────────────────────────────────────────
    // 2. 소스(드롭 아이템)로 이동
    // ─────────────────────────────────────────────────
    _goToSource(entity, jobCtrl, transform, dt) {
        const resType = jobCtrl.getData('carriedType');
        const civ = entity.components.get('Civilization');
        const em = this.system.engine.entityManager;
        const spatialHash = this.system.engine.spatialHash;

        // 가장 가까운 드롭 아이템 탐색
        let targetId = jobCtrl.getData('sourceItemId');
        if (!targetId) {
            let bestId = null;
            let bestDistSq = 800 * 800;

            if (spatialHash) {
                spatialHash.eachInRange(transform.x, transform.y, 800, (id) => {
                    const ent = em.entities.get(id);
                    const drop = ent?.components.get('DroppedItem');
                    if (!drop || drop.itemType !== resType) return;
                    if (drop.claimedBy && drop.claimedBy !== entity.id) return;
                    if (civ && drop.villageId !== -1 && drop.villageId !== civ.villageId) return;

                    const t = ent.components.get('Transform');
                    if (!t) return;
                    const dx = t.x - transform.x;
                    const dy = t.y - transform.y;
                    const dSq = dx * dx + dy * dy;
                    if (dSq < bestDistSq) {
                        bestDistSq = dSq;
                        bestId = id;
                    }
                });
            }

            if (!bestId) {
                // 아이템 없음 — 과업 취소
                this._cancelTask(jobCtrl, entity, civ, this.system.engine.systemManager?.villageSystem);
                return null;
            }

            targetId = bestId;
            jobCtrl.setData('sourceItemId', bestId);
            // 아이템 예약
            const dropEnt = em.entities.get(bestId);
            if (dropEnt?.components.get('DroppedItem')) {
                dropEnt.components.get('DroppedItem').claimedBy = entity.id;
            }
        }

        const sourceEnt = em.entities.get(targetId);
        if (!sourceEnt) {
            jobCtrl.setData('sourceItemId', null);
            jobCtrl.jobState = 'FINDING_TASK';
            return null;
        }

        const sPos = sourceEnt.components.get('Transform');
        const reached = Pathfinder.followPath(transform, jobCtrl, sPos, 70, this.system.engine);
        if (reached) {
            jobCtrl.jobState = 'PICKING_UP';
            jobCtrl.setData('waitTimer', 0);
        }
        return null;
    }

    // ─────────────────────────────────────────────────
    // 3. 아이템 픽업
    // ─────────────────────────────────────────────────
    _pickUp(entity, jobCtrl, transform, inventory, dt) {
        const em = this.system.engine.entityManager;
        const sourceId = jobCtrl.getData('sourceItemId');
        const sourceEnt = em.entities.get(sourceId);
        const drop = sourceEnt?.components.get('DroppedItem');

        if (!drop) {
            jobCtrl.setData('sourceItemId', null);
            jobCtrl.jobState = 'FINDING_TASK';
            return null;
        }

        // 짧은 픽업 딜레이 (0.3초)
        const t = (jobCtrl.getData('waitTimer') || 0) + dt;
        jobCtrl.setData('waitTimer', t);
        if (t < 0.3) return null;

        const amount = drop.amount || 1;
        const resType = drop.itemType;

        // 인벤토리에 추가
        if (inventory) {
            inventory.add(resType, amount);
        }
        jobCtrl.setData('carriedAmount', amount);
        jobCtrl.setData('carriedType', resType);

        // 아이템 제거
        em.removeEntity(sourceId);
        jobCtrl.setData('sourceItemId', null);
        jobCtrl.setData('waitTimer', 0);
        jobCtrl.jobState = 'GOING_TO_DEST';
        return null;
    }

    // ─────────────────────────────────────────────────
    // 4. 목적지(창고)로 이동
    // ─────────────────────────────────────────────────
    _goToDest(entity, jobCtrl, transform, dt) {
        const resType = jobCtrl.getData('carriedType');
        const civ = entity.components.get('Civilization');
        const em = this.system.engine.entityManager;

        // 목적지 창고 탐색
        let destId = jobCtrl.getData('destStorageId');
        if (!destId) {
            destId = this._findStorage(transform, civ, em, true);
            if (!destId) {
                // 창고 없음 — 아이템 버리고 idle
                jobCtrl.setData('carriedType', null);
                jobCtrl.setData('carriedAmount', 0);
                jobCtrl.jobState = 'FINDING_TASK';
                return null;
            }
            jobCtrl.setData('destStorageId', destId);
        }

        const destEnt = em.entities.get(destId);
        if (!destEnt) {
            jobCtrl.setData('destStorageId', null);
            return null;
        }

        const dPos = destEnt.components.get('Transform');
        const reached = Pathfinder.followPath(transform, jobCtrl, dPos, 60, this.system.engine);
        if (reached) {
            jobCtrl.jobState = 'DEPOSITING';
            jobCtrl.setData('waitTimer', 0);
        }
        return null;
    }

    // ─────────────────────────────────────────────────
    // 5. 창고에 자원 납입
    // ─────────────────────────────────────────────────
    _deposit(entity, jobCtrl, inventory, dt) {
        const em = this.system.engine.entityManager;
        const destId = jobCtrl.getData('destStorageId');
        const destEnt = em.entities.get(destId);
        const storage = destEnt?.components.get('Storage');

        if (!storage) {
            jobCtrl.setData('destStorageId', null);
            jobCtrl.jobState = 'FINDING_TASK';
            return null;
        }

        const t = (jobCtrl.getData('waitTimer') || 0) + dt;
        jobCtrl.setData('waitTimer', t);
        if (t < 0.4) return null;

        const resType = jobCtrl.getData('carriedType');
        const amount = jobCtrl.getData('carriedAmount') || 0;

        if (storage.isFull) {
            // 창고 꽉 참 — 대안 창고 탐색
            const civ = entity.components.get('Civilization');
            const transform = entity.components.get('Transform');
            const altId = this._findStorage(transform, civ, em, true);
            if (altId && altId !== destId) {
                jobCtrl.setData('destStorageId', altId);
                jobCtrl.jobState = 'GOING_TO_DEST';
            } else {
                // 모든 창고가 꽉 참 — 마을 창고에 강제 납입 후 종료
                storage.addItem(resType, amount);
                if (inventory) inventory.remove(resType, amount);
                this._completeTask(jobCtrl, entity);
            }
            return null;
        }

        const added = storage.addItem(resType, amount);
        if (inventory) inventory.remove(resType, Math.min(added, amount));
        jobCtrl.setData('carriedAmount', Math.max(0, amount - added));
        jobCtrl.setData('carriedType', null);

        this._completeTask(jobCtrl, entity);
        return null;
    }

    // ─────────────────────────────────────────────────
    // 헬퍼 메서드
    // ─────────────────────────────────────────────────
    _findStorage(transform, civ, em, isDeposit) {
        const spatialHash = this.system.engine.spatialHash;
        if (!spatialHash || !transform) return null;

        let bestId = null;
        let bestDistSq = 2000 * 2000;

        spatialHash.eachInRange(transform.x, transform.y, 2000, (id) => {
            const ent = em.entities.get(id);
            if (!ent) return;
            const storage = ent.components.get('Storage');
            if (!storage) return;
            const struct = ent.components.get('Structure');
            if (struct && !struct.isComplete) return;
            const entCiv = ent.components.get('Civilization');
            if (!entCiv || !civ || entCiv.villageId !== civ.villageId) return;
            if (isDeposit && storage.isFull) return;

            const t = ent.components.get('Transform');
            if (!t) return;
            const dx = t.x - transform.x;
            const dy = t.y - transform.y;
            const dSq = dx * dx + dy * dy;
            if (dSq < bestDistSq) {
                bestDistSq = dSq;
                bestId = id;
            }
        });

        return bestId;
    }

    _cancelTask(jobCtrl, entity, civ, vs) {
        const task = jobCtrl.getData('transportTask');
        if (task && civ && vs) {
            const village = vs.getVillage(civ.villageId);
            if (village?.taskBoard) {
                const t = village.taskBoard.find(t => t.id === task.id);
                if (t) { t.status = 'AVAILABLE'; t.claimedBy = null; }
            }
        }
        jobCtrl.setData('transportTask', null);
        jobCtrl.setData('sourceItemId', null);
        jobCtrl.setData('carriedType', null);
        jobCtrl.setData('carriedAmount', 0);
        jobCtrl.jobState = 'FINDING_TASK';
    }

    _completeTask(jobCtrl, entity) {
        const task = jobCtrl.getData('transportTask');
        if (task) {
            const civ = entity.components.get('Civilization');
            const vs = this.system.engine.systemManager?.villageSystem;
            const village = civ && vs ? vs.getVillage(civ.villageId) : null;
            if (village?.taskBoard) {
                const idx = village.taskBoard.findIndex(t => t.id === task.id);
                if (idx !== -1) village.taskBoard[idx].status = 'DONE';
            }
        }

        jobCtrl.setData('transportTask', null);
        jobCtrl.setData('sourceItemId', null);
        jobCtrl.setData('destStorageId', null);
        jobCtrl.setData('carriedType', null);
        jobCtrl.setData('carriedAmount', 0);
        jobCtrl.setData('waitTimer', 0);
        jobCtrl.jobState = 'FINDING_TASK';
    }

    exit(entityId, entity) {
        const jobCtrl = entity.components.get('JobController');
        if (jobCtrl) jobCtrl.interrupt();
    }
}
