import Chunk from './Chunk.js';

/**
 * 🗺️ ChunkManager (청크 관리자)
 * 전체 맵을 고정 크기의 청크로 분할하여 관리합니다.
 * 시야(Culling)에 들어온 청크만 렌더링하고, 메모리 보호를 위해
 * 사용되지 않는 청크의 캔버스 자원을 자동으로 회수합니다.
 */
export default class ChunkManager {
    constructor(engine, chunkSize = 512) {
        this.engine = engine;
        this.chunkSize = chunkSize;
        this.mapWidth = engine.mapWidth;
        this.mapHeight = engine.mapHeight;
        
        this.cols = Math.ceil(this.mapWidth / chunkSize);
        this.rows = Math.ceil(this.mapHeight / chunkSize);
        
        this.chunks = [];
        this._initChunks();

        // LRU 캐시 관리 (최대 활성 캔버스 수 제한)
        this.maxActiveCanvases = 64; 
        this.activeChunks = new Set();
        
        // 마스터 버퍼 (TerrainGen에서 직접 접근하는 용도 유지)
        this.buffer = new Uint32Array(this.mapWidth * this.mapHeight);
    }

    _initChunks() {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.chunks.push(new Chunk(
                    x * this.chunkSize,
                    y * this.chunkSize,
                    this.chunkSize,
                    this.engine
                ));
            }
        }
    }

    /** 🎯 좌표에 해당하는 청크 반환 */
    getChunkAt(worldX, worldY) {
        if (worldX < 0 || worldX >= this.mapWidth || worldY < 0 || worldY >= this.mapHeight) return null;
        const cx = Math.floor(worldX / this.chunkSize);
        const cy = Math.floor(worldY / this.chunkSize);
        return this.chunks[cy * this.cols + cx];
    }

    /** 👁️ 뷰포트 영역 내의 가시 청크 선별 (Culling) */
    getVisibleChunks(viewport) {
        const visible = [];
        
        // 뷰포트 인덱스 범위 계산
        const startCol = Math.max(0, Math.floor(viewport.x / this.chunkSize));
        const endCol = Math.min(this.cols - 1, Math.floor((viewport.x + viewport.width) / this.chunkSize));
        const startRow = Math.max(0, Math.floor(viewport.y / this.chunkSize));
        const endRow = Math.min(this.rows - 1, Math.floor((viewport.y + viewport.height) / this.chunkSize));

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const chunk = this.chunks[r * this.cols + c];
                visible.push(chunk);
                
                // LRU 관리: 현재 사용 중인 청크 등록
                this.activeChunks.add(chunk);
            }
        }

        // 메모리 관리: 너무 많은 캔버스가 활성화되어 있으면 오래된 것부터 해제
        this._enforceMemoryLimit();

        return visible;
    }

    _enforceMemoryLimit() {
        // 활성화된 청크 중 실제 캔버스를 가진 청크들을 추적
        const chunksWithCanvas = this.chunks.filter(c => c.offscreenCanvas);
        
        if (chunksWithCanvas.length > this.maxActiveCanvases) {
            // 마지막 사용 시간 기준 정렬 (오래된 순)
            chunksWithCanvas.sort((a, b) => a.lastUsedTime - b.lastUsedTime);
            
            const toRelease = chunksWithCanvas.length - this.maxActiveCanvases;
            for (let i = 0; i < toRelease; i++) {
                // 현재 화면에 보이는 청크는 해제하지 않도록 안전장치 (옵션)
                chunksWithCanvas[i].releaseCanvas();
            }
        }
    }

    markDirty(x, y) {
        const chunk = this.getChunkAt(x, y);
        if (chunk) {
            chunk.markDirty();
        }
    }

    /** ⚡ 전체 맵 초기화 또는 대규모 변경 시 호출 */
    async markAllDirty() {
        for (const chunk of this.chunks) {
            chunk.markDirty();
        }
    }

    /** 🎨 메인 렌더링 (RenderCoordinator에서 호출됨) */
    render(ctx, camera) {
        const viewport = camera.getViewportBounds();
        const visibleChunks = this.getVisibleChunks(viewport);
        
        // 줌 레벨에 따른 LOD 결정
        const isClose = camera.zoom > 0.4;

        for (const chunk of visibleChunks) {
            if (isClose) {
                chunk.renderLOD1(ctx);
            } else {
                chunk.renderLOD0(ctx);
            }
        }
    }

    // --- Legacy Compatibility ---
    // TerrainGen 등에서 직접 픽셀을 채울 때 사용하던 buffer에 대한 호환성 레이어
    fillBlock(x, y, step, color) {
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        const abgr = (255 << 24) | (b << 16) | (g << 8) | r;
        
        for (let dy = 0; dy < step && y + dy < this.mapHeight; dy++) {
            const rowOffset = (y + dy) * this.mapWidth;
            const chunkRow = this.getChunkAt(x, y + dy);
            if (chunkRow) chunkRow.markDirty();

            for (let dx = 0; dx < step && x + dx < this.mapWidth; dx++) {
                this.buffer[rowOffset + (x + dx)] = abgr;
            }
        }
    }
}