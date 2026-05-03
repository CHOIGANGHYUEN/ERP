/**
 * 📡 Global Event Bus (Pub/Sub Pattern)
 * 
 * ECS 원칙 절대 준수:
 * 시스템(System) 간, 혹은 시스템과 UI 프레임워크(Vue) 간의 
 * 직접적인 참조(강한 결합)를 끊고 이벤트를 통해서만 통신하도록 돕는 중앙 메세지 큐입니다.
 */
export default class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    // 이벤트 구독
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    // 이벤트 구독 취소
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event).filter(cb => cb !== callback);
        if (callbacks.length === 0) {
            this.listeners.delete(event);
        } else {
            this.listeners.set(event, callbacks);
        }
    }

    // 이벤트 발행
    emit(event, data = null) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => callback(data));
    }

    // 모든 구독 초기화 (메모리 정리용)
    clear() {
        this.listeners.clear();
    }
}