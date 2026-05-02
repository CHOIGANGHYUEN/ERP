
/**
 * 🏛️ BuildRender
 * 마을 건물의 도트 그래픽 렌더링을 담당합니다.
 */
export const BuildRender = {
    render(ctx, type, t, v, structure, time) {
        ctx.save();
        
        // 완성된 건물은 기본적으로 불투명하게 처리 (청사진 투명도 해제)
        if (structure && structure.isComplete) {
            ctx.globalAlpha = 1.0;
        }
        // 🧪 [Rendering Trace] 건물 렌더링 요청 추적
        if (v && v.type === 'building') {
            // console.debug(`[BuildRender] Rendering: ${type}, subtype: ${v.subtype}, complete: ${structure?.isComplete}`);
        }

        switch (type) {
            case 'bonfire':
            case 'camp': // 🏕️ 캠프는 모닥불 디자인을 공유
                this.drawBonfire(ctx, t, v, time);
                break;
            case 'storage':
            case 'warehouse':
                this.drawStorage(ctx, t, v, time);
                break;
            case 'house':
            case 'tent':
                this.drawHouse(ctx, t, v, time);
                break;
            case 'farm':
                this.drawFarm(ctx, t, v, time);
                break;
            default:
                if (type !== 'default') {
                    console.warn(`[BuildRender] Unknown building type: ${type}`);
                }
                this.drawDefaultBuilding(ctx, t, v);
        }

        // 🏗️ [Blueprint Visualization] 건설 중인 경우 정보 표시
        if (structure && !structure.isComplete) {
            this.renderBlueprintInfo(ctx, t, structure);
        }
        
        ctx.restore();
    },

    /** 🔥 모닥불 렌더링 (일렁이는 효과 강화) */
    drawBonfire(ctx, t, v, time = 0) {
        const s = v.size || 25;
        // 🚀 [Timing Fix] performance.now() 대응을 위해 0.001 곱하기
        const animTime = time * 0.006;
        
        // 0. 바닥 빛무리 (Glow Effect)
        const glowSize = s * (1.2 + Math.sin(animTime * 1.5) * 0.1);
        const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
        glowGrad.addColorStop(0, 'rgba(255, 152, 0, 0.3)');
        glowGrad.addColorStop(1, 'rgba(255, 152, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, glowSize, glowSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 1. 바닥 돌 (Base Rocks)
        ctx.fillStyle = '#424242';
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const rx = Math.cos(angle) * (s * 0.45);
            const ry = Math.sin(angle) * (s * 0.25);
            ctx.beginPath();
            ctx.rect(rx - 3, ry - 3, 6, 6);
            ctx.fill();
            ctx.stroke();
        }
        
        // 2. 장작 (Crossed Logs)
        ctx.fillStyle = '#5d4037';
        ctx.strokeStyle = '#3e2723';
        ctx.fillRect(-s * 0.35, -2, s * 0.7, 5);
        ctx.strokeRect(-s * 0.35, -2, s * 0.7, 5);
        ctx.fillRect(-2, -s * 0.35, 5, s * 0.7);
        ctx.strokeRect(-2, -s * 0.35, 5, s * 0.7);
        
        // 3. 불꽃 (Multi-layered Dynamic Flames)
        const flameBaseH = s * 0.8;
        const flicker = Math.sin(animTime * 2) * 0.1 + Math.sin(animTime * 0.7) * 0.05;
        const flameH = flameBaseH * (1.0 + flicker);
        
        // Outer Flame
        ctx.fillStyle = '#ff5722';
        this._drawFlameShape(ctx, s * 0.3, flameH);
        // Middle Flame
        ctx.fillStyle = '#ff9800';
        this._drawFlameShape(ctx, s * 0.2, flameH * 0.7);
        // Inner Core
        ctx.fillStyle = '#ffeb3b';
        this._drawFlameShape(ctx, s * 0.1, flameH * 0.4);

        // 4. 불꽃 튀는 효과 (Embers)
        ctx.fillStyle = '#fff176';
        for(let i=0; i<3; i++) {
            const pTime = (animTime * 0.5 + i) % 3;
            const px = Math.sin(pTime * 4) * (s * 0.3);
            const py = - (pTime * 20);
            const pSize = Math.max(0, 2 - pTime);
            ctx.fillRect(px, py, pSize, pSize);
        }
    },

    _drawFlameShape(ctx, width, height) {
        ctx.beginPath();
        ctx.moveTo(-width, 0);
        ctx.bezierCurveTo(-width, -height * 0.5, 0, -height * 1.2, 0, -height);
        ctx.bezierCurveTo(0, -height * 1.2, width, -height * 0.5, width, 0);
        ctx.fill();
    },

    /** 📦 창고 렌더링 (디자인 개선) */
    drawStorage(ctx, t, v, time = 0) {
        const s = v.size || 40;
        
        // 1. 기초 (Stone Foundation)
        ctx.fillStyle = '#757575';
        ctx.fillRect(-s * 0.55, -s * 0.15, s * 1.1, s * 0.15);

        // 2. 몸체 (Timber Frame & Planks)
        ctx.fillStyle = '#8d6e63';
        ctx.strokeStyle = '#4e342e';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-s * 0.5, -s * 0.7, s, s * 0.6);
        ctx.strokeRect(-s * 0.5, -s * 0.7, s, s * 0.6);
        
        // 기둥 (Support Beams)
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(-s * 0.55, -s * 0.75, s * 0.1, s * 0.7);
        ctx.fillRect(s * 0.45, -s * 0.75, s * 0.1, s * 0.7);

        // 3. 지붕 (Thatched/Wooden Roof)
        ctx.fillStyle = '#3e2723';
        ctx.beginPath();
        ctx.moveTo(-s * 0.6, -s * 0.7);
        ctx.lineTo(0, -s * 0.95);
        ctx.lineTo(s * 0.6, -s * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // 4. 화물 (Cargo Details)
        ctx.fillStyle = '#a1887f';
        ctx.fillRect(s * 0.2, -s * 0.2, 8, 8); // 상자
        ctx.fillStyle = '#d7ccc8';
        ctx.beginPath();
        ctx.arc(-s * 0.3, -s * 0.15, 5, 0, Math.PI * 2); // 가마니
        ctx.fill();
    },

    /** 🏠 집 렌더링 (연기 효과 추가) */
    drawHouse(ctx, t, v, time = 0) {
        const s = v.size || 42;
        const animTime = time * 0.006;
        
        // 1. 벽면
        ctx.fillStyle = '#efebe9';
        ctx.strokeStyle = '#d7ccc8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-s * 0.4, -s * 0.5, s * 0.8, s * 0.5);
        ctx.strokeRect(-s * 0.4, -s * 0.5, s * 0.8, s * 0.5);
        
        // 2. 굴뚝 및 연기
        const cx = s * 0.25, cy = -s * 0.8;
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(cx - 3, cy, 6, s * 0.3);
        
        // 연기 파티클
        ctx.fillStyle = 'rgba(150, 150, 150, 0.4)';
        for(let i=0; i<3; i++) {
            const pTime = (animTime * 0.3 + i * 0.5) % 2;
            const px = cx + Math.sin(pTime * 3) * 5;
            const py = cy - (pTime * 15);
            const pSize = 4 + pTime * 4;
            ctx.beginPath();
            ctx.arc(px, py, pSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. 지붕
        ctx.fillStyle = '#b71c1c';
        ctx.strokeStyle = '#7f0000';
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, -s * 0.5);
        ctx.lineTo(0, -s * 0.9);
        ctx.lineTo(s * 0.5, -s * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 4. 문 & 창문
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(-s * 0.1, -s * 0.3, s * 0.2, s * 0.3);
        ctx.fillStyle = '#81d4fa';
        ctx.fillRect(-s * 0.3, -s * 0.35, 6, 6);
        ctx.fillRect(s * 0.2, -s * 0.35, 6, 6);
    },

    /** 🌾 농장 렌더링 */
    drawFarm(ctx, t, v, time = 0) {
        const s = v.size || 50;
        const animTime = time * 0.006;
        
        // 1. 흙 바닥
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(-s * 0.5, -s * 0.4, s, s * 0.8);
        
        // 2. 울타리
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 2;
        ctx.strokeRect(-s * 0.52, -s * 0.42, s * 1.04, s * 0.84);
        
        // 3. 작물 (일렁이는 효과)
        for(let i=0; i<16; i++) {
            const row = Math.floor(i / 4);
            const col = i % 4;
            const px = -s * 0.35 + col * (s * 0.23);
            const py = -s * 0.3 + row * (s * 0.2);
            
            const sway = Math.sin(animTime + i) * 2;
            ctx.fillStyle = '#4caf50';
            ctx.fillRect(px + sway * 0.1, py - 4, 2, 5);
            ctx.fillStyle = '#cddc39';
            ctx.fillRect(px + sway * 0.2, py - 6, 3, 3);
        }
    },

    /** 🏗️ 기본 건물 (Fallback) */
    drawDefaultBuilding(ctx, t, v) {
        const s = v.size || 30;
        ctx.fillStyle = v.color || '#9e9e9e';
        ctx.strokeStyle = '#424242';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-s * 0.5, -s * 0.5, s, s * 0.5);
        ctx.strokeRect(-s * 0.5, -s * 0.5, s, s * 0.5);
    },

    /** 🏗️ 청사진 및 건설 정보 렌더링 */
    renderBlueprintInfo(ctx, t, structure) {
        const type = (structure.type || 'building').toUpperCase();
        const progress = structure.progress / structure.maxProgress;
        
        // 1. 라벨 표시
        ctx.fillStyle = '#ffeb3b';
        ctx.font = 'bold 9px Inter, Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`[PLAN] ${type}`, 0, -25); // Translated origin 기준
        
        // 2. 진행도 바 배경
        const barW = 30;
        const barH = 4;
        const bx = -barW / 2;
        const by = -20;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(bx, by, barW, barH);
        
        // 3. 진행도 바 채우기
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(bx, by, barW * progress, barH);
        
        // 4. 테두리
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, by, barW, barH);
    }
};
