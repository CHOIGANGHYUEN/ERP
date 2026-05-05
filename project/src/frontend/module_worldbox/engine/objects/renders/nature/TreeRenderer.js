/**
 * 🌳 TreeRenderer — 절차적 나무 및 식생 렌더링 엔진 (최적화 버전)
 * [Expert Design] 뾰족뾰족한 도트 그래픽 스타일 + 오프스크린 캔버스 캐싱
 */
export const TreeRenderer = {
    _cache: new Map(), // 🚀 [Optimization] 성능 향상을 위한 오프스크린 캔버스 캐시

    draw(ctx, t, v, size, isWithered, time, wind, isXRay = false, entity = null) {
        // 🌲 [FALLING] 쓰러지는 나무 애니메이션 (실시간 연산 필요)
        const res = entity?.components.get('Resource');
        const isFalling = res && res.isFalling;
        
        if (isFalling) {
            const fallAngle = (res.fallProgress || 0) * (Math.PI / 2) * (res.fallDirection || 1);
            ctx.rotate(fallAngle);
            if (res.fallProgress >= 1.0) return;
        }

        // 캐시 키 생성 (모양, 색상, 크기, 시든 상태 조합)
        // 🎨 [Natural Fix] v.color가 없으면 기본 초록색(#2e7d32) 사용
        const leafColor = isWithered ? '#5d4037' : (v.color || '#2e7d32');
        const cacheKey = `${v.subtype || 'normal'}_${size}_${leafColor}_${isWithered}`;
        let cached = this._cache.get(cacheKey);

        if (!cached) {
            cached = this.prerenderTree(v, size, isWithered, leafColor);
            this._cache.set(cacheKey, cached);
        }

        // 🌬️ 바람에 의한 흔들림 (Sway)
        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };
        const sway = isWithered ? 0 : wv.x * (size / 15);
        
        // 🤕 [Hit Shake]
        const health = entity?.components?.get('Health');
        const hitShake = (health && health.hitTimer > 0) ? Math.sin(time * 0.08) * 1.5 : 0;

        // 중앙 정렬하여 그리기
        ctx.drawImage(cached, -cached.width / 2 + sway + hitShake, -cached.height + 2);

        // 🐝 벌집 등 동적 요소는 별도로 그림
        if (v.subtype === 'beehive' && !isWithered) {
            this.drawBeehive(ctx, Math.max(2, size/4), size, isXRay, entity);
        }
    },

    /**
     * 🌲 [Expert Design] 뾰족뾰족한 도트 그래픽 스타일의 나무 프리에디팅
     */
    prerenderTree(v, size, isWithered, leafColor) {
        const canvas = document.createElement('canvas');
        const padding = 4;
        canvas.width = Math.ceil(size * 1.8 + padding * 2);
        canvas.height = Math.ceil(size * 1.5 + padding * 2);
        const pCtx = canvas.getContext('2d');
        
        const centerX = canvas.width / 2;
        const bottomY = canvas.height - padding;
        
        const trunkW = Math.max(2, Math.floor(size / 4));
        const trunkH = Math.floor(size * 0.4);
        
        // 1. 나무 기둥 (Trunk - Pointy Bottom)
        const trunkCol = isWithered ? '#3e2723' : '#4e342e';
        pCtx.fillStyle = trunkCol;
        pCtx.fillRect(centerX - trunkW/2, bottomY - trunkH, trunkW, trunkH);
        
        // 2. 뾰족한 나뭇잎 (Pointy Layers - Pine/Spruce style)
        const layers = isWithered ? 1 : 3;
        const layerH = size * 0.45;
        const layerW = size * 0.9;
        
        for (let i = 0; i < layers; i++) {
            const y = bottomY - trunkH - (i * layerH * 0.5);
            const w = layerW * (1 - i * 0.25);
            const h = layerH;
            
            // 그림자 효과를 위한 색상 조절
            pCtx.fillStyle = this.adjustColor(leafColor, -i * 20);
            
            // 뾰족한 삼각형 레이어 (Polygon for pointy look)
            pCtx.beginPath();
            pCtx.moveTo(centerX, y - h); // 꼭대기
            pCtx.lineTo(centerX - w/2, y); // 왼쪽 아래
            pCtx.lineTo(centerX + w/2, y); // 오른쪽 아래
            pCtx.closePath();
            pCtx.fill();
            
            // 도트 느낌을 위한 하이라이트 (테두리 느낌)
            pCtx.strokeStyle = 'rgba(0,0,0,0.15)';
            pCtx.lineWidth = 0.5;
            pCtx.stroke();
        }

        // 과일 장식
        if (v.subtype === 'fruit' && !isWithered) {
            pCtx.fillStyle = '#ff1744';
            const fPos = [ {x:-3,y:-8}, {x:4,y:-12}, {x:0,y:-18}, {x:-2, y:-14} ];
            fPos.forEach(p => {
                pCtx.fillRect(centerX + p.x, bottomY - trunkH + p.y, 2, 2);
            });
        }

        return canvas;
    },

    drawBeehive(ctx, trunkW, size, isXRay, entity) {
        const bx = trunkW/2 + 2;
        const by = -size * 0.15;
        ctx.fillStyle = '#fbc02d';
        ctx.beginPath();
        ctx.ellipse(bx, by, 3, 4, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#1a0f0d';
        ctx.beginPath();
        ctx.arc(bx, by + 1, 1, 0, Math.PI*2);
        ctx.fill();
    },

    adjustColor(color, amount) {
        if (!color || typeof color !== 'string' || !color.startsWith('#')) return color;
        const hex = color.slice(1);
        const num = parseInt(hex, 16);
        
        let r = (num >> 16) + amount;
        let g = ((num >> 8) & 0x00FF) + amount;
        let b = (num & 0x0000FF) + amount;
        
        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));
        
        return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    }
};
