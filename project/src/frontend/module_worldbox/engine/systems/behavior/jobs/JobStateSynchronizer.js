import { JobTypes } from '../../../config/JobTypes.js';
import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * 🔄 JobStateSynchronizer
 * 주민의 직업 상태(jobType, role, JobController)를 원자적으로 동기화합니다. (Facade Pattern)
 * 파편화된 직업 데이터로 인한 유령 주민 버그를 원천 차단합니다.
 */
export default class JobStateSynchronizer {
    constructor(entityManager, roleFactory) {
        this.em = entityManager;
        this.roleFactory = roleFactory;
    }

    /**
     * 🚀 [Atomic Sync] 엔티티의 모든 직업 관련 상태를 한 번에 변경합니다.
     */
    syncJob(entityId, newJobType, villageId = null) {
        const entity = this.em.entities.get(entityId);
        if (!entity) return false;

        const civ = entity.components.get('Civilization');
        const jobCtrl = entity.components.get('JobController');

        if (!civ) {
            GlobalLogger.error(`❌ [Synchronizer] Entity ${entityId} has no Civilization component.`);
            return false;
        }

        const oldJob = civ.jobType;
        if (oldJob === newJobType) return true;

        // 1. Civilization 컴포넌트 업데이트
        civ.jobType = newJobType;
        if (villageId !== null) civ.villageId = villageId;

        // 2. Role 인스턴스 교체 (RoleFactory 위임)
        if (this.roleFactory) {
            civ.role = this.roleFactory.createRole(newJobType);
        }

        // 3. JobController 업데이트
        if (jobCtrl) {
            jobCtrl.assignJob(newJobType, null); // zoneId는 나중에 AI가 결정하도록 null 처리
        }

        GlobalLogger.info(`🔄 [JobSync] Entity ${entityId}: ${oldJob} -> ${newJobType}`);
        return true;
    }

    /** 🧹 모든 직업 해제 (백수 전환) */
    clearJob(entityId) {
        return this.syncJob(entityId, JobTypes.UNEMPLOYED);
    }
}
