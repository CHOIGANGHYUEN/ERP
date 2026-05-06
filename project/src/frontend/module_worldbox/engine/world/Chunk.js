/**
 * 📦 Chunk (지형 청크)
 * 512x512 단위의 독립적인 렌더링 유닛입니다.
 * 자신만의 OffscreenCanvas를 가지며, LOD(Level of Detail)에 따라
 * 고해상도(LOD1) 또는 저해상도(LOD0) 이미지를 제공합니다.
 */
export default class Chunk {
    constructor(x, y, size, engine) {
        this.x = x; // 월드 좌표 (pixel)
        this.y = y;
        this.size = size;
        this.engine = engine;
        
        this.isDirty = true;
        this.offscreenCanvas = null;
        this.offscreenCtx = null;
        
        // LOD 0 (저해상도) 미니맵 데이터
        this.minimapBitmap = null;
        this.isMinimapGenerating = false;
        
        // 마지막 사용 시간 (LRU 캐싱용)
        this.lastUsedTime = Date.now();
    }

    /** 🎨 고해상도 캔버스 할당 (필요할 때만 생성) */
    acquireCanvas() {
        if (!this.offscreenCanvas) {
            this.offscreenCanvas = new OffscreenCanvas(this.size, this.size);
            this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
            this.isDirty = true;
        }
        this.lastUsedTime = Date.now();
        return this.offscreenCanvas;
    }

    /** 🗑️ 캔버스 자원 해제 (메모리 절약) */
    releaseCanvas() {
        this.offscreenCanvas = null;
        this.offscreenCtx = null;
    }

    /** ⚡ 저해상도 미니맵 생성 (LOD 0) */
    async generateMinimap() {
        if (this.isMinimapGenerating) return;
        this.isMinimapGenerating = true;

        const mapWidth = this.engine.mapWidth;
        const packedBuffer = this.engine.terrainGen.packedBuffer;
        const colorLUT = this.engine.terrainGen.colorLUT;
        
        // 16x16 축소판 생성
        const miniSize = 16;
        const miniBuffer = new Uint32Array(miniSize * miniSize);
        const scale = this.size / miniSize;

        for (let my = 0; my < miniSize; my++) {
            for (let mx = 0; mx < miniSize; mx++) {
                const wx = Math.floor(this.x + mx * scale);
                const wy = Math.floor(this.y + my * scale);
                
                if (wx < mapWidth && wy < this.engine.mapHeight) {
                    const idx = wy * mapWidth + wx;
                    const val = packedBuffer[idx];
                    const t = val & 0xFF;
                    const b = (val >> 8) & 0xFF;
                    const fIdx = (val >> 20) & 0x0F;
                    miniBuffer[my * miniSize + mx] = colorLUT[(t << 8) | (b << 4) | fIdx];
                }
            }
        }

        const imgData = new ImageData(new Uint8ClampedArray(miniBuffer.buffer), miniSize, miniSize);
        try {
            this.minimapBitmap = await createImageBitmap(imgData);
        } catch (e) {
            console.error('[Chunk] Minimap generation failed:', e);
        } finally {
            this.isMinimapGenerating = false;
        }
    }

    /** 🖌️ 고해상도 렌더링 (LOD 1) */
    renderLOD1(ctx) {
        this.lastUsedTime = Date.now();
        
        if (this.isDirty) {
            this.updateCanvas();
            this.isDirty = false;
        }

        if (this.offscreenCanvas) {
            ctx.drawImage(this.offscreenCanvas, this.x, this.y, this.size, this.size);
        }
    }

    /** 🖌️ 저해상도 렌더링 (LOD 0) */
    renderLOD0(ctx) {
        if (!this.minimapBitmap) {
            this.generateMinimap();
            // 아직 없으면 배경색으로 대체하거나 LOD1 강제 호출 (여기서는 그냥 drawRect)
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(this.x, this.y, this.size, this.size);
            return;
        }
        
        // 16x16 미니맵을 512x512 크기로 확대해서 그림
        ctx.drawImage(this.minimapBitmap, this.x, this.y, this.size, this.size);
    }

    /** 🔄 캔버스 픽셀 데이터 갱신 */
    updateCanvas() {
        this.acquireCanvas();
        const ctx = this.offscreenCtx;
        const size = this.size;
        const mapWidth = this.engine.mapWidth;
        const mapHeight = this.engine.mapHeight;
        const packedBuffer = this.engine.terrainGen.packedBuffer;
        const colorLUT = this.engine.terrainGen.colorLUT;
        
        const imgData = ctx.createImageData(size, size);
        const data = new Uint32Array(imgData.data.buffer);

        for (let cy = 0; cy < size; cy++) {
            const wy = this.y + cy;
            if (wy >= mapHeight) break;
            
            const rowOffset = cy * size;
            const worldRowOffset = wy * mapWidth;

            for (let cx = 0; cx < size; cx++) {
                const wx = this.x + cx;
                if (wx >= mapWidth) break;

                const idx = worldRowOffset + wx;
                const val = packedBuffer[idx];
                const t = val & 0xFF;
                const b = (val >> 8) & 0xFF;
                const fIdx = (val >> 20) & 0x0F;
                data[rowOffset + cx] = colorLUT[(t << 8) | (b << 4) | fIdx];
            }
        }
        
        ctx.putImageData(imgData, 0, 0);
    }

    markDirty() {
        this.isDirty = true;
    }
}
