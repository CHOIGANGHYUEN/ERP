import { SHARED_LAYOUT } from './Constants.js';

/**
 * 🛰️ Bridge (Thread Synchronization & Shared Memory Manager)
 * 메인 스레드와 Simulation Worker 간의 고속 데이터 통신을 담당합니다.
 */
export default class Bridge {
    constructor(maxEntities = 20000, mapWidth = 2400, mapHeight = 2400) {
        this.MAX_ENTITIES = maxEntities;
        this.STRIDE = SHARED_LAYOUT.STRIDE; 
        
        // 1. SharedArrayBuffer 생성
        this.buffer = new SharedArrayBuffer(this.MAX_ENTITIES * this.STRIDE * 4);
        this.data = new Float32Array(this.buffer);
        this.intData = new Int32Array(this.buffer);
        
        // 2. 인덱스 관리
        this.freeIndices = [];
        for (let i = this.MAX_ENTITIES - 1; i >= 0; i--) {
            this.freeIndices.push(i);
        }
        
        this.worker = null;
        this.onMessageHandlers = new Map();

        // 🗺️ Map Shared Buffers
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.mapBufferSize = this.mapWidth * this.mapHeight;

        this.mapBuffers = {
            terrain: new SharedArrayBuffer(this.mapBufferSize),
            biome: new SharedArrayBuffer(this.mapBufferSize),
            fertility: new SharedArrayBuffer(this.mapBufferSize),
            water: new SharedArrayBuffer(this.mapBufferSize),
            mineral: new SharedArrayBuffer(this.mapBufferSize),
            occupancy: new SharedArrayBuffer(this.mapBufferSize),
            color: new SharedArrayBuffer(this.mapBufferSize * 4) // Uint32
        };
    }

    /** Worker 초기화 */
    initWorker(workerUrl) {
        this.worker = new Worker(workerUrl, { type: 'module' });
        this.worker.onmessage = (e) => this.handleMessage(e.data);
        
        // 초기 버퍼 전송
        this.worker.postMessage({
            type: 'INIT_BUFFER',
            buffer: this.buffer,
            maxEntities: this.MAX_ENTITIES,
            stride: this.STRIDE,
            mapBuffers: this.mapBuffers
        });
    }

    /** 워커로부터 오는 메시지 처리 */
    handleMessage(msg) {
        const handlers = this.onMessageHandlers.get(msg.type);
        if (handlers) {
            handlers.forEach(handler => handler(msg.payload));
        }
    }

    on(type, handler) {
        if (!this.onMessageHandlers.has(type)) {
            this.onMessageHandlers.set(type, []);
        }
        this.onMessageHandlers.get(type).push(handler);
    }

    send(type, payload) {
        if (this.worker) {
            this.worker.postMessage({ type, payload });
        }
    }

    /** 엔티티용 공유 슬롯 할당 */
    allocateIndex() {
        if (this.freeIndices.length === 0) {
            console.error("🚨 Shared Buffer Full! Cannot allocate more entity slots.");
            return -1;
        }
        return this.freeIndices.pop();
    }

    /** 슬롯 해제 */
    releaseIndex(index) {
        const offset = index * this.STRIDE;
        // 데이터 초기화
        this.data.fill(0, offset, offset + this.STRIDE);
        this.freeIndices.push(index);
    }

    // --- Helper Getters for Rendering (Main Thread) ---
    getEntityData(index) {
        const offset = index * this.STRIDE;
        const L = SHARED_LAYOUT;
        return {
            x: this.data[offset + L.X],
            y: this.data[offset + L.Y],
            size: this.data[offset + L.SIZE],
            alpha: this.data[offset + L.ALPHA],
            typeId: this.intData[offset + L.TYPE_ID],
            flags: this.intData[offset + L.FLAGS],
            mode: this.intData[offset + L.MODE_ID],
            id: this.intData[offset + L.ID]
        };
    }
}
