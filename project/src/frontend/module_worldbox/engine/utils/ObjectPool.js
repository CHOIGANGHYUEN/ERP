/**
 * 📦 Generic Object Pool
 * 
 * 메모리 파편화 및 GC 부하를 줄이기 위해 짧은 수명을 가진 객체들을 재사용합니다.
 */
export default class ObjectPool {
    /**
     * @param {Function} factory - 새로운 객체를 생성하는 함수
     * @param {Function} reset - 객체 재사용 전 초기화하는 함수
     * @param {number} initialSize - 초기 생성 개수
     */
    constructor(factory, reset = null, initialSize = 0) {
        this.factory = factory;
        this.reset = reset;
        this.pool = [];
        
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.factory());
        }
    }

    /**
     * 풀에서 객체를 하나 가져옵니다. 비어있으면 새로 생성합니다.
     */
    get() {
        const obj = this.pool.length > 0 ? this.pool.pop() : this.factory();
        return obj;
    }

    /**
     * 사용이 끝난 객체를 풀에 반환합니다.
     */
    release(obj) {
        if (this.reset) {
            this.reset(obj);
        }
        this.pool.push(obj);
    }

    /**
     * 풀의 모든 객체를 비웁니다.
     */
    clear() {
        this.pool = [];
    }

    get size() {
        return this.pool.length;
    }
}
