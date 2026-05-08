import BaseJobState from './BaseJobState.js';
import Pathfinder from '../../../../utils/Pathfinder.js';

/**
 * ⚔️ SoldierState
 * 마을 수호 병사의 전투 전담 상태 클래스입니다.
 *
 * FSM:
 *   PATROLLING → (위협 감지) → ENGAGING → (적 사망/이탈) → PATROLLING
 *                             → (피격 치명상) → RETREATING → PATROLLING
 */
export default class SoldierState extends BaseJobState {

    enter(entityId, entity) {
        const jobCtrl = entity.components.get('JobController');
        if (jobCtrl) {
            jobCtrl.jobState = 'PATROLLING';
            jobCtrl.setData('patrolTarget', null);
            jobCtrl.setData('patrolTimer', 0);
            jobCtrl.setData('attackTimer', 0);
            jobCtrl.setData('engageTargetId', null);
        }
    }

    update(entityId, entity, dt) {
        const jobCtrl = entity.components.get('JobController');
        const transform = entity.components.get('Transform');
        const stats = entity.components.get('BaseStats');
        if (!jobCtrl || !transform) return null;

        const hpRatio = stats ? (stats.health / (stats.maxHealth || 100)) : 1;

        // 🏃 [자기 보존] HP 20% 이하면 즉시 후퇴
        if (hpRatio < 0.2 && jobCtrl.jobState !== 'RETREATING') {
            jobCtrl.jobState = 'RETREATING';
            jobCtrl.setData('engageTargetId', null);
        }

        switch (jobCtrl.jobState) {
            case 'PATROLLING':
                return this._doPatrol(entity, jobCtrl, transform, dt);
            case 'ENGAGING':
                return this._doEngage(entity, jobCtrl, transform, dt);
            case 'RETREATING':
                return this._doRetreat(entity, jobCtrl, transform, dt);
        }

        return null;
    }

    /** 🛡️ 순찰: 마을 거주 구역 내를 배회하며 위협을 스캔합니다. */
    _doPatrol(entity, jobCtrl, transform, dt) {
        const SCAN_RADIUS = 200;
        const SCAN_INTERVAL = 1.0; // 1초마다 스캔

        const scanTimer = (jobCtrl.getData('scanTimer') || 0) + dt;
        jobCtrl.setData('scanTimer', scanTimer);

        if (scanTimer >= SCAN_INTERVAL) {
            jobCtrl.setData('scanTimer', 0);
            const threatId = this._findNearestThreat(entity, transform, SCAN_RADIUS);
            if (threatId !== null) {
                jobCtrl.setData('engageTargetId', threatId);
                jobCtrl.jobState = 'ENGAGING';
                jobCtrl.setData('attackTimer', 0);
                return null;
            }
        }

        // 순찰 이동: 마을 중심 근처의 무작위 지점으로 이동
        let patrolTarget = jobCtrl.getData('patrolTarget');
        const patrolTimer = (jobCtrl.getData('patrolTimer') || 0) + dt;
        jobCtrl.setData('patrolTimer', patrolTimer);

        if (!patrolTarget || patrolTimer > 5.0) {
            patrolTarget = this._pickPatrolPoint(entity, transform);
            jobCtrl.setData('patrolTarget', patrolTarget);
            jobCtrl.setData('patrolTimer', 0);
        }

        if (patrolTarget) {
            Pathfinder.followPath(transform, jobCtrl, patrolTarget, 65, this.system.engine);
        }

        return null;
    }

    /** ⚔️ 교전: 타겟을 추적하고 사거리 내에서 공격합니다. */
    _doEngage(entity, jobCtrl, transform, dt) {
        const ATTACK_RANGE_SQ = 60 * 60;
        const LEASH_RANGE_SQ = 400 * 400; // 마을에서 너무 멀리 쫓아가지 않음
        const ATTACK_SPEED = 1.0; // 초당 공격 횟수

        const targetId = jobCtrl.getData('engageTargetId');
        if (!targetId) {
            jobCtrl.jobState = 'PATROLLING';
            return null;
        }

        const em = this.system.engine.entityManager;
        const target = em.entities.get(targetId);
        if (!target) {
            jobCtrl.setData('engageTargetId', null);
            jobCtrl.jobState = 'PATROLLING';
            return null;
        }

        // 적 생사 확인
        const tStats = target.components.get('BaseStats');
        if (tStats && tStats.health <= 0) {
            jobCtrl.setData('engageTargetId', null);
            jobCtrl.jobState = 'PATROLLING';
            return null;
        }

        const tTransform = target.components.get('Transform');
        if (!tTransform) { jobCtrl.jobState = 'PATROLLING'; return null; }

        const dx = tTransform.x - transform.x;
        const dy = tTransform.y - transform.y;
        const distSq = dx * dx + dy * dy;

        // 추격 한계를 넘어서면 포기
        const civ = entity.components.get('Civilization');
        const vs = this.system.engine.systemManager?.villageSystem;
        const village = civ && vs ? vs.getVillage(civ.villageId) : null;
        if (village) {
            const vdx = village.x - transform.x;
            const vdy = village.y - transform.y;
            if ((vdx * vdx + vdy * vdy) > LEASH_RANGE_SQ) {
                jobCtrl.setData('engageTargetId', null);
                jobCtrl.jobState = 'RETREATING';
                return null;
            }
        }

        if (distSq <= ATTACK_RANGE_SQ) {
            // 사거리 내 — 공격
            transform.vx = 0;
            transform.vy = 0;

            const attackTimer = (jobCtrl.getData('attackTimer') || 0) + dt;
            jobCtrl.setData('attackTimer', attackTimer);

            if (attackTimer >= ATTACK_SPEED) {
                jobCtrl.setData('attackTimer', 0);
                this.system.eventBus.emit('COMBAT_ATTACK', { attacker: entity, defender: target });
            }
        } else {
            // 사거리 밖 — 추격
            Pathfinder.followPath(transform, jobCtrl, tTransform, 80, this.system.engine);
        }

        return null;
    }

    /** 🏃 후퇴: 마을 방향으로 달아납니다. */
    _doRetreat(entity, jobCtrl, transform, dt) {
        const civ = entity.components.get('Civilization');
        const vs = this.system.engine.systemManager?.villageSystem;
        const village = civ && vs ? vs.getVillage(civ.villageId) : null;
        const stats = entity.components.get('BaseStats');

        if (village) {
            Pathfinder.followPath(transform, jobCtrl, { x: village.x, y: village.y }, 90, this.system.engine);
            const dx = village.x - transform.x;
            const dy = village.y - transform.y;
            if (dx * dx + dy * dy < 100 * 100) {
                // 마을에 도착했고 어느 정도 체력 회복 (자연 회복은 HumanBehaviorSystem에서)
                jobCtrl.jobState = 'PATROLLING';
            }
        } else {
            jobCtrl.jobState = 'PATROLLING';
        }

        return null;
    }

    /** 📡 주변 위협 탐지 (적 국가 인간, 맹수) */
    _findNearestThreat(entity, transform, radius) {
        const spatialHash = this.system.engine.spatialHash;
        const em = this.system.engine.entityManager;
        const combatSystem = this.system.engine.systemManager?.combatSystem;
        const civ = entity.components.get('Civilization');
        const ns = this.system.engine.systemManager?.nationSystem;
        const vs = this.system.engine.systemManager?.villageSystem;

        if (!spatialHash || !civ) return null;

        const ownVillage = vs?.getVillage(civ.villageId);
        const ownNationId = civ.nationId ?? ownVillage?.nationId ?? -1;

        let bestId = null;
        let bestDistSq = radius * radius;

        spatialHash.eachInRange(transform.x, transform.y, radius, (otherId) => {
            if (otherId === entity.id) return;
            const other = em.entities.get(otherId);
            if (!other) return;

            const otherTransform = other.components.get('Transform');
            if (!otherTransform) return;

            const dx = otherTransform.x - transform.x;
            const dy = otherTransform.y - transform.y;
            const distSq = dx * dx + dy * dy;
            if (distSq >= bestDistSq) return;

            let isThreat = false;

            // 1. 🏴 적 국가의 인간
            const otherCiv = other.components.get('Civilization');
            if (otherCiv && ownNationId !== -1 && ns) {
                const otherVillage = vs?.getVillage(otherCiv.villageId);
                const otherNationId = otherCiv.nationId ?? otherVillage?.nationId ?? -1;
                if (otherNationId !== -1 && ns.isAtWar(ownNationId, otherNationId)) {
                    isThreat = true;
                }
            }

            // 2. 🐺 야생 맹수 (Animal 컴포넌트를 가졌으나 마을 소속이 아닌 것)
            const animal = other.components.get('Animal');
            if (animal && !otherCiv && animal.isPredator) {
                isThreat = true;
            }

            if (isThreat) {
                bestDistSq = distSq;
                bestId = otherId;
            }
        });

        return bestId;
    }

    /** 🗺️ 순찰 지점 선정: 마을 중심 근처 무작위 점 */
    _pickPatrolPoint(entity, transform) {
        const civ = entity.components.get('Civilization');
        const vs = this.system.engine.systemManager?.villageSystem;
        const village = civ && vs ? vs.getVillage(civ.villageId) : null;

        if (village) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 60 + Math.random() * 100;
            return {
                x: village.x + Math.cos(angle) * radius,
                y: village.y + Math.sin(angle) * radius
            };
        }

        // fallback: 현재 위치 근처
        return {
            x: transform.x + (Math.random() - 0.5) * 120,
            y: transform.y + (Math.random() - 0.5) * 120
        };
    }

    exit(entityId, entity) {
        const jobCtrl = entity.components.get('JobController');
        if (jobCtrl) jobCtrl.interrupt();
    }
}
