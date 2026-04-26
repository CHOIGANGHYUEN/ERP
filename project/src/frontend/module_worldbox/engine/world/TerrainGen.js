import MathUtils from '../utils/MathUtils.js';

export const BIOMES = {
    OCEAN: 0,
    DIRT: 1,
    GRASS: 2,
    SAND: 3,
    JUNGLE: 4,
    BEACH: 5
};

export default class TerrainGen {
    constructor(entityManager) {
        this.math = new MathUtils();
        this.entityManager = entityManager;
        this.biomeBuffer = new Uint8Array(1000000);
        this.fertilityBuffer = new Float32Array(1000000);
        this.width = 1000;
        this.height = 1000;
    }

    generate(width, height) {
        this.width = width;
        this.height = height;
        const size = width * height;
        if (!this.biomeBuffer || this.biomeBuffer.length !== size) {
            this.biomeBuffer = new Uint8Array(size);
            this.fertilityBuffer = new Float32Array(size);
        }
        for (let i = 0; i < size; i++) {
            const x = i % width;
            const y = Math.floor(i / width);
            const alt = (this.math.perlin(x * 0.012, y * 0.012) + 1) / 2;
            
            if (alt < 0.35) {
                this.biomeBuffer[i] = BIOMES.OCEAN;
                this.fertilityBuffer[i] = 0.0;
            } else {
                // BLUEPRINT: Start the world as pure DIRT (Sterile)
                this.biomeBuffer[i] = BIOMES.DIRT;
                this.fertilityBuffer[i] = 0.0; 
            }
        }
    }

    getTerrainColor(idx, viewFlags) {
        if (!this.biomeBuffer || idx >= this.biomeBuffer.length) return 0;
        const biome = this.biomeBuffer[idx];
        const fertility = this.fertilityBuffer[idx] || 0;

        // 🟢 FERTILITY VIEW MODE (Heatmap Style)
        if (viewFlags && viewFlags.fertility) {
            if (fertility <= 0.05) return 0x222222; // Sterile ground (Dark Gray)
            
            // Dramatic transition: Gray -> Green -> Blinding Neon Green
            const g = Math.floor(fertility * 255);
            const r = Math.floor(Math.pow(fertility, 3) * 100); // Slight warmth in super-rich soil
            const b = Math.floor(Math.pow(fertility, 3) * 50);
            return (r << 16) | (g << 8) | b;
        }

        // 🎨 NORMAL BIOME RENDERING
        const b = biome;
        const f = fertility;
        let r, g, b_col;

        if (b === BIOMES.OCEAN) { 
            r = 10; g = 80 + f * 50; b_col = 160; 
        }
        else if (b === BIOMES.GRASS) { 
            // BLUEPRINT 130-131: COLOR BY FERTILITY
            // Low Fertility: Withered Brownish-yellow (180, 160, 60)
            // High Fertility: Lush Dark Green (20, 100, 20)
            r = 180 * (1 - f) + 40 * f;
            g = 160 * (1 - f) + 140 * f;
            b_col = 60 * (1 - f) + 30 * f;
            
            // Meadow Flower Patching (Driven by fertility)
            const x = idx % 1000;
            const y = Math.floor(idx / 1000);
            const flowerNoise = (this.math.perlin(x * 0.05, y * 0.05) + 1) / 2;
            
            if (f > 0.4 && flowerNoise > 0.72) {
                const subHash = (idx * 0.123) % 1;
                if (subHash > 0.7) { r = 240; g = 100; b_col = 150; } // Wild Pink
                else if (subHash > 0.4) { r = 245; g = 210; b_col = 60; } // Wild Yellow
                else { r = 230; g = 230; b_col = 220; } // White
            }
        }
        else if (b === BIOMES.JUNGLE) { 
            // Darker, denser greens
            r = 20 * (1 - f);
            g = 80 * f + 20; 
            b_col = 20 * (1 - f);
        }
        else if (b === BIOMES.SAND) { r = 210; g = 190; b_col = 130; }
        else if (b === BIOMES.BEACH) { r = 230; g = 210; b_col = 160; }
        else { r = 100 - f * 40; g = 70 - f * 20; b_col = 40 - f * 20; } // DIRT

        // Fertility Debug Overlay (Optional)
        if (viewFlags?.fertility && b !== BIOMES.OCEAN) {
            r = r * 0.4;
            g = g * 0.4 + 200 * f; // Explicit green glow
            b_col = b_col * 0.4;
        }
        return (r << 16) | (g << 8) | b_col;
    }

    reclaimFertility(idx) { return this.fertilityBuffer[idx] || 0; }
    assignFertility(idx, hum) {
        const val = hum * 0.5 + 0.1;
        this.fertilityBuffer[idx] = Math.min(1.0, val);
        return val;
    }
}