import { JobTypes as GlobalJobTypes } from '../../config/JobTypes.js';
import JobTaskContext from '../../systems/behavior/jobs/JobTaskContext.js';

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

import { JobExecutionStates, JobStateToIndex } from '../../systems/behavior/jobs/JobStateDefinitions.js';

export const JobStates = JobStateToIndex;

export default class JobController {
    constructor() {
        this._currentJob = GlobalJobTypes.UNEMPLOYED;
        this.zoneId = null;
        this._jobState = 'IDLE';
        
        // 💾 [Context Persistence] 진행 중인 작업 정보 보존용
        this.context = new JobTaskContext();
        this._contextStack = []; // 나중에 복잡한 인터럽트 구조를 위해 스택 준비
        
        this.lastJobSwitchTime = Date.now(); 

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

        // 직업 완전 변경 시 기존 컨텍스트 폐기
        this.context.clear();
        this._contextStack = [];

        this.currentJob = jobType;
        this.zoneId = zoneId;
        this.jobState = 'IDLE';
        this.lastJobSwitchTime = Date.now();
        this.context.jobType = jobType;
    }

    /** ⏸️ 생존을 위해 작업을 일시 중단 (데이터 보존) */
    pauseJob(targetId, currentData = {}) {
        this.context.save(targetId, currentData);
        this.jobState = 'INTERRUPTED';
    }

    /** ▶️ 중단되었던 작업으로 복귀 */
    resumeJob() {
        if (this.jobState === 'INTERRUPTED') {
            this.jobState = 'IDLE'; // 다시 업무 모드로 전환
            return this.context.load();
        }
        return null;
    }

    interrupt() {
        // 기존의 파괴적인 interrupt 대신 안전한 초기화로 변경
        this.jobState = 'IDLE';
        // 직업이 바뀌지 않는 한 context는 유지하여 재도전 가능하게 함
    }

    /**
     * 🆘 생존 욕구 발생 시 현재 작업을 안전하게 일시 정지하고 상태 주입
     */
    requestSurvivalInterrupt(entity, needMode) {
        const aiState = entity.components.get('AIState');
        if (aiState && aiState.mode !== needMode) {
            // 현재 타겟과 데이터를 저장하고 INTERRUPTED 상태로 전환
            this.pauseJob(aiState.targetId, {
                lastPath: aiState.path,
                pathIndex: aiState.pathIndex
            });
            
            // AI 본체에 생존 상태 강제 주입
            aiState.pushMode(needMode);
        }
    }

    clearJob() {
        this.currentJob = GlobalJobTypes.UNEMPLOYED;
        this.zoneId = null;
        this.context.clear();
        this._contextStack = [];
        this.jobState = 'IDLE';
    }

    /** 🏷️ 직업별 임시 데이터 접근 (타이머, 스택 등) */
    getData(key) {
        return this.context.customData[key];
    }

    setData(key, value) {
        this.context.customData[key] = value;
    }
}
