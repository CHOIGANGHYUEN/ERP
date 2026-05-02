export default class JobController {
    constructor() {
        this.currentJob = null;
        this.zoneId = null;
        this.jobState = null;
        this.equipment = null; // 직업 관련 도구 참조 등
    }

    assignJob(jobType, zoneId = null) {
        if (this.currentJob === jobType) return;

        // 직업 변경 시 상태 초기화
        this.interrupt();

        this.currentJob = jobType;
        this.zoneId = zoneId;
        this.jobState = 'IDLE'; // Job 내부 세부 상태
    }

    interrupt() {
        this.equipment = null;
        this.jobState = 'IDLE';
    }

    /**
     * 🆘 생존 욕구(허기, 피로 등) 발생 시 현재 작업을 중단하고 생존 상태를 주입합니다.
     */
    requestSurvivalInterrupt(entity, needMode) {
        const aiState = entity.components.get('AIState');
        if (aiState && aiState.mode !== needMode) {
            // 현재 작업의 세부 상태는 IDLE로 돌려놓고 (나중에 돌아올 때를 대비)
            this.jobState = 'IDLE';
            // AI 본체에 생존 상태 강제 주입 (이전 상태는 스택에 저장됨)
            aiState.pushMode(needMode);
        }
    }

    clearJob() {
        this.currentJob = null;
        this.zoneId = null;
        this.interrupt();
    }
}
