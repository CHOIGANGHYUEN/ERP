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
    }

    /**
     * 매 프레임마다 시간을 업데이트합니다.
     * @param {number} deltaTime - 프레임 간격 (ms)
     */
    update(deltaTime) {
        if (this.isPaused) return;

        // deltaTime(ms)을 기준으로 게임 내 시간 계산
        // 기본값: 1초(1000ms)당 게임 시간 1분 흐름
        const minutesPerTick = (deltaTime / 1000) * this.timeScale * 60;
        
        this.minutes += minutesPerTick;

        if (this.minutes >= 60) {
            const hAdd = Math.floor(this.minutes / 60);
            this.hours = (this.hours + hAdd) % 24;
            this.minutes = this.minutes % 60;
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
