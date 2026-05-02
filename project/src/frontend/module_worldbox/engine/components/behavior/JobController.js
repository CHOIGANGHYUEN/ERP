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

    clearJob() {
        this.currentJob = null;
        this.zoneId = null;
        this.interrupt();
    }
}
