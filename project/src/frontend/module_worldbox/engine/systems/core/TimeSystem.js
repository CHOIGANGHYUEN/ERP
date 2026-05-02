/**
 * ⏳ TimeSystem
 * 게임 내 세계 시간을 관리하고 00:00 ~ 23:59 형식을 유지합니다.
 */
export default class TimeSystem {
    constructor() {
        this.hours = 12; // 시작 시간 (정오)
        this.minutes = 0;
        this.seconds = 0;
        
        // 시간 흐름 속도 조정 (현실 1초당 게임 내 흐르는 분)
        // 0.166... => 1초(현실) = 10초(게임)
        this.timeScale = 0.16667; 
        
        this.isPaused = false;
        this.years = 1; // 🗓️ 시작 년도
        this.yearTimer = 0; // 나이 증가를 위한 타이머
    }

    /**
     * 매 프레임마다 시간을 업데이트하고 엔티티의 나이를 증가시킵니다.
     * @param {number} deltaTime - 프레임 간격 (ms)
     * @param {Object} engine - 엔진 인스턴스
     */
    update(deltaTime, engine) {
        if (this.isPaused) return;

        const minutesPerTick = (deltaTime / 1000) * this.timeScale * 60;
        this.minutes += minutesPerTick;
        this.yearTimer += minutesPerTick;

        // 🗓️ 10분(게임 시간)마다 1년이 흐름
        if (this.yearTimer >= 10) {
            this.years++;
            this.yearTimer = 0;
            this.incrementWorldAge(engine);
        }

        if (this.minutes >= 60) {
            const hAdd = Math.floor(this.minutes / 60);
            const oldHours = this.hours;
            this.hours = (this.hours + hAdd) % 24;
            this.minutes = this.minutes % 60;

            // 🌙 주야간 이벤트 브로드캐스트
            if (oldHours < 22 && this.hours >= 22) {
                engine.eventBus.emit('NIGHT_TIME', { hours: this.hours });
            } else if (oldHours < 6 && this.hours >= 6) {
                engine.eventBus.emit('DAY_TIME', { hours: this.hours });
            }
        }
    }

    /** 🌍 월드 전체 개체의 나이 증가 */
    incrementWorldAge(engine) {
        if (!engine || !engine.entityManager) return;
        const entities = engine.entityManager.getEntitiesByComponent('Age');
        for (const entity of entities) {
            const age = entity.components.get('Age');
            if (age) {
                age.currentAge += 1;
                age.updateStage();
            }
        }
    }

    /**
     * 00:00 ~ 23:59 형식의 문자열을 반환합니다.
     */
    getFormattedTime() {
        const h = Math.floor(this.hours).toString().padStart(2, '0');
        const m = Math.floor(this.minutes).toString().padStart(2, '0');
        return `${h}:${m}`;
    }

    /**
     * 특정 시간으로 설정
     */
    setTime(h, m) {
        this.hours = h % 24;
        this.minutes = m % 60;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
    }
}
