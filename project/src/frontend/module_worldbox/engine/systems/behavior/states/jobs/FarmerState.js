import BaseJobState from './BaseJobState.js';
import Pathfinder from '../../../../utils/Pathfinder.js';

/**
 * 👨‍🌾 FarmerState
 * 농부의 업무 사이클(파종 -> 관리 -> 수확)을 관리하는 상태 클래스입니다.
 */
export default class FarmerState extends BaseJobState {
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
                this.findFarmWork(entity, jobCtrl);
                break;
            case 'MOVING':
                this.moveToFarm(entity, jobCtrl, transform);
                break;
            case 'SOWING':
                this.workOnFarm(entity, jobCtrl, dt, 'sow', 2.0); // 2초간 파종
                break;
            case 'TENDING':
                this.tendFarm(entity, jobCtrl, dt);
                break;
            case 'HARVESTING':
                this.workOnFarm(entity, jobCtrl, dt, 'harvest', 3.0); // 3초간 수확
                break;
        }

        return null;
    }

    findFarmWork(entity, jobCtrl) {
        const em = this.system.engine.entityManager;
        const civ = entity.components.get('Civilization');
        if (!civ) return;

        // 구역 내의 농장 탐색
        let bestTarget = null;
        let priority = -1;

        // 🚀 [Expert Optimization] buildingIds 인덱스 활용하여 농장 검색
        for (const id of em.buildingIds) {
            const farmEnt = em.entities.get(id);
            if (!farmEnt) continue;

            const farm = farmEnt.components.get('Farm');
            const buildCiv = farmEnt.components.get('Civilization');
            if (!farm || (buildCiv && buildCiv.villageId !== civ.villageId)) continue;

            // 우선순위 결정
            // 1순위: 수확 가능 (isHarvestable)
            // 2순위: 씨앗 필요 (!isSeeded)
            // 3순위: 관리 중 (Tending - 성장 촉진)
            
            if (farm.isHarvestable) {
                bestTarget = id;
                priority = 3;
                break; // 수확이 최우선
            } else if (!farm.isSeeded && priority < 2) {
                bestTarget = id;
                priority = 2;
            } else if (farm.isSeeded && !farm.isTending && priority < 1) {
                bestTarget = id;
                priority = 1;
            }
        }

        if (bestTarget !== null) {
            jobCtrl.targetId = bestTarget;
            jobCtrl.jobState = 'MOVING';
        } else {
            // 할일 없으면 배회
            const speed = 30;
            const wanderPos = {
                x: transform.x + (Math.random() - 0.5) * 100,
                y: transform.y + (Math.random() - 0.5) * 100
            };
            Pathfinder.followPath(transform, jobCtrl, wanderPos, speed, this.system.engine);
        }
    }

    moveToFarm(entity, jobCtrl, transform) {
        const target = this.system.engine.entityManager.entities.get(jobCtrl.targetId);
        if (!target) {
            jobCtrl.jobState = 'SEARCHING';
            return;
        }

        const tPos = target.components.get('Transform');
        const farm = target.components.get('Farm');
        if (!tPos || !farm) {
            jobCtrl.jobState = 'SEARCHING';
            return;
        }

        const distSq = (tPos.x - transform.x) ** 2 + (tPos.y - transform.y) ** 2;
        if (distSq <= 1600) { // 40px 이내 도달
            transform.vx = 0;
            transform.vy = 0;
            
            if (farm.isHarvestable) {
                jobCtrl.jobState = 'HARVESTING';
            } else if (!farm.isSeeded) {
                jobCtrl.jobState = 'SOWING';
            } else {
                jobCtrl.jobState = 'TENDING';
            }
            jobCtrl.setData('workTimer', 0);
        } else {
            Pathfinder.followPath(transform, jobCtrl, tPos, 50, this.system.engine);
        }
    }

    workOnFarm(entity, jobCtrl, dt, type, duration) {
        const target = this.system.engine.entityManager.entities.get(jobCtrl.targetId);
        const farm = target?.components.get('Farm');
        if (!farm) {
            jobCtrl.jobState = 'SEARCHING';
            return;
        }

        let timer = jobCtrl.getData('workTimer') || 0;
        timer += dt;
        jobCtrl.setData('workTimer', timer);

        // 파티클 효과
        if (Math.random() < 0.1) {
            const tPos = target.components.get('Transform');
            this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                x: tPos.x + (Math.random() - 0.5) * 20,
                y: tPos.y + (Math.random() - 0.5) * 20,
                count: 2, type: 'EFFECT', color: type === 'sow' ? '#4caf50' : '#ffd54f', speed: 1
            });
        }

        if (timer >= duration) {
            if (type === 'sow') {
                farm.isSeeded = true;
                farm.growth = 0;
            } else if (type === 'harvest') {
                this.completeHarvest(entity, target, farm);
            }
            jobCtrl.jobState = 'SEARCHING';
            jobCtrl.targetId = null;
        }
    }

    tendFarm(entity, jobCtrl, dt) {
        const target = this.system.engine.entityManager.entities.get(jobCtrl.targetId);
        const farm = target?.components.get('Farm');
        if (!farm || farm.isHarvestable || !farm.isSeeded) {
            if (farm) farm.isTending = false;
            jobCtrl.jobState = 'SEARCHING';
            return;
        }

        farm.isTending = true;
        
        // 가끔 잡초 뽑기 연출 (이동)
        let tendTimer = (jobCtrl.getData('tendTimer') || 0) + dt;
        jobCtrl.setData('tendTimer', tendTimer);

        if (tendTimer > 3.0) {
            jobCtrl.setData('tendTimer', 0);
            const tPos = target.components.get('Transform');
            const offset = {
                x: tPos.x + (Math.random() - 0.5) * 30,
                y: tPos.y + (Math.random() - 0.5) * 30
            };
            const transform = entity.components.get('Transform');
            Pathfinder.followPath(transform, jobCtrl, offset, 20, this.system.engine);
        }
    }

    completeHarvest(entity, farmEnt, farm) {
        const storage = farmEnt.components.get('Storage');
        const harvested = farm.currentCrops;
        const cropType = farm.cropType || 'wheat';

        if (storage) {
            storage.addItem(cropType, harvested);
        } else {
            // 창고 없으면 바닥에 드랍
            const tPos = farmEnt.components.get('Transform');
            const itemFactory = this.system.engine.factoryProvider.getFactory('item');
            const civ = entity.components.get('Civilization');
            if (itemFactory && tPos) {
                itemFactory.spawnDrop(tPos.x, tPos.y, cropType, harvested, civ?.villageId || -1);
            }
        }

        farm.currentCrops = 0;
        farm.growth = 0;
        farm.isSeeded = false;
        farm.isHarvestable = false;
        farm.isTending = false;

        this.system.eventBus.emit('FARM_HARVESTED', { id: farmEnt.id, amount: harvested });
    }

    exit(entityId, entity) {
        const jobCtrl = entity.components.get('JobController');
        if (jobCtrl) {
            // Tending 상태 해제 보장
            if (jobCtrl.targetId) {
                const farm = this.system.engine.entityManager.entities.get(jobCtrl.targetId)?.components.get('Farm');
                if (farm) farm.isTending = false;
            }
            jobCtrl.interrupt();
        }
    }
}
