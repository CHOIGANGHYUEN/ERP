import { JobTypes as GlobalJobTypes } from '../../config/JobTypes.js';

// 🚀 [DOD Mapping] 문자열 JobType을 Buffer용 인덱스로 변환
const JobTypeToIndex = {
    [GlobalJobTypes.UNEMPLOYED]: 0,
    [GlobalJobTypes.CHIEF]: 1,
    [GlobalJobTypes.ARCHITECT]: 2,
    [GlobalJobTypes.LOGGER]: 3,
    [GlobalJobTypes.MINER]: 4,
    [GlobalJobTypes.FARMER]: 5,
    [GlobalJobTypes.GATHERER]: 6,
    [GlobalJobTypes.HUNTER]: 7,
    [GlobalJobTypes.WARRIOR]: 8,
    [GlobalJobTypes.MERCHANT]: 9,
    [GlobalJobTypes.BLACKSMITH]: 10,
    [GlobalJobTypes.CARPENTER]: 11
};

export const JobStates = {
    'IDLE': 0, 'SEARCHING': 1, 'MOVING': 2, 'WORKING': 3, 
    'MINING': 4, 'FARMING': 5, 'FIGHTING': 6, 'PATROLLING': 7
};

export default class JobController {
    constructor() {
        this._currentJob = GlobalJobTypes.UNEMPLOYED;
        this.zoneId = null;
        this._jobState = 'IDLE';
        this.data = {}; // 📦 직업별 고유 데이터 저장 (타이머, 타겟 보존 등)
        this.equipment = null; // 직업 관련 도구 참조 등
        this.lastJobSwitchTime = Date.now(); // ⏱️ 마지막 직업 변경 시간

        this._buffer = null;
        this._index = -1;
    }

    /** 🚀 [Expert Optimization] 버퍼 연결 */
    linkBuffer(buffer, index) {
        const isFirstLink = (this._buffer === null);
        this._buffer = buffer;
        this._index = index;
        
        if (isFirstLink && this._buffer) {
            this._buffer[this._index] = JobTypeToIndex[this._currentJob] ?? 0;
            this._buffer[this._index + 1] = JobStates[this._jobState] || 0;
        }
    }

    get currentJob() { return this._currentJob; }
    set currentJob(v) {
        this._currentJob = v;
        if (this._buffer) {
            this._buffer[this._index] = JobTypeToIndex[v] ?? 0;
        }
    }

    get jobState() { return this._jobState; }
    set jobState(v) {
        this._jobState = v;
        if (this._buffer) {
            this._buffer[this._index + 1] = JobStates[v] || 0;
        }
    }

    assignJob(jobType, zoneId = null) {
        if (this.currentJob === jobType) return;

        // 직업 변경 시 상태 초기화
        this.interrupt();

        this.currentJob = jobType;
        this.zoneId = zoneId;
        this.jobState = 'IDLE'; // Job 내부 세부 상태
        this.data = {}; // 초기화
        this.lastJobSwitchTime = Date.now();
    }

    interrupt() {
        this.equipment = null;
        this.jobState = 'IDLE';
        this.data = {}; // 진행 중이던 직업 내부 데이터 증발
    }

    setData(key, value) {
        this.data[key] = value;
    }

    getData(key) {
        return this.data[key];
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
