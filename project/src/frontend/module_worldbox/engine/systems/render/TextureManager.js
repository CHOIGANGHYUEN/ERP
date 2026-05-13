/**
 * 🎨 TextureManager
 * 고해상도 텍스처 및 스프라이트를 관리하는 시스템입니다.
 * 캔버스 기반 절차적 생성(Procedural Generation)을 통해
 * 고품질 에셋을 캐싱하여 렌더링 성능을 극대화합니다.
 */
export default class TextureManager {
    constructor() {
        this.cache = new Map();
        
        // 🚀 [Expert Optimization] Draw Call Batching Queue
        // Texture Key -> [{ x, y, w, h, flipX, alpha, rotation, ... }]
        this.drawQueue = new Map(); 
        
        this._initProceduralAssets();
    }

    /**
     * 캐시된 스프라이트를 가져옵니다. 없으면 생성 후 반환합니다.
     */
    getTexture(key) {
        if (!this.cache.has(key)) {
            const generator = this._getProceduralGenerator(key);
            if (generator) {
                this.cache.set(key, generator());
            } else {
                this.cache.set(key, this._generateFallbackSprite());
            }
        }
        return this.cache.get(key);
    }

    /**
     * 📥 [Expert Design] 외부에서 생성된 텍스처를 수동으로 등록
     */
    setTexture(key, canvas) {
        this.cache.set(key, canvas);
    }

    /**
     * 📦 [Expert Optimization] 배칭 큐에 그리기 명령 추가
     * key: TextureManager의 캐시 키 또는 직접적인 Canvas/Image 객체
     */
    enqueueDraw(key, x, y, w, h, options = {}) {
        let actualKey = key;
        
        // 직접적인 객체가 들어온 경우, 임시 키를 생성하여 배칭 지원
        if (typeof key !== 'string') {
            if (!key.__batchKey) {
                key.__batchKey = `ext_${Math.random().toString(36).substr(2, 9)}`;
                this.setTexture(key.__batchKey, key);
            }
            actualKey = key.__batchKey;
        }

        if (!this.drawQueue.has(actualKey)) {
            this.drawQueue.set(actualKey, []);
        }
        this.drawQueue.get(actualKey).push({ x, y, w, h, options });
    }

    /**
     * 🚀 [Expert Optimization] 동일 텍스처를 사용하는 명령들을 한 번에 실행
     */
    flush(ctx) {
        if (this.drawQueue.size === 0) return;

        for (const [key, batch] of this.drawQueue) {
            if (batch.length === 0) continue;

            const texture = this.getTexture(key);
            if (!texture) {
                batch.length = 0;
                continue;
            }

            for (let i = 0; i < batch.length; i++) {
                const item = batch[i];
                const { x, y, w, h, options } = item;
                
                const alpha = options.alpha !== undefined ? options.alpha : 1.0;
                const flipX = options.flipX || false;
                const rotation = options.rotation || 0;
                
                // 🎯 [Expert Design] Pivot 지원 (0.5가 중앙, 1.0이 끝)
                const pivotX = options.pivotX !== undefined ? options.pivotX : 0.5;
                const pivotY = options.pivotY !== undefined ? options.pivotY : 0.5;

                const hasTransform = flipX || rotation !== 0;

                if (alpha < 1.0) ctx.globalAlpha = alpha;

                if (hasTransform) {
                    ctx.save();
                    ctx.translate(x, y);
                    if (flipX) ctx.scale(-1, 1);
                    if (rotation !== 0) ctx.rotate(rotation);
                    // 피벗 적용하여 그리기
                    ctx.drawImage(texture, -w * pivotX, -h * pivotY, w, h);
                    ctx.restore();
                } else {
                    // 단순 렌더링도 피벗 적용
                    ctx.drawImage(texture, x - (w * pivotX), y - (h * pivotY), w, h);
                }

                if (alpha < 1.0) ctx.globalAlpha = 1.0;
            }

            // 큐 비우기 (배열 인스턴스 재사용)
            batch.length = 0;
        }
    }

    // ==========================================
    // 🖌️ Procedural High-Res Asset Generators
    // ==========================================

    _initProceduralAssets() {
        // 초기 필수 에셋 웜업(Warm-up)
        this.cache.set('tree_pine', this._generatePineTree());
        this.cache.set('tree_oak', this._generateOakTree());
        this.cache.set('tree_dead', this._generateDeadTree());
        this.cache.set('rock_base', this._generateRock());
        this.cache.set('gold_ore', this._generateOre('#fbc02d'));
        this.cache.set('iron_ore', this._generateOre('#9e9e9e'));
        this.cache.set('stone', this._generateRock()); // alias
        this.cache.set('coal_ore', this._generateOre('#212121'));
        this.cache.set('copper_ore', this._generateOre('#ffb300'));
        this.cache.set('silver_ore', this._generateOre('#cfd8dc'));
        
        // Terrain patterns (for tiling)
        this.cache.set('pattern_grass', this._generateTerrainPattern('#4caf50', '#388e3c'));
        this.cache.set('pattern_sand', this._generateTerrainPattern('#ffe082', '#ffca28'));
        this.cache.set('pattern_water', this._generateWaterPattern());

        // 🌑 Common Shadow Sprite
        this.cache.set('common_shadow', this._generateShadowSprite());
    }

    _generateShadowSprite() {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(16, 16, 2, 16, 16, 14);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
        return canvas;
    }

    _getProceduralGenerator(key) {
        const generators = {
            'tree_pine': () => this._generatePineTree(),
            'tree_oak': () => this._generateOakTree(),
            'tree_dead': () => this._generateDeadTree(),
            'rock_base': () => this._generateRock(),
            'stone': () => this._generateRock(),
            'gold_ore': () => this._generateOre('#fbc02d'),
            'iron_ore': () => this._generateOre('#9e9e9e'),
            'coal_ore': () => this._generateOre('#212121'),
            'copper_ore': () => this._generateOre('#ffb300'),
            'silver_ore': () => this._generateOre('#cfd8dc'),
            'pattern_grass': () => this._generateTerrainPattern('#4caf50', '#388e3c'),
            'pattern_sand': () => this._generateTerrainPattern('#ffe082', '#ffca28'),
            'pattern_water': () => this._generateWaterPattern()
        };
        return generators[key];
    }

    _generateFallbackSprite() {
        const canvas = document.createElement('canvas');
        canvas.width = 16; canvas.height = 16;
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#ff00ff'; // 마젠타
        ctx.fillRect(0, 0, 16, 16);
        return canvas;
    }

    _generatePineTree() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d', { alpha: true });
        
        // 🌑 Shadow (Pixelated)
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(20, 56, 24, 6);
        ctx.fillRect(24, 54, 16, 10);

        // 🪵 Trunk (Detailed Dot)
        ctx.fillStyle = '#3e2723'; // Darkest
        ctx.fillRect(28, 40, 8, 20);
        ctx.fillStyle = '#5d4037'; // Mid
        ctx.fillRect(30, 40, 4, 20);
        ctx.fillStyle = '#795548'; // Highlight
        ctx.fillRect(31, 40, 1, 15);

        // 🌲 Foliage (Layered V-Shapes with Dot Texture)
        const colors = ['#1b5e20', '#2e7d32', '#388e3c', '#4caf50'];
        
        // Bottom layer
        this._drawPixelV(ctx, 32, 45, 26, 22, colors[0]);
        this._drawPixelV(ctx, 32, 43, 24, 20, colors[1]);
        
        // Middle layer
        this._drawPixelV(ctx, 32, 32, 22, 18, colors[0]);
        this._drawPixelV(ctx, 32, 30, 20, 16, colors[1]);
        
        // Top layer
        this._drawPixelV(ctx, 32, 20, 16, 14, colors[1]);
        this._drawPixelV(ctx, 32, 18, 14, 12, colors[2]);
        
        // Tip
        this._drawPixelV(ctx, 32, 8, 8, 10, colors[3]);

        // ✨ Highlights & Texture (Dots)
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        for(let i=0; i<40; i++) {
            const rx = 32 + (Math.random()-0.5) * 30;
            const ry = 10 + Math.random() * 40;
            ctx.fillRect(Math.floor(rx), Math.floor(ry), 2, 2);
        }

        return canvas;
    }

    _generateOakTree() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d', { alpha: true });
        
        // 🌑 Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(32, 58, 18, 7, 0, 0, Math.PI * 2); ctx.fill();

        // 🪵 Trunk (Rugged Dot style)
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(28, 50, 8, 10);
        ctx.fillRect(26, 32, 12, 20);
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(30, 32, 4, 28);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(32, 35, 1, 20);
        
        // Add some trunk "knots" (Dots)
        ctx.fillStyle = '#26140f';
        ctx.fillRect(29, 40, 2, 2);
        ctx.fillRect(35, 48, 2, 2);

        // 🌳 Foliage (Clustered Bubbles with Shading)
        const drawLeafCluster = (x, y, r, baseColor) => {
            ctx.fillStyle = baseColor;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
            // Inner Dot Shading
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath(); ctx.arc(x+r*0.2, y+r*0.2, r*0.8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath(); ctx.arc(x-r*0.3, y-r*0.3, r*0.5, 0, Math.PI*2); ctx.fill();
        };

        drawLeafCluster(32, 25, 22, '#1b5e20');
        drawLeafCluster(20, 32, 16, '#2e7d32');
        drawLeafCluster(44, 32, 16, '#2e7d32');
        drawLeafCluster(32, 15, 18, '#388e3c');
        drawLeafCluster(25, 18, 12, '#4caf50');
        drawLeafCluster(40, 20, 10, '#4caf50');

        // 🍃 Random Pixel Dots for "High-Res Dot" feel
        ctx.fillStyle = '#81c784';
        for(let i=0; i<60; i++) {
            const rx = 15 + Math.random() * 34;
            const ry = 10 + Math.random() * 30;
            if (ctx.isPointInPath(rx, ry)) { // Only inside foliage
                ctx.fillRect(Math.floor(rx), Math.floor(ry), 2, 2);
            }
        }

        return canvas;
    }

    _generateDeadTree() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d', { alpha: true });
        
        // 🌑 Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(24, 58, 16, 4);

        // 🪵 Dead Trunk (Jagged Dot style)
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(30, 50, 4, 10);
        ctx.fillRect(31, 20, 2, 30);
        
        // Branches
        ctx.fillStyle = '#4e342e';
        const drawBranch = (x, y, w, h, angle) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        };

        drawBranch(32, 45, 12, 2, -Math.PI/4);
        drawBranch(32, 35, 15, 2, Math.PI/6);
        drawBranch(22, 35, 10, 2, -Math.PI/3);
        drawBranch(40, 25, 8, 2, Math.PI/4);

        return canvas;
    }

    _generateRock() {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d', { alpha: true });
        
        // 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(16, 26, 12, 6, 0, 0, Math.PI * 2); ctx.fill();

        // 바위 형상
        ctx.fillStyle = '#757575';
        ctx.beginPath();
        ctx.moveTo(8, 24);
        ctx.lineTo(6, 16);
        ctx.lineTo(12, 8);
        ctx.lineTo(22, 10);
        ctx.lineTo(26, 20);
        ctx.lineTo(22, 26);
        ctx.closePath();
        ctx.fill();

        // 하이라이트 (입체감)
        ctx.fillStyle = '#9e9e9e';
        ctx.beginPath();
        ctx.moveTo(8, 24);
        ctx.lineTo(6, 16);
        ctx.lineTo(12, 8);
        ctx.lineTo(20, 16);
        ctx.closePath();
        ctx.fill();

        // 엣지 디테일
        ctx.strokeStyle = '#616161';
        ctx.lineWidth = 1;
        ctx.stroke();

        return canvas;
    }

    _generateOre(color) {
        const canvas = this._generateRock();
        const ctx = canvas.getContext('2d', { alpha: true });
        
        // 광물 결정 추가
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(12, 18); ctx.lineTo(16, 12); ctx.lineTo(20, 16); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(18, 22); ctx.lineTo(22, 16); ctx.lineTo(26, 20); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(8, 16); ctx.lineTo(12, 10); ctx.lineTo(14, 14); ctx.closePath(); ctx.fill();

        // 반짝임
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(15, 14, 2, 2);
        ctx.fillRect(21, 18, 2, 2);

        return canvas;
    }

    _generateTerrainPattern(baseColor, accentColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d', { alpha: false });
        
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, 64, 64);
        
        ctx.fillStyle = accentColor;
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * 64;
            const y = Math.random() * 64;
            const w = 2 + Math.random() * 4;
            const h = 1 + Math.random() * 2;
            ctx.fillRect(x, y, w, h);
        }
        
        return canvas;
    }

    _generateWaterPattern() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d', { alpha: false });
        
        ctx.fillStyle = '#1976d2';
        ctx.fillRect(0, 0, 64, 64);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * 64;
            const y = Math.random() * 64;
            const w = 4 + Math.random() * 8;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + w, y);
            ctx.stroke();
        }
        
        return canvas;
    }

    // --- Utils ---
    _drawTriangle(ctx, cx, topY, width, height) {
        ctx.beginPath();
        ctx.moveTo(cx, topY);
        ctx.lineTo(cx - width, topY + height);
        ctx.lineTo(cx + width, topY + height);
        ctx.closePath();
        ctx.fill();
    }

    _drawCircle(ctx, cx, cy, radius) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    /** 🌲 V-Shape for Pine (Pixel Art style) */
    _drawPixelV(ctx, cx, cy, w, h, color) {
        ctx.fillStyle = color;
        // Main triangle but with blocky steps
        const steps = 4;
        for(let i=0; i<steps; i++) {
            const stepW = (w / steps) * (i + 1);
            const stepH = h / steps;
            ctx.fillRect(cx - stepW, cy + (stepH * i), stepW * 2, stepH);
        }
        
        // Add "Pixel Jagged" shadows
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(cx - w, cy + h - 2, w * 2, 2);
        ctx.fillRect(cx - w + 4, cy + h - 4, (w - 4) * 2, 2);
    }
}

export const textureManager = new TextureManager();
