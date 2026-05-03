import BaseJobState from './BaseJobState.js';
import Pathfinder from '../../../../utils/Pathfinder.js';

export default class LumberjackState extends BaseJobState {
    enter(entityId, entity) {
        const jobCtrl = entity.components.get('JobController');
        if (jobCtrl) {
            jobCtrl.jobState = 'SEARCHING';
            jobCtrl.targetId = null;
        }
    }

    update(entityId, entity, dt) {
        const jobCtrl = entity.components.get('JobController');
        const transform = entity.components.get('Transform');
        
        if (!jobCtrl || !transform) return null;

        // 1. 구역 이탈 방지 (Edge Case)
        if (this.checkOutOfBounds(entity)) {
            // 구역으로 복귀하는 로직 (ReturnToZone)
            const zoneManager = this.system.engine.systemManager?.zoneManager;
            if (zoneManager) {
                const zone = zoneManager.getZone(jobCtrl.zoneId);
                if (zone) {
                    const speed = 60;
                    // 중앙으로 임시 이동 (이후 Pathfinder.findPathToZone 등으로 교체)
                    const targetPos = {
                        x: zone.bounds.minX + zone.bounds.width / 2,
                        y: zone.bounds.minY + zone.bounds.height / 2
                    };
                    Pathfinder.followPath(transform, jobCtrl, targetPos, speed, this.system.engine);
                    return null;
                }
            }
        }

        // 2. Job FSM 로직
        if (jobCtrl.jobState === 'SEARCHING') {
            this.findTreeInZone(entity, jobCtrl);
        } else if (jobCtrl.jobState === 'MOVING') {
            this.moveToTree(entity, jobCtrl, transform);
        } else if (jobCtrl.jobState === 'CHOPPING') {
            this.chopTree(entity, jobCtrl, dt);
        }

        return null;
    }

    findTreeInZone(entity, jobCtrl) {
        const targetManager = this.system.engine.systemManager.targetManager;
        if (!targetManager) return;

        // 타겟 요청 실패 시 처리
        if (jobCtrl.targetRequestFailed) {
            jobCtrl.targetRequestFailed = false;
            jobCtrl.isTargetRequested = false;
            jobCtrl.jobState = 'SEARCHING'; // 다시 탐색 시도 (또는 잠시 대기)
            return;
        }

        // 중앙 관제에 나무 타겟 요청 (구역 정보 포함)
        if (!jobCtrl.isTargetRequested) {
            targetManager.requestTarget(entity.id, 'RESOURCE', { 
                resourceType: 'wood',
                zoneId: jobCtrl.zoneId 
            }, 'job_logger');
            jobCtrl.isTargetRequested = true;
        }

        // ⏳ 내부 대기 연출
        const transform = entity.components.get('Transform');
        if (transform && !jobCtrl.targetId) {
            transform.vx *= 0.7;
            transform.vy *= 0.7;
        }

        // TargetManager가 targetId를 주입해줄 때까지 대기 상태 유도 가능 (여기서는 FSM 내부 상태로 처리)
        if (jobCtrl.targetId) {
            jobCtrl.isTargetRequested = false;
            jobCtrl.jobState = 'MOVING';
        }
    }

    moveToTree(entity, jobCtrl, transform) {
        const target = this.system.engine.entityManager.entities.get(jobCtrl.targetId);
        if (!target) {
            jobCtrl.jobState = 'SEARCHING';
            return;
        }

        const tPos = target.components.get('Transform');
        if (!tPos) return;

        const distSq = (tPos.x - transform.x) ** 2 + (tPos.y - transform.y) ** 2;
        if (distSq <= 100) { // 10px 이내
            jobCtrl.jobState = 'CHOPPING';
            jobCtrl.chopTimer = 0;
            transform.vx = 0;
            transform.vy = 0;
        } else {
            const speed = 60;
            Pathfinder.followPath(transform, jobCtrl, tPos, speed, this.system.engine);
        }
    }

    chopTree(entity, jobCtrl, dt) {
        const target = this.system.engine.entityManager.entities.get(jobCtrl.targetId);
        if (!target) {
            jobCtrl.jobState = 'SEARCHING';
            return;
        }

        jobCtrl.chopTimer = (jobCtrl.chopTimer || 0) + dt;
        const chopInterval = 1.0; // 1초마다 도끼질

        if (jobCtrl.chopTimer >= chopInterval) {
            jobCtrl.chopTimer = 0;
            
            const res = target.components.get('Resource');
            const inv = entity.components.get('Inventory');
            
            if (res && inv) {
                // 🪓 나무에서 5개씩 추출 (인벤토리에 추가 대신 바닥에 드랍)
                const extracted = res.extract(5);
                if (extracted > 0) {
                    const tPos = target.components.get('Transform');
                    const itemFactory = this.system.engine.factoryProvider.getFactory('item');

                    if (itemFactory && tPos) {
                        const dropType = res.type || 'wood';
                        itemFactory.spawnDrop(tPos.x, tPos.y, dropType, extracted);
                    }
                    
                    // 타격 파티클
                    if (tPos) {
                        this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                            x: tPos.x, y: tPos.y - 15, count: 4, type: 'EFFECT', color: '#8d6e63', speed: 2
                        });
                    }
                }

                // 나무가 다 고갈되었을 때만 삭제 및 다음 탐색
                if (res.value <= 0) {
                    this.system.engine.entityManager.removeEntity(jobCtrl.targetId);
                    jobCtrl.targetId = null;
                    jobCtrl.jobState = 'SEARCHING';
                }
                
                // 인벤토리가 꽉 찼으면 창고로 가야 하지만, LumberjackState는 단순화된 버전이므로 
                // 여기서는 나무 고갈 시에만 상태를 전환함.
            } else {
                // 컴포넌트가 없으면 안전하게 포기
                jobCtrl.targetId = null;
                jobCtrl.jobState = 'SEARCHING';
            }
        }
    }

    exit(entityId, entity) {
        const jobCtrl = entity.components.get('JobController');
        if (jobCtrl) {
            jobCtrl.interrupt();
        }
    }
}
