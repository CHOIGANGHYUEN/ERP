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
        
        // 👥 3. 현재 주민들의 직업 분포 파악
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
                const newJob = this._assignJob(member, needs);
                if (newJob && oldJob !== newJob) {
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
        const needs = {
            canBuild:  village.currentTask && village.currentTask.type === 'build',
            needFood:  (village.resources?.food || 0) < (village.resourceNeeds?.food || 15),
            needWood:  (village.resources?.wood || 0) < (village.resourceNeeds?.wood || 10),
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
        if (job === JobTypes.ARCHITECT && !needs.canBuild) return true;

        // 3. 자원이 이미 가득 찼는데 계속 채집/벌목하고 있는 경우
        if (job === JobTypes.LOGGER && needs.isWoodFull) return true;
        if ((job === JobTypes.GATHERER || job === JobTypes.HUNTER) && needs.isFoodFull) return true;

        // 4. 특정 분야에 인력이 너무 쏠려 있는데 다른 곳이 급한 경우 (인력 균형 조정)
        if (job === JobTypes.LOGGER && needs.needFood && distribution[JobTypes.LOGGER] > 1) return true;
        if (job === JobTypes.GATHERER && needs.needWood && distribution[JobTypes.GATHERER] > 1) return true;

        return false;
    }

    _assignJob(member, needs) {
        let job = JobTypes.LOGGER; // 기본값

        if (needs.canBuild) {
            job = JobTypes.ARCHITECT;
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
            const roleFactory = this.engine.systemManager?.humanBehavior?.roleFactory;
            if (roleFactory) {
                mCiv.role = roleFactory.createRole(job);
            }
        }
        return job;
    }
}
