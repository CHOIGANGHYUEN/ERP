import BaseRole from './BaseRole.js';
import { JobTypes } from '../../config/JobTypes.js';

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
        const village = vs.getVillage(civ.villageId);
        if (!village) return null;

        // 🏗️ 1. 마을 계획 관리 (모닥불, 창고 우선)
        if (village.plan.length === 0 && village.buildings.size === 0) {
            village.plan.push('bonfire', 'storage');
        }

        // 📊 2. 현재 마을 필요(Needs) 분석
        const needs = this._analyzeVillageNeeds(village, vs);

        // 💢 2.5 자원 부족 시 촌장의 독촉 이벤트 (약 10% 확률)
        if (Math.random() < 0.1) {
            let complaint = null;
            const currentFood = village.resources?.food || 0;
            const currentWood = village.resources?.wood || 0;

            if (needs.needFood && currentFood < 15) {
                complaint = '💢 🍖 식량이 부족하다!!';
            } else if (needs.canBuild && currentWood < 40) {
                complaint = '💢 🏗️ 건설할 나무를 캐와라!!';
            } else if (needs.needWood && currentWood < 15) {
                complaint = '💢 🪵 나무가 부족하다!!';
            }

            if (complaint && this.system.eventBus) {
                this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', {
                    entityId: entity.id,
                    text: complaint,
                    type: 'urgent', // 붉은색 등 강조 표시를 위한 타입
                    duration: 3000
                });
            }
        }

        // � 3. 현재 주민들의 직업 분포 파악
        const distribution = this._getJobDistribution(village);

        // ⚙️ 4. 지능적 직업 재배치
        for (const memberId of village.members) {
            if (memberId === entity.id) continue; // 촌장 본인은 제외

            const member = this.em.entities.get(memberId);
            if (!member) continue;
            const mCiv = member.components.get('Civilization');
            if (!mCiv) continue;

            // 재배치가 필요한 경우 체크
            const shouldReassign = this._checkReassignmentNeeded(mCiv, needs, distribution);

            if (shouldReassign) {
                const oldJob = mCiv.jobType;
                const newJob = this._assignJob(member, needs, distribution);
                if (newJob && oldJob !== newJob) {
                    // 직업이 변경되었으면 즉시 분포도(distribution)를 갱신하여 다음 주민 배정에 반영
                    if (distribution[oldJob] !== undefined) distribution[oldJob]--;
                    distribution[newJob] = (distribution[newJob] || 0) + 1;
                    console.log(`👑 Chief re-tasked entity ${memberId}: [${oldJob}] -> [${newJob}]`);
                }
            }
        }

        return null;
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
        // 1. 기본 요구량 외에 마을의 현재 상황(건설, 인구)을 반영한 동적 요구량 계산
        let dynamicWoodNeed = village.resourceNeeds?.wood || 10;
        let dynamicFoodNeed = village.resourceNeeds?.food || 15;

        // 🏗️ 촌장의 판단: 마을에 지어야 할 건물(Plan)이 있거나 짓는 중이라면 나무를 대폭 비축해야 함
        if (village.plan.length > 0 || (village.currentTask && village.currentTask.type === 'build')) {
            dynamicWoodNeed += 80; // 건설을 위해 나무 우선순위 펌핑
        }

        // 🍖 촌장의 판단: 인구수가 많을수록 식량 소모가 빠르므로 식량 안전선(버퍼 마진)을 높게 잡음
        const pop = village.members.size;
        dynamicFoodNeed += pop * 10;

        const needs = {
            canBuild: village.currentTask && village.currentTask.type === 'build',
            needFood: (village.resources?.food || 0) < dynamicFoodNeed,
            needWood: (village.resources?.wood || 0) < dynamicWoodNeed,
            isFoodFull: (village.resources?.food || 0) >= (village.resourceMax?.food || 100),
            isWoodFull: (village.resources?.wood || 0) >= (village.resourceMax?.wood || 100)
        };
        return needs;
    }

    _checkReassignmentNeeded(mCiv, needs, distribution) {
        const job = mCiv.jobType;

        // 1. 백수라면 무조건 배정
        if (job === JobTypes.UNEMPLOYED) return true;

        // 2. 건축가인데 건설할 게 없는 경우
        if (job === JobTypes.ARCHITECT && (!needs.canBuild || distribution[JobTypes.ARCHITECT] > 2)) return true;

        // 3. 자원이 이미 가득 찼는데 계속 채집/벌목하고 있는 경우
        if (job === JobTypes.LOGGER && needs.isWoodFull) return true;
        if ((job === JobTypes.GATHERER || job === JobTypes.HUNTER) && needs.isFoodFull) return true;

        // 4. 특정 분야에 인력이 너무 쏠려 있는데 다른 곳이 급한 경우 (인력 균형 조정)
        if (job === JobTypes.LOGGER && needs.needFood && distribution[JobTypes.LOGGER] > 1) return true;
        if (job === JobTypes.GATHERER && needs.needWood && distribution[JobTypes.GATHERER] > 1) return true;

        return false;
    }

    _assignJob(member, needs, distribution) {
        let job = JobTypes.LOGGER; // 기본값

        if (needs.canBuild && (distribution[JobTypes.ARCHITECT] || 0) < 2) {
            // 🏗️ 건설 목표가 있어도 최대 2명까지만 건축가로 배정
            job = JobTypes.ARCHITECT;
        } else if (needs.needFood && !needs.isFoodFull && needs.needWood && !needs.isWoodFull) {
            // ⚖️ 식량과 나무가 모두 부족할 경우, 인원이 적은 쪽으로 균형 배치
            const foodWorkers = (distribution[JobTypes.GATHERER] || 0) + (distribution[JobTypes.HUNTER] || 0);
            const woodWorkers = distribution[JobTypes.LOGGER] || 0;
            if (foodWorkers > woodWorkers) job = JobTypes.LOGGER;
            else job = Math.random() < 0.5 ? JobTypes.GATHERER : JobTypes.HUNTER;
        } else if (needs.needFood && !needs.isFoodFull) {
            job = Math.random() < 0.5 ? JobTypes.GATHERER : JobTypes.HUNTER;
        } else if (needs.needWood && !needs.isWoodFull) {
            job = JobTypes.LOGGER;
        } else {
            // 모든 자원이 넉넉하면 골고루 배분
            const rand = Math.random();
            if (rand < 0.4) job = JobTypes.LOGGER;
            else if (rand < 0.8) job = JobTypes.GATHERER;
            else job = JobTypes.HUNTER;
        }

        const mCiv = member.components.get('Civilization');
        if (mCiv) {
            mCiv.jobType = job;
            // 안정성 보강: 시스템을 통해서 바로 RoleFactory 접근 시도
            const roleFactory = this.system.roleFactory || this.engine.systemManager?.humanBehavior?.roleFactory;
            if (roleFactory) {
                mCiv.role = roleFactory.createRole(job);
            }
        }
        return job;
    }
}
