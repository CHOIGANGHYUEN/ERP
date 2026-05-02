import BaseRole from './BaseRole.js';
import { JobTypes } from '../../config/JobTypes.js';

/**
 * 👑 ChiefRole
 * 마을 촌장의 두뇌 역할.
 * 일정 주기마다 마을 상황을 분석하여 백수(UNEMPLOYED) 멤버에게 최적의 직업을 배정합니다.
 */
export default class ChiefRole extends BaseRole {
    constructor(system) {
        super(system);
        this._assignTimer = 0;
        this._assignInterval = 5.0; // 5초마다 직업 재배분
    }

    decide(entity, dt) {
        this._assignTimer -= dt;
        if (this._assignTimer > 0) return null;
        this._assignTimer = this._assignInterval;

        const civ = entity.components.get('Civilization');
        if (!civ || civ.villageId === -1) return null;

        // 마을 상황 분석
        const vs = this.engine.systemManager?.villageSystem;
        const village = vs.getVillage(civ.villageId);
        if (!village) return null;

        // 🏗️ [촌장의 특권] 최초의 건물 두 채(모닥불, 창고) 계획 수립
        if (village.plan.length === 0 && village.buildings.size === 0) {
            console.log(`👑 Chief ${entity.id} is planning the foundation of Village ${village.id}`);
            village.plan.push('bonfire', 'storage');
        }

        const needs = this._analyzeVillageNeeds(village, vs);

        // 백수 멤버들에게 직업 배정
        for (const memberId of village.members) {
            if (memberId === entity.id) continue; // 촌장 자신은 스킵
            const member = this.em.entities.get(memberId);
            if (!member) continue;

            const memberCiv = member.components.get('Civilization');
            if (!memberCiv || memberCiv.jobType !== JobTypes.UNEMPLOYED) continue;

            const assigned = this._assignJob(member, needs);
            if (assigned) {
                console.log(`👑 Chief assigned [${assigned}] to entity ${memberId}`);
            }
        }

        return null; // 촌장 자신의 AI 상태는 변경하지 않음
    }

    _analyzeVillageNeeds(village, vs) {
        const needs = {
            needsBuilder:  false,
            needsLogger:   false,
            needsGatherer: false,
            needsHunter:   false,
            needsWarrior:  false,
        };

        // 건설 과업이 있으면 건축가가 필요
        if (village.currentTask && village.currentTask.type === 'build') {
            needs.needsBuilder = true;
        }

        // 식량이 부족하면 사냥꾼/채집가 필요
        if ((village.resources?.food || 0) < 50) {
            needs.needsHunter = true;
            needs.needsGatherer = true;
        }

        // 목재가 부족하면 벌목꾼 필요
        if ((village.resources?.wood || 0) < 30) {
            needs.needsLogger = true;
        }

        return needs;
    }

    _assignJob(member, needs) {
        let job = null;

        if (needs.needsBuilder)  { job = JobTypes.ARCHITECT;  needs.needsBuilder  = false; }
        else if (needs.needsLogger)    { job = JobTypes.LOGGER;     needs.needsLogger   = false; }
        else if (needs.needsGatherer)  { job = JobTypes.GATHERER;   needs.needsGatherer = false; }
        else if (needs.needsHunter)    { job = JobTypes.HUNTER;     needs.needsHunter   = false; }
        else { job = JobTypes.LOGGER; } // 기본: 벌목꾼

        const memberCiv = member.components.get('Civilization');
        if (memberCiv) {
            memberCiv.jobType = job;
            // RoleFactory를 통해 Role 인스턴스 주입
            const roleFactory = this.engine.systemManager?.humanBehavior?.roleFactory;
            if (roleFactory) {
                memberCiv.role = roleFactory.createRole(job);
            }
        }
        return job;
    }
}
