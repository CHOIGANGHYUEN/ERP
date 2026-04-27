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

    markAllDirty() {
        for (let i = 0; i < this.cols * this.rows; i++) {
            this.dirtyChunks.add(i);
        }
        
        for (let i = 0; i < this.mapWidth * this.mapHeight; i++) {
            const color = this.engine.terrainGen.getTerrainColor(i, this.engine.viewFlags);
            const r = (color >> 16) & 0xff;
            const g = (color >> 8) & 0xff;
            const b = color & 0xff;
            this.buffer[i] = (255 << 24) | (b << 16) | (g << 8) | r;
        }
    }

    render(ctx) {
        if (this.dirtyChunks.size === 0) return;

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