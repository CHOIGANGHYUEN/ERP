/**
 * 📜 Global Logger System
 * 시스템 전반의 이벤트를 기록하고 UI와 연동합니다.
 */
class Logger {
    constructor() {
        this.logs = [];
        this.maxLogs = 300;
        this.onUpdate = null; // UI 업데이트 콜백
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('ko-KR', { hour12: false });
        const logEntry = {
            id: Date.now() + Math.random(),
            timestamp,
            message,
            type
        };

        // LIFO: 새 로그를 맨 앞에 추가
        this.logs.unshift(logEntry);

        // 300줄 제한 및 메모리 해제
        if (this.logs.length > this.maxLogs) {
            this.logs.pop(); // 가장 오래된 로그 제거
        }

        if (this.onUpdate) {
            this.onUpdate(this.logs);
        } else {
            console.warn('[Logger] onUpdate callback is missing!');
        }
    }

    info(msg) { this.log(msg, 'info'); }
    warn(msg) { this.log(msg, 'warn'); }
    error(msg) { this.log(msg, 'error'); }
    success(msg) { this.log(msg, 'success'); }

    clear() {
        this.logs = [];
        if (this.onUpdate) this.onUpdate(this.logs);
    }
}

// 🌐 [Singleton Fix] 전역 객체에 바인딩하여 인스턴스 파편화 방지
if (!window.GlobalLogger) {
    window.GlobalLogger = new Logger();
}
export const GlobalLogger = window.GlobalLogger;
