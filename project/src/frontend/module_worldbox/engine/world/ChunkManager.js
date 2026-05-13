import Chunk from './Chunk.js';
import { WaterRenderer } from '../objects/renders/nature/WaterRenderer.js';
import Pathfinder from '../utils/Pathfinder.js';

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
        this.maxActiveCanvases = 1024; 
        this.canvasLRU = []; // [Chunk, Chunk, ...] - 마지막에 추가된 것이 가장 최신
        this.activeCanvasCount = 0;
        this.dirtyChunks = new Set();
        
        // 🚀 [Expert AI] 초기 로딩 중에는 모든 청크를 한꺼번에 업데이트하기 위한 플래그
        this.initialLoadComplete = false;

        
        // 마스터 버퍼 (SharedArrayBuffer 사용)
        this.buffer = new Uint32Array(new SharedArrayBuffer(this.mapWidth * this.mapHeight * 4));
    }

    _initChunks() {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.chunks.push(new Chunk(
                    x * this.chunkSize,
                    y * this.chunkSize,
                    this.chunkSize,
                    this.engine,
                    this // ChunkManager 참조 전달
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

    /** 👁️ 뷰포트 영역 내의 가시 청크 선별 (Culling + Padding) */
    getVisibleChunks(viewport, padding = 1) {
        const visible = [];
        const zoom = this.engine.camera?.zoom || 1.0;
        
        // 🚀 [Expert Fix] 축소 시 외곽 잘림 방지를 위해 패딩 동적 조절
        const finalPadding = zoom < 0.3 ? padding + 1 : padding;
        
        // 뷰포트 인덱스 범위 계산 (Padding 추가로 스크롤 시 빈 공간 노출 방지)
        const startCol = Math.max(0, Math.floor(viewport.x / this.chunkSize) - finalPadding);
        const endCol = Math.min(this.cols - 1, Math.floor((viewport.x + viewport.width) / this.chunkSize) + finalPadding);
        const startRow = Math.max(0, Math.floor(viewport.y / this.chunkSize) - finalPadding);
        const endRow = Math.min(this.rows - 1, Math.floor((viewport.y + viewport.height) / this.chunkSize) + finalPadding);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const chunk = this.chunks[r * this.cols + c];
                visible.push(chunk);
            }
        }

        return visible;
    }

    /** 📈 LRU 캐시 업데이트 (청크가 사용될 때마다 최신화) */
    touchChunk(chunk) {
        if (!chunk.offscreenCanvas) return;
        
        const idx = this.canvasLRU.indexOf(chunk);
        if (idx !== -1) {
            // 기존 위치에서 제거하고 끝(최신)으로 이동
            this.canvasLRU.splice(idx, 1);
        }
        this.canvasLRU.push(chunk);
        
        // 메모리 제한 체크
        if (this.canvasLRU.length > this.maxActiveCanvases) {
            this._enforceMemoryLimit();
        }
    }

    notifyCanvasAcquired(chunk) {
        if (!this.canvasLRU.includes(chunk)) {
            this.canvasLRU.push(chunk);
            this.activeCanvasCount++;
        }
        if (this.canvasLRU.length > this.maxActiveCanvases) {
            this._enforceMemoryLimit();
        }
    }

    notifyCanvasReleased(chunk) {
        const idx = this.canvasLRU.indexOf(chunk);
        if (idx !== -1) {
            this.canvasLRU.splice(idx, 1);
            this.activeCanvasCount--;
        }
    }

    _enforceMemoryLimit() {
        while (this.canvasLRU.length > this.maxActiveCanvases) {
            const oldest = this.canvasLRU.shift(); // 가장 오래된 것 추출
            if (oldest) {
                this.activeCanvasCount--;
                oldest.releaseCanvas(); // 자원 해제
            }
        }
    }

    markDirty(x, y) {
        const chunk = this.getChunkAt(x, y);
        if (chunk) {
            chunk.markDirty();
            this.dirtyChunks.add(chunk);
            
            // 🗺️ [Expert Optimization] 동적 임포트 제거 및 즉시 갱신
            if (Pathfinder && typeof Pathfinder.markClusterDirty === 'function') {
                Pathfinder.markClusterDirty(x, y);
            }
        }
    }

    /** ⚡ 전체 맵 초기화 또는 대규모 변경 시 호출 */
    async markAllDirty() {
        for (const chunk of this.chunks) {
            chunk.markDirty();
            this.dirtyChunks.add(chunk);
        }
    }

    /** 🎨 메인 렌더링 (RenderCoordinator에서 호출됨) */
    render(ctx, camera) {
        camera = camera || this.engine.camera;
        if (!camera || !camera.getViewportBounds) return;
        
        const viewport = camera.getViewportBounds();
        const visibleChunks = this.getVisibleChunks(viewport);
        
        // 🚀 [Incremental Update Optimization]
        // 초기 로딩 중에는 전체를 한꺼번에 업데이트하고, 이후엔 프레임 드랍 방지를 위해 제한함
        let updatesThisFrame = 0;
        const MAX_UPDATES_PER_FRAME = this.initialLoadComplete ? 8 : 512; 


        for (const chunk of visibleChunks) {
            if (chunk.isDirty && updatesThisFrame < MAX_UPDATES_PER_FRAME) {
                chunk.updateCanvas();
                chunk.isDirty = false;
                this.dirtyChunks.delete(chunk);
                updatesThisFrame++;
            }
        }

        // 줌 레벨에 따른 LOD 결정
        const isClose = camera.zoom > 0.4;

        for (const chunk of visibleChunks) {
            if (isClose) {
                chunk.renderLOD1(ctx);
                
                // 🌊 [Water Animation Overlay]
                // 고해상도 모드에서 수역이 있는 청크에 한해 애니메이션 레이어 추가
                if (chunk.hasWater && !this.engine.viewFlags.NATIONTILE) {
                    WaterRenderer.renderWater(
                        ctx, 
                        chunk.x, 
                        chunk.y, 
                        chunk.size, 
                        chunk.size, 
                        performance.now()
                    );
                }
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