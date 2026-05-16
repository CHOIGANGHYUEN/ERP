/**
 * 💾 JobTaskContext
 * 직업 활동 중 발생하는 임시 데이터(진행도, 타겟, 타이머 등)를 캡슐화합니다.
 * 생존 욕구(허기 등)로 인한 작업 중단 시 이 컨텍스트를 스택에 보존하여 나중에 복구할 수 있게 합니다.
 */
export default class JobTaskContext {
    constructor(jobType = null) {
        this.jobType = jobType;
        this.targetId = null;
        this.progress = 0;
        this.timer = 0;
        this.count = 0;
        this.customData = {};
        this.saveTime = Date.now();
    }

    /** 📥 현재 진행 중인 작업 데이터를 저장합니다. */
    save(targetId, data = {}) {
        this.targetId = targetId;
        this.customData = { ...data };
        this.saveTime = Date.now();
        return this;
    }

    /** 📤 보존된 데이터를 불러옵니다. */
    load() {
        return {
            targetId: this.targetId,
            data: this.customData
        };
    }

    /** 🧹 데이터를 초기화합니다. */
    clear() {
        this.targetId = null;
        this.progress = 0;
        this.timer = 0;
        this.count = 0;
        this.customData = {};
    }

    /** ⏱️ 컨텍스트가 너무 오래되었는지 확인 (유효 기간: 5분) */
    isStale(timeoutMs = 300000) {
        return (Date.now() - this.saveTime) > timeoutMs;
    }
}
