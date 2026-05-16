/**
 * 🌊 NoiseGenerator
 * Perlin Noise 등 수학적 지형 생성 알고리즘을 담당합니다.
 * TerrainGen.js에서 SRP에 따라 분리되었습니다.
 */
export default class NoiseGenerator {
    constructor() {
        this._p = new Uint8Array(512);
        this._initNoise();
    }

    _initNoise() {
        const p = new Uint8Array(256);
        for(let i=0; i<256; i++) p[i] = i;
        for(let i=255; i>0; i--) {
            const r = Math.floor(Math.random() * (i + 1));
            [p[i], p[r]] = [p[r], p[i]];
        }
        for(let i=0; i<512; i++) this._p[i] = p[i & 255];
    }

    perlin(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = x * x * x * (x * (x * 6 - 15) + 10);
        const v = y * y * y * (y * (y * 6 - 15) + 10);
        const p = this._p;
        const A = p[X] + Y, AA = p[A], AB = p[A + 1];
        const B = p[X + 1] + Y, BA = p[B], BB = p[B + 1];

        const grad2 = (hash, x, y) => {
            const h = hash & 15;
            const u = h < 8 ? x : y;
            const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        };

        return (1 + (1 - v) * ((1 - u) * grad2(p[AA], x, y) + u * grad2(p[BA], x - 1, y)) +
               v * ((1 - u) * grad2(p[AB], x, y - 1) + u * grad2(p[BB], x - 1, y - 1))) * 0.5;
    }

    getFractalNoise(nx, ny, seed) {
        let e = 1.0 * this._simpleNoise(nx, ny, 6, seed)
            + 0.5 * this._simpleNoise(nx, ny, 12, seed + 10)
            + 0.25 * this._simpleNoise(nx, ny, 24, seed + 20)
            + 0.125 * this._simpleNoise(nx, ny, 48, seed + 30);
        return e / 1.875;
    }

    _simpleNoise(nx, ny, freq, seed) {
        const x = nx * freq;
        const y = ny * freq;
        return (Math.sin(x + seed) + Math.cos(y + seed) + Math.sin((x + y) * 1.4 + seed) + Math.cos((x - y) * 1.4 + seed)) / 4 + 0.5;
    }
}
