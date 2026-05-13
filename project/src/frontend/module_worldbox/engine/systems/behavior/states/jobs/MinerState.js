import BaseJobState from './BaseJobState.js';
import Pathfinder from '../../../../utils/Pathfinder.js';

/**
 * ⛏️ MinerState
 * 광석 채굴 업무를 전담하는 상태 클래스입니다.
 */
export default class MinerState extends BaseJobState {
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

        // 1. 구역 이탈 체크
        if (this.checkOutOfBounds(entity)) {
            this.returnToZone(entity, transform, jobCtrl);
            return null;
        }

        // 2. 업무 FSM
        switch (jobCtrl.jobState) {
            case 'SEARCHING':
                // 🚀 [Optimization] 매 프레임 검색하는 대신 1.5초 간격으로 검색 수행
                jobCtrl.setData('searchTimer', (jobCtrl.getData('searchTimer') || 0) + dt);
                if (jobCtrl.getData('searchTimer') >= 1.5) {
                    this.findMinerals(entity, jobCtrl);
                    jobCtrl.setData('searchTimer', 0);
                }
                break;
            case 'MOVING':
                this.moveToMineral(entity, jobCtrl, transform);
                break;
            case 'MINING':
                this.mineMineral(entity, jobCtrl, dt);
                break;
        }

        return null;
    }

    findMinerals(entity, jobCtrl) {
        const targetManager = this.system.engine.systemManager.targetManager;
        if (!targetManager) return;

        if (jobCtrl.targetRequestFailed) {
            jobCtrl.targetRequestFailed = false;
            jobCtrl.isTargetRequested = false;
            return;
        }

        if (!jobCtrl.isTargetRequested) {
            // 중앙 관제에 광석 타겟 요청
            targetManager.requestTarget(entity.id, 'RESOURCE', { 
                category: 'mineral',
                zoneId: jobCtrl.zoneId 
            }, 'job_miner');
            jobCtrl.isTargetRequested = true;
        }

        if (jobCtrl.targetId) {
            jobCtrl.isTargetRequested = false;
            jobCtrl.jobState = 'MOVING';
        }
    }

    moveToMineral(entity, jobCtrl, transform) {
        const target = this.system.engine.entityManager.entities.get(jobCtrl.targetId);
        if (!target) {
            jobCtrl.jobState = 'SEARCHING';
            return;
        }

        const tPos = target.components.get('Transform');
        if (!tPos) {
            jobCtrl.jobState = 'SEARCHING';
            return;
        }

        const distSq = (tPos.x - transform.x) ** 2 + (tPos.y - transform.y) ** 2;
        if (distSq <= 1200) { // 약 35px 이내
            jobCtrl.jobState = 'MINING';
            jobCtrl.setData('mineTimer', 0);
            transform.vx = 0;
            transform.vy = 0;
        } else {
            const moveStatus = Pathfinder.followPath(transform, jobCtrl, tPos, 50, this.system.engine);
            if (moveStatus === -1) {
                // 🚫 [Pathing Safety] 도달 불가능한 광석 블랙리스트 추가 (60초간)
                const aiState = entity.components.get('AIState');
                if (aiState) aiState.addToBlacklist(jobCtrl.targetId, 60);
                
                jobCtrl.targetId = null;
                jobCtrl.jobState = 'SEARCHING';
                if (this.system.eventBus) this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId: entity.id, text: '❓', duration: 1500 });
            }
        }
    }

    mineMineral(entity, jobCtrl, dt) {
        const target = this.system.engine.entityManager.entities.get(jobCtrl.targetId);
        if (!target) {
            jobCtrl.jobState = 'SEARCHING';
            return;
        }

        let mineTimer = (jobCtrl.getData('mineTimer') || 0) + dt;
        jobCtrl.setData('mineTimer', mineTimer);

        const mineInterval = 1.2; // 채굴 속도 (나무보다 조금 느림)

        if (mineTimer >= mineInterval) {
            jobCtrl.setData('mineTimer', 0);

            // 🔨 [Task 82] 채굴 충격 시각화
            const visual = entity.components.get('Visual');
            if (visual) {
                visual.impactTime = performance.now();
                visual.impactType = 'gather';
            }
            
            const res = target.components.get('Resource');
            const civ = entity.components.get('Civilization');
            
            if (res) {
                const extracted = res.extract(3); // 한번에 3개씩 채굴
                if (extracted > 0) {
                    const tPos = target.components.get('Transform');
                    const itemFactory = this.system.engine.factoryProvider.getFactory('item');

                    if (itemFactory && tPos) {
                        const dropType = res.type || 'stone';
                        const vId = civ ? civ.villageId : -1;
                        itemFactory.spawnDrop(tPos.x, tPos.y, dropType, extracted, vId);
                    }
                    
                    // 스파크 파티클 효과
                    if (tPos) {
                        this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                            x: tPos.x, y: tPos.y - 10, count: 5, type: 'EFFECT', color: '#ffeb3b', speed: 3
                        });
                    }
                }

                if (res.value <= 0) {
                    this.system.engine.entityManager.removeEntity(jobCtrl.targetId);
                    jobCtrl.targetId = null;
                    jobCtrl.jobState = 'SEARCHING';
                }
            } else {
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
