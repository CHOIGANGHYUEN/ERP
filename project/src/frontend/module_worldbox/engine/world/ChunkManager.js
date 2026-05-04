export default class ChunkManager {
    constructor(engine, chunkSize = 50) {
        this.engine = engine;
        this.chunkSize = chunkSize;
        this.mapWidth = engine.mapWidth;
        this.mapHeight = engine.mapHeight;
        this.cols = Math.ceil(this.mapWidth / chunkSize);
        this.rows = Math.ceil(this.mapHeight / chunkSize);
        
        // Master buffer for the whole map
        this.buffer = new Uint32Array(this.mapWidth * this.mapHeight);
        this.imgData = new ImageData(new Uint8ClampedArray(this.buffer.buffer), this.mapWidth, this.mapHeight);
        
        this.dirtyChunks = new Set();
    }

    markDirty(x, y) {
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return;
        const cx = Math.floor(x / this.chunkSize);
        const cy = Math.floor(y / this.chunkSize);
        this.dirtyChunks.add(cy * this.cols + cx);
        
        // Update the pixel in the master buffer directly
        const idx = y * this.mapWidth + x;
        const color = this.engine.terrainGen.getTerrainColor(idx, this.engine.viewFlags);
        
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        
        // Little Endian format: AABBGGRR
        this.buffer[idx] = (255 << 24) | (b << 16) | (g << 8) | r;
    }

    /** ⚡ [Ultra-Fast Optimization] 점진적 컬러 재계산 (메인 스레드 프리징 방지) */
    async markAllDirty(recalculateColors = true) {
        for (let i = 0; i < this.cols * this.rows; i++) {
            this.dirtyChunks.add(i);
        }
        
        if (recalculateColors) {
            const mapWidth = this.mapWidth;
            const mapHeight = this.mapHeight;
            const viewFlags = this.engine.viewFlags;
            const tg = this.engine.terrainGen;
            const buffer = this.buffer;

            // 🚀 [Optimization] 로컬 변수 캐싱으로 가속
            const terrainBuf = tg.terrain.buffer;
            const fertBuf = tg.fertilityBuffer;
            const wqBuf = tg.waterQualityBuffer;
            const mdBuf = tg.mineralDensityBuffer;

            // 🎯 정책 결정 (루프 외부에서 단 한 번)
            let mode = 'normal';
            if (viewFlags.fertility) mode = 'fertility';
            else if (viewFlags.water) mode = 'water';
            else if (viewFlags.mineral) mode = 'mineral';

            const batchSize = 256; // 🚀 처리량을 4배로 증가 (최적화가 잘 되어 있어 가능)

            for (let y = 0; y < mapHeight; y += batchSize) {
                const endY = Math.min(y + batchSize, mapHeight);
                
                for (let currY = y; currY < endY; currY++) {
                    const rowOff = currY * mapWidth;
                    
                    // 🏎️ [Expert Mode] 정책별 전용 루프 (이중 루프 내 조건문 최소화)
                    if (mode === 'fertility') {
                        for (let x = 0; x < mapWidth; x++) {
                            const idx = rowOff + x;
                            const t = terrainBuf[idx];
                            if (t === 4 || t === 5) {
                                const f = fertBuf[idx];
                                buffer[idx] = f < 80 ? 0xFF636E8D : (f < 180 ? 0xFF50AF4C : 0xFF327D2E);
                            } else buffer[idx] = 0xFF111111;
                        }
                    } else if (mode === 'water') {
                        for (let x = 0; x < mapWidth; x++) {
                            const idx = rowOff + x;
                            const t = terrainBuf[idx];
                            if (t <= 1) { // OCEAN, DEEP
                                const wq = wqBuf[idx] >> 6;
                                buffer[idx] = wq === 0 ? 0xFFC06515 : (wq === 1 ? 0xFFE5881E : (wq === 2 ? 0xFFF5A542 : 0xFFF9CA90));
                            } else buffer[idx] = 0xFF111111;
                        }
                    } else if (mode === 'mineral') {
                        for (let x = 0; x < mapWidth; x++) {
                            const idx = rowOff + x;
                            const t = terrainBuf[idx];
                            if (t >= 6) { // MOUNTAINS
                                const md = mdBuf[idx] >> 6;
                                buffer[idx] = md === 0 ? 0xFF424242 : (md === 1 ? 0xFF757575 : (md === 2 ? 0xFFBDBDBD : 0xFFFFFFFF));
                            } else buffer[idx] = 0xFF111111;
                        }
                    } else {
                        // 🏎️ [Ultra-Fast Normal Mode] 미리 계산된 Color LUT 사용
                        const colorLUT = tg.colorLUT;
                        for (let x = 0; x < mapWidth; x++) {
                            const idx = rowOff + x;
                            const t = terrainBuf[idx];
                            const b = biomeBuf[idx];
                            const fIdx = fertBuf[idx] >> 4;
                            buffer[idx] = colorLUT[(t << 8) | (b << 4) | fIdx];
                        }
                    }
                }

                await new Promise(resolve => requestAnimationFrame(resolve));
                if (this.engine.isRunning) {
                    this.render(this.engine.terrainCtx);
                }
            }
        }
    }

    /** 🎨 [Expert Optimization] 블록 단위로 버퍼 채우기 (점진적 생성용) */
    fillBlock(x, y, step, color) {
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        const abgr = (255 << 24) | (b << 16) | (g << 8) | r;
        
        for (let dy = 0; dy < step && y + dy < this.mapHeight; dy++) {
            const rowOffset = (y + dy) * this.mapWidth;
            for (let dx = 0; dx < step && x + dx < this.mapWidth; dx++) {
                this.buffer[rowOffset + (x + dx)] = abgr;
            }
        }
    }

    render(ctx) {
        if (this.dirtyChunks.size === 0) {
            // 강제 전체 렌더링 (점진적 생성 등에서 사용)
            ctx.putImageData(this.imgData, 0, 0);
            return;
        }

        // If many chunks are dirty, just render the whole thing at once
        if (this.dirtyChunks.size > (this.cols * this.rows) / 2) {
            ctx.putImageData(this.imgData, 0, 0);
        } else {
            // Render only dirty chunks
            for (const chunkIdx of this.dirtyChunks) {
                const cx = chunkIdx % this.cols;
                const cy = Math.floor(chunkIdx / this.cols);
                const x = cx * this.chunkSize;
                const y = cy * this.chunkSize;
                
                ctx.putImageData(this.imgData, 0, 0, x, y, this.chunkSize, this.chunkSize);
            }
        }
        this.dirtyChunks.clear();
    }
}