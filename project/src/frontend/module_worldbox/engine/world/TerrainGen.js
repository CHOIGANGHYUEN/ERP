import MathUtils from '../utils/MathUtils.js';
import biomesData from '../config/biomes.json';

export const BIOMES = {};
export const BiomeProperties = {};

biomesData.biomes.forEach(b => {
    BIOMES[b.name] = b.id;
    BiomeProperties[b.id] = b;
});

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

        // 🟢 FERTILITY VIEW MODE (Extreme Contrast Edition)
        if (viewFlags && viewFlags.fertility) {
            if (fertility <= 0.02) return 0x0a0a0a; // Empty Earth (Near Black)
            
            // Linear but steep contrast: 
            // 0.1: Dark Forest (#004411)
            // 0.7: Rich Emerald (#00FF66)
            // 1.0: Divine Mint (#00FFCC)
            const t = (fertility - 0.1) / 0.9;
            const r_fert = 0;
            const g_fert = Math.floor(60 + t * 195);
            const b_fert = Math.floor(20 + t * 200);
            return (r_fert << 16) | (g_fert << 8) | b_fert;
        }

        // 🎨 NORMAL BIOME RENDERING
        const props = BiomeProperties[biome];
        if (!props) return 0;

        let r, g, b_col;

        // Interpolate colors based on fertility
        if (props.colorLow && props.colorHigh) {
            r = props.colorLow[0] * (1 - fertility) + props.colorHigh[0] * fertility;
            g = props.colorLow[1] * (1 - fertility) + props.colorHigh[1] * fertility;
            b_col = props.colorLow[2] * (1 - fertility) + props.colorHigh[2] * fertility;
        }

        // Meadow Flower Patching for Grass/biomes with flowers
        if (props.hasFlowers) {
            const x = idx % this.width;
            const y = Math.floor(idx / this.width);
            const flowerNoise = (this.math.perlin(x * 0.05, y * 0.05) + 1) / 2;
            
            if (fertility > 0.4 && flowerNoise > 0.72) {
                const subHash = (idx * 0.123) % 1;
                if (subHash > 0.7) { r = 240; g = 100; b_col = 150; } // Wild Pink
                else if (subHash > 0.4) { r = 245; g = 210; b_col = 60; } // Wild Yellow
                else { r = 230; g = 230; b_col = 220; } // White
            }
        }

        // Fertility Debug Overlay (Optional)
        if (viewFlags?.fertility && biome !== BIOMES.OCEAN) {
            r = r * 0.4;
            g = g * 0.4 + 200 * fertility; // Explicit green glow
            b_col = b_col * 0.4;
        }
        
        return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b_col);
    }

    reclaimFertility(idx) { return this.fertilityBuffer[idx] || 0; }
    assignFertility(idx, hum) {
        const val = hum * 0.5 + 0.1;
        this.fertilityBuffer[idx] = Math.min(1.0, val);
        return val;
    }
}