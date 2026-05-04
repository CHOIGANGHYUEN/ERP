import BaseRole from './BaseRole.js';
import { JobTypes } from '../../config/JobTypes.js';
import { GlobalLogger } from '../../utils/Logger.js';

/**
 * 👑 ChiefRole
 * 마을 촌장의 두뇌 역할.
 * 마을의 자원 상황과 건설 계획을 실시간으로 분석하여 주민들의 직업을 지능적으로 재배치합니다.
 */
export default class ChiefRole extends BaseRole {
    constructor(system) {
        super(system);
        this._assignTimer = 0;
        this._assignInterval = 1.0; // 1초마다 상황 체크 및 직업 조정
    }

    decide(entity, dt) {
        this._assignTimer -= dt;
        if (this._assignTimer > 0) return null;
        this._assignTimer = this._assignInterval;

        const civ = entity.components.get('Civilization');
        if (!civ || civ.villageId === -1) return null;

        const vs = this.engine.systemManager?.villageSystem;
        const village = vs?.getVillage(civ.villageId);
        if (!village) return null;

        // 🏗️ 1. 마을 계획 관리 (모닥불, 창고 우선 및 인구 기반 주택 확장)
        if (village.plan.length === 0) {
            if (village.buildings.size === 0) {
                village.plan.push('bonfire', 'storage');
            } else {
                // 🏠 주거 용량 체크 및 확장 계획
                const currentPop = village.members.size;
                let totalCapacity = 0;
                for (const bId of village.buildings) {
                    const b = this.em.entities.get(bId);
                    const housing = b?.components.get('Housing');
                    if (housing) totalCapacity += housing.capacity;
                }

                // 여유 공간이 1명 이하이거나 꽉 찼을 때 새 집 계획
                if (currentPop >= totalCapacity - 1 && village.plan.filter(p => p === 'house').length === 0) {
                    village.plan.push('house');
                    GlobalLogger.info(`🏘️ [Chief] Village ${civ.villageId} needs more housing! Planning a new house.`);
                }
            }
        }

        // 📋 2. 마을 할일 목록(TODO List) 갱신
        this._updateVillageTaskBoard(village);

        // 📊 3. 현재 마을 필요(Needs) 분석
        const needs = this._analyzeVillageNeeds(village, vs);

        // ⚙️ 4. 지능적 직업 재배치
        const distribution = this._getJobDistribution(village);

        for (const memberId of village.members) {
            if (memberId === entity.id) continue;

            const member = this.em.entities.get(memberId);
            if (!member) continue;
            const mCiv = member.components.get('Civilization');
            if (!mCiv) continue;

            const shouldReassign = this._checkReassignmentNeeded(mCiv, needs, distribution);

            if (shouldReassign) {
                const oldJob = mCiv.jobType;
                const newJob = this._assignJob(member, needs, distribution, village);
                if (newJob && oldJob !== newJob) {
                    if (distribution[oldJob] !== undefined) distribution[oldJob]--;
                    distribution[newJob] = (distribution[newJob] || 0) + 1;
                    GlobalLogger.info(`👑 Chief re-tasked entity ${memberId}: [${oldJob}] -> [${newJob}]`);
                }
            }
        }

        return null;
    }

    /** 📋 마을 할일 목록(TaskBoard)을 현재 상황에 맞춰 갱신합니다. */
    _updateVillageTaskBoard(village) {
        if (!village.taskBoard) village.taskBoard = [];

        // 1. 완료된 작업 제거 및 유령 작업(죽은 주민이 점유한 작업) 해제
        village.taskBoard = village.taskBoard.filter(t => t.status !== 'DONE');
        
        for (const task of village.taskBoard) {
            if (task.status === 'CLAIMED' && task.claimedBy) {
                if (!this.em.entities.has(task.claimedBy)) {
                    GlobalLogger.info(`♻️ [Chief] Reclaiming task from deceased entity ${task.claimedBy}`);
                    task.status = 'AVAILABLE';
                    task.claimedBy = null;
                }
            }
        }

        // 2. 건설 과업 추가 (청사진 탐색)
        for (const bId of village.buildings) {
            const b = this.em.entities.get(bId);
            const struc = b?.components.get('Structure');
            if (struc && !struc.isComplete) {
                const existing = village.taskBoard.find(t => t.type === 'build' && t.targetId === bId);
                if (!existing) {
                    village.taskBoard.push({
                        id: `build_${bId}`,
                        type: 'build',
                        targetId: bId,
                        priority: struc.type === 'bonfire' || struc.type === 'storage' ? 100 : 50,
                        status: 'AVAILABLE',
                        claimedBy: null
                    });
                }
            }
        }

        // 3. 자원 수급 과업 추가 (임계치 이하일 때)
        const woodNeed = (village.resourceNeeds?.wood || 20) + 50;
        if (village.resources.wood < woodNeed) {
            // 🪵 마을 주변의 나무 아이템만 확인 (공간 해시 활용)
            let droppedWoodCount = 0;
            const nearbyIds = this.engine.spatialHash.query(village.centerX, village.centerY, 600);
            for (const resId of nearbyIds) {
                const ent = this.em.entities.get(resId);
                const item = ent?.components.get('DroppedItem');
                if (item && item.itemType === 'wood') droppedWoodCount += (item.amount || 1);
            }

            const existingGather = village.taskBoard.filter(t => t.type === 'gather_wood').length;
            const existingPickup = village.taskBoard.filter(t => t.type === 'pickup_wood').length;
            
            // A. 바닥에 나무가 많으면 '줍기' 과업 우선 생성
            if (droppedWoodCount >= 5 && existingPickup < 2) {
                village.taskBoard.push({
                    id: `pickup_wood_${Date.now()}`,
                    type: 'pickup_wood',
                    priority: 70,
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }
            
            // B. 바닥에 나무가 적을 때만 '벌목' 과업 생성
            if (droppedWoodCount < 10 && existingGather < 3) { 
                village.taskBoard.push({
                    id: `gather_wood_${Date.now()}_${Math.random()}`,
                    type: 'gather_wood',
                    priority: village.resources.wood < 10 ? 80 : 40,
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }
        }

        const foodNeed = (village.resourceNeeds?.food || 20) + 30;
        if (village.resources.food < foodNeed) {
            // 🍎 마을 주변의 식량 아이템만 확인 (공간 해시 활용)
            let droppedFoodCount = 0;
            const nearbyIds = this.engine.spatialHash.query(village.centerX, village.centerY, 600);
            const edibleTypes = ['food', 'fruit', 'meat', 'berry'];
            for (const resId of nearbyIds) {
                const ent = this.em.entities.get(resId);
                const item = ent?.components.get('DroppedItem');
                if (item && edibleTypes.includes(item.itemType)) {
                    droppedFoodCount += (item.amount || 1);
                }
            }

            const existingGather = village.taskBoard.filter(t => t.type === 'gather_food' || t.type === 'hunt').length;
            const existingPickup = village.taskBoard.filter(t => t.type === 'pickup_food').length;

            // A. 바닥에 식량이 많으면 '줍기' 과업 우선 생성
            if (droppedFoodCount >= 5 && existingPickup < 2) {
                village.taskBoard.push({
                    id: `pickup_food_${Date.now()}`,
                    type: 'pickup_food',
                    priority: 75,
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }

            // B. 바닥에 식량이 적을 때만 '채집/사냥' 과업 생성
            if (droppedFoodCount < 10 && existingGather < 4) {
                const type = Math.random() < 0.7 ? 'gather_food' : 'hunt';
                village.taskBoard.push({
                    id: `${type}_${Date.now()}`,
                    type: type,
                    priority: village.resources.food < 10 ? 90 : 45,
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }
        }
    }

    _getJobDistribution(village) {
        const dist = {};
        for (const type of Object.values(JobTypes)) dist[type] = 0;

        for (const memberId of village.members) {
            const member = this.em.entities.get(memberId);
            const civ = member?.components.get('Civilization');
            if (civ) dist[civ.jobType]++;
        }
        return dist;
    }

    _analyzeVillageNeeds(village, vs) {
        let dynamicWoodNeed = village.resourceNeeds?.wood || 10;
        let dynamicFoodNeed = village.resourceNeeds?.food || 15;

        const blackboard = this.system.engine?.systemManager?.blackboard;
        const hasAnyBlueprint = blackboard && blackboard.blueprints && blackboard.blueprints.length > 0;

        if (village.plan.length > 0 || (village.currentTask && village.currentTask.type === 'build') || hasAnyBlueprint) {
            dynamicWoodNeed += 80;
        }

        const pop = village.members.size;
        dynamicFoodNeed += pop * 10;

        const needs = {
            canBuild: (village.currentTask && village.currentTask.type === 'build') || hasAnyBlueprint,
            needFood: (village.resources?.food || 0) < dynamicFoodNeed,
            needWood: (village.resources?.wood || 0) < dynamicWoodNeed,
            isFoodFull: (village.resources?.food || 0) >= (village.resourceMax?.food || 100),
            isWoodFull: (village.resources?.wood || 0) >= (village.resourceMax?.wood || 100)
        };
        return needs;
    }

    _checkReassignmentNeeded(mCiv, needs, distribution) {
        const job = mCiv.jobType;
        if (job === JobTypes.UNEMPLOYED) return true;
        if (job === JobTypes.ARCHITECT && (!needs.canBuild || distribution[JobTypes.ARCHITECT] > 2)) return true;
        if (job === JobTypes.LOGGER && needs.isWoodFull) return true;
        if ((job === JobTypes.GATHERER || job === JobTypes.HUNTER) && needs.isFoodFull) return true;
        if (job === JobTypes.LOGGER && needs.needFood && distribution[JobTypes.LOGGER] > 1) return true;
        if (job === JobTypes.GATHERER && needs.needWood && distribution[JobTypes.GATHERER] > 1) return true;
        return false;
    }

    _assignJob(member, needs, distribution, village) {
        let job = JobTypes.LOGGER;
        const board = village.taskBoard || [];
        const hasBuildTask = board.some(t => t.type === 'build' && t.status === 'AVAILABLE');
        const hasWoodTask = board.some(t => t.type === 'gather_wood' && t.status === 'AVAILABLE');
        const hasFoodTask = board.some(t => (t.type === 'gather_food' || t.type === 'hunt') && t.status === 'AVAILABLE');

        if (hasBuildTask && (distribution[JobTypes.ARCHITECT] || 0) < 2) {
            job = JobTypes.ARCHITECT;
        } else if (hasFoodTask && (distribution[JobTypes.GATHERER] || 0) < 3) {
            job = Math.random() < 0.7 ? JobTypes.GATHERER : JobTypes.HUNTER;
        } else if (hasWoodTask) {
            job = JobTypes.LOGGER;
        } else if (needs.needFood && !needs.isFoodFull && needs.needWood && !needs.isWoodFull) {
            const foodWorkers = (distribution[JobTypes.GATHERER] || 0) + (distribution[JobTypes.HUNTER] || 0);
            const woodWorkers = distribution[JobTypes.LOGGER] || 0;
            if (foodWorkers > woodWorkers) job = JobTypes.LOGGER;
            else job = Math.random() < 0.5 ? JobTypes.GATHERER : JobTypes.HUNTER;
        } else if (needs.needFood && !needs.isFoodFull) {
            job = Math.random() < 0.5 ? JobTypes.GATHERER : JobTypes.HUNTER;
        } else if (needs.needWood && !needs.isWoodFull) {
            job = JobTypes.LOGGER;
        } else {
            const rand = Math.random();
            if (rand < 0.4) job = JobTypes.LOGGER;
            else if (rand < 0.8) job = JobTypes.GATHERER;
            else job = JobTypes.HUNTER;
        }

        const mCiv = member.components.get('Civilization');
        if (mCiv) {
            mCiv.jobType = job;
            const roleFactory = this.system.roleFactory || this.engine.systemManager?.humanBehavior?.roleFactory;
            if (roleFactory) {
                mCiv.role = roleFactory.createRole(job);
            }
        }
        return job;
    }
}
