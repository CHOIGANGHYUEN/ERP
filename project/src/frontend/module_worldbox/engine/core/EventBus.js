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
        
        // 🚀 [Expert Optimization] Deferred & Batched Events
        this.deferredEvents = new Map(); // eventName -> dataQueue

        // 🎯 [Expert Optimization] 이벤트별 배칭/필터링 전략 정의
        this.strategies = {
            'CACHE_PIXEL_UPDATE': (queue) => {
                // 'all' 플래그가 하나라도 있으면 전체 갱신으로 갈음
                for (const d of queue) { if (d.all) return [{ all: true, reason: 'batched_all' }]; }
                
                // 중복 좌표 제거 (최신 데이터 우선)
                const unique = new Map();
                for (const d of queue) {
                    const key = (Math.floor(d.y) << 16) | Math.floor(d.x);
                    unique.set(key, d);
                }
                return Array.from(unique.values());
            },
            'SPAWN_PARTICLES': (queue) => {
                // 한 프레임에 너무 많은 파티클 요청이 오면 캡핑 (부하 방지)
                if (queue.length > 50) return queue.slice(0, 50);
                return queue;
            },
            'SPAWN_DUST': (queue) => {
                if (queue.length > 20) return queue.slice(0, 20);
                return queue;
            }
        };
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

    // 실시간 이벤트 발행 (동기 실행)
    emit(event, data = null) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => callback(data));
    }

    /** 🚀 [Expert Optimization] 지연 발행 (프레임 끝에서 일괄 처리) */
    emitDeferred(event, data = null) {
        if (!this.deferredEvents.has(event)) {
            this.deferredEvents.set(event, []);
        }
        this.deferredEvents.get(event).push(data);
    }

    /** 🧹 [Expert Optimization] 지연된 이벤트들을 일괄 실행하고 큐를 비웁니다. */
    flush() {
        if (this.deferredEvents.size === 0) return;

        for (const [event, queue] of this.deferredEvents) {
            const listeners = this.listeners.get(event);
            if (!listeners || listeners.length === 0) continue;

            // 전략이 있으면 적용, 없으면 큐 전체 처리
            const processedQueue = this.strategies[event] ? this.strategies[event](queue) : queue;

            for (let i = 0; i < processedQueue.length; i++) {
                const data = processedQueue[i];
                for (let j = 0; j < listeners.length; j++) {
                    listeners[j](data);
                }
            }
        }

        this.deferredEvents.clear();
    }

    // 모든 구독 초기화 (메모리 정리용)
    clear() {
        this.listeners.clear();
        this.deferredEvents.clear();
    }
}