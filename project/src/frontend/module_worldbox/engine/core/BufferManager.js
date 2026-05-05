/**
 * 🚀 [Performance Overhaul] BufferManager
 * 모든 엔티티의 "Hot Data"를 TypedArray로 관리하는 중앙 메모리 관리자입니다.
 * DOD(Data-Oriented Design)의 핵심 기반이 됩니다.
 */
export const MODE_TYPES = [
    'idle', 'wander', 'sleep', 'run', 'flee', 'evade', 'hunt', 'forage', 'eat', 'graze', 
    'pickup', 'die', 'grabbed', 'gather_wood', 'build', 'deposit', 'flee', 'berserk', 'unknown'
];

export default class BufferManager {
    constructor(maxEntities = 20000, existingBuffer = null) {
        this.MAX_ENTITIES = maxEntities;
        
        // 💾 각 필드별 바이트 크기 정의
        const FloatSize = 4;   // Float32, Uint32
        const DoubleSize = 8;  // Float64
        const ByteSize = 1;    // Uint8
        
        // 정밀한 바이트 오프셋 계산 (Alignment 고려)
        let currentOffset = 0;
        
        const getOffset = (size, elements) => {
            const start = currentOffset;
            currentOffset += size * elements;
            return start;
        };

        // 전체 사이즈 계산
        const xOffset = getOffset(FloatSize, maxEntities);
        const yOffset = getOffset(FloatSize, maxEntities);
        const vxOffset = getOffset(FloatSize, maxEntities);
        const vyOffset = getOffset(FloatSize, maxEntities);
        const hpOffset = getOffset(FloatSize, maxEntities);
        const maxHpOffset = getOffset(FloatSize, maxEntities);
        const hungerOffset = getOffset(FloatSize, maxEntities);
        const fatigueOffset = getOffset(FloatSize, maxEntities);
        const strengthOffset = getOffset(FloatSize, maxEntities);
        const defenseOffset = getOffset(FloatSize, maxEntities);
        const speedOffset = getOffset(FloatSize, maxEntities);
        const renderFlagsOffset = getOffset(FloatSize, maxEntities);
        
        const activeOffset = getOffset(ByteSize, maxEntities);
        const vTypeOffset = getOffset(ByteSize, maxEntities);
        const modeOffset = getOffset(ByteSize, maxEntities);
        const isFallingOffset = getOffset(ByteSize, maxEntities);
        
        // ⚠️ Float64는 8바이트 정렬이 필요함
        currentOffset = Math.ceil(currentOffset / 8) * 8;
        const lastUpdateOffset = getOffset(DoubleSize, maxEntities);
        
        const vSizeOffset = getOffset(FloatSize, maxEntities);
        const vColorOffset = getOffset(FloatSize, maxEntities);

        const totalSize = currentOffset + (FloatSize * maxEntities * 2); // vSize, vColor
        
        if (existingBuffer) {
            this.sharedBuffer = existingBuffer;
            console.log(`🚀 BufferManager: Connecting to existing buffer (${(existingBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
        } else {
            try {
                this.sharedBuffer = new SharedArrayBuffer(totalSize);
                console.log(`🚀 BufferManager: Using SharedArrayBuffer (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
            } catch (e) {
                this.sharedBuffer = new ArrayBuffer(totalSize);
                console.log(`⚠️ BufferManager: Using standard ArrayBuffer (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
            }
        }

        // 📊 TypedArray Views 연결
        this.x = new Float32Array(this.sharedBuffer, xOffset, maxEntities);
        this.y = new Float32Array(this.sharedBuffer, yOffset, maxEntities);
        this.vx = new Float32Array(this.sharedBuffer, vxOffset, maxEntities);
        this.vy = new Float32Array(this.sharedBuffer, vyOffset, maxEntities);
        this.hp = new Float32Array(this.sharedBuffer, hpOffset, maxEntities);
        this.maxHp = new Float32Array(this.sharedBuffer, maxHpOffset, maxEntities);
        this.hunger = new Float32Array(this.sharedBuffer, hungerOffset, maxEntities);
        this.fatigue = new Float32Array(this.sharedBuffer, fatigueOffset, maxEntities);
        this.strength = new Float32Array(this.sharedBuffer, strengthOffset, maxEntities);
        this.defense = new Float32Array(this.sharedBuffer, defenseOffset, maxEntities);
        this.speed = new Float32Array(this.sharedBuffer, speedOffset, maxEntities);
        this.renderFlags = new Uint32Array(this.sharedBuffer, renderFlagsOffset, maxEntities);
        
        this.active = new Uint8Array(this.sharedBuffer, activeOffset, maxEntities);
        this.vType = new Uint8Array(this.sharedBuffer, vTypeOffset, maxEntities);
        this.mode = new Uint8Array(this.sharedBuffer, modeOffset, maxEntities);
        this.isFalling = new Uint8Array(this.sharedBuffer, isFallingOffset, maxEntities);
        
        this.lastUpdate = new Float64Array(this.sharedBuffer, lastUpdateOffset, maxEntities);
        
        this.vSize = new Float32Array(this.sharedBuffer, vSizeOffset, maxEntities);
        this.vColor = new Uint32Array(this.sharedBuffer, vColorOffset, maxEntities);
    }

    /**
     * 엔티티 데이터를 초기화합니다.
     */
    initEntity(index, data = {}) {
        this.active[index] = 1;
        this.x[index] = data.x || 0;
        this.y[index] = data.y || 0;
        this.vx[index] = 0;
        this.vy[index] = 0;
        this.hp[index] = data.hp || 100;
        this.maxHp[index] = data.maxHp || 100;
        this.hunger[index] = data.hunger || 0;
        this.fatigue[index] = 0;
        this.strength[index] = 10;
        this.defense[index] = 0;
        this.speed[index] = 1.0;
        this.lastUpdate[index] = 0;
        this.vType[index] = 0;
        this.vSize[index] = 10;
        this.vColor[index] = 0xFFFFFF;
        this.mode[index] = 0; // idle
        this.isFalling[index] = 0;
    }

    /**
     * 엔티티를 비활성화합니다. (재사용 대기)
     */
    releaseEntity(index) {
        this.active[index] = 0;
    }

    /**
     * 워커 스레드로 보낼 버퍼를 반환합니다.
     */
    getTransferables() {
        return [this.sharedBuffer];
    }
}
