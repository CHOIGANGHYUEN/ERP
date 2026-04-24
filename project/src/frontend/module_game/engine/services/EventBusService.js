export class EventBusService {
  constructor() {
    this.listeners = new Map()
  }

  /**
   * 이벤트 구독
   * @param {string} eventName 
   * @param {function} callback 
   */
  subscribe(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set())
    }
    this.listeners.get(eventName).add(callback)
    
    // Unsubscribe 함수 반환
    return () => {
      const set = this.listeners.get(eventName)
      if (set) {
        set.delete(callback)
        if (set.size === 0) this.listeners.delete(eventName)
      }
    }
  }

  /**
   * 이벤트 발행
   * @param {string} eventName 
   * @param {any} payload 
   */
  publish(eventName, payload) {
    const set = this.listeners.get(eventName)
    if (!set) return

    set.forEach(callback => {
      try {
        callback(payload)
      } catch (e) {
        console.error(`[EventBus] "${eventName}" 콜백 실행 중 오류:`, e)
      }
    })
  }

  clear() {
    this.listeners.clear()
  }
}
