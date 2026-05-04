import { GlobalLogger } from '../../utils/Logger.js';

/**
 * 🔧 BaseRole
 * 모든 직업 Role 클래스의 기반 추상 클래스.
 * 각 Role은 자신의 판단 로직(decide)을 통해 엔티티의 AIState를 갱신합니다.
 */
export default class BaseRole {
    /**
     * @param {object} system - HumanBehaviorSystem 참조 (engine, em 접근용)
     */
    constructor(system) {
        this.system = system;
        this.engine = system.engine;
        this.em     = system.entityManager;
    }

    /**
     * 매 틱 호출. 엔티티의 현재 상태를 보고 AIState를 갱신합니다.
     * @param {object} entity - 판단 대상 엔티티
     * @param {number} dt
     * @returns {string|null} 다음 state 이름, 또는 null (현재 상태 유지)
     */
    /** 📋 마을 할일 목록에서 내 직업에 맞는 가장 우선순위 높은 작업을 수주합니다. */
    claimTask(entity, village, taskType) {
        if (!village || !village.taskBoard) return null;

        // 1. 이미 내가 수주한 작업이 있는지 확인
        const myTask = village.taskBoard.find(t => t.claimedBy === entity.id && t.type === taskType);
        if (myTask) return myTask;

        // 2. 새로운 작업 수주 (우선순위 순)
        const availableTasks = village.taskBoard
            .filter(t => t.type === taskType && t.status === 'AVAILABLE')
            .sort((a, b) => b.priority - a.priority);

        if (availableTasks.length > 0) {
            const task = availableTasks[0];
            task.status = 'CLAIMED';
            task.claimedBy = entity.id;
            const civ = entity.components.get('Civilization');
            const jobName = civ?.jobType ? civ.jobType.toUpperCase() : 'CITIZEN';
            GlobalLogger.info(`📝 JOB: [${jobName}] Entity ${entity.id} has claimed task [${task.type.toUpperCase()}]`);
            return task;
        }

        return null;
    }

    /** 📋 완료하거나 중단한 작업을 반납/해제합니다. */
    releaseTask(entity, village, taskId, isDone = false) {
        if (!village || !village.taskBoard) return;
        const task = village.taskBoard.find(t => t.id === taskId);
        if (task && task.claimedBy === entity.id) {
            if (isDone) {
                task.status = 'DONE';
            } else {
                task.status = 'AVAILABLE';
                task.claimedBy = null;
            }
        }
    }
}
