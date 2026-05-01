
/**
 * 🏛️ BuildRender
 * 마을 건물의 도트 그래픽 렌더링을 담당합니다.
 */
export const BuildRender = {
    render(ctx, type, t, v, structure) {
        ctx.save();
        
        switch (type) {
            case 'bonfire':
                this.drawBonfire(ctx, t, v);
                break;
            case 'storage':
            case 'warehouse':
                this.drawStorage(ctx, t, v);
                break;
            case 'house':
            case 'tent':
                this.drawHouse(ctx, t, v);
                break;
            case 'farm':
                this.drawFarm(ctx, t, v);
                break;
            default:
                this.drawDefaultBuilding(ctx, t, v);
        }

        // 🏗️ [Blueprint Visualization] 건설 중인 경우 정보 표시
        if (structure && !structure.isComplete) {
            this.renderBlueprintInfo(ctx, t, structure);
        }
        
        ctx.restore();
    },

    /** 🔥 모닥불 렌더링 */
    drawBonfire(ctx, t, v) {
        const s = v.size || 25;
        
        // 1. 바닥 돌 (Base Rocks)
        ctx.fillStyle = '#616161';
        ctx.strokeStyle = '#424242';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const rx = Math.cos(angle) * (s * 0.45);
            const ry = Math.sin(angle) * (s * 0.25);
            ctx.fillRect(rx - 3, ry - 3, 6, 6);
            ctx.strokeRect(rx - 3, ry - 3, 6, 6);
        }
        
        // 2. 장작 (Premium Logs)
        ctx.fillStyle = '#5d4037';
        ctx.strokeStyle = '#3e2723';
        ctx.fillRect(-s * 0.35, -2, s * 0.7, 5);
        ctx.strokeRect(-s * 0.35, -2, s * 0.7, 5);
        ctx.fillRect(-2, -s * 0.35, 5, s * 0.7);
        ctx.strokeRect(-2, -s * 0.35, 5, s * 0.7);
        
        // 3. 불꽃 (Dynamic & Layered Flames)
        const time = Date.now() * 0.006;
        const flameH = s * (0.6 + Math.sin(time) * 0.15);
        
        // Outer Flame
        const grad = ctx.createLinearGradient(0, 0, 0, -flameH);
        grad.addColorStop(0, '#ff9800');
        grad.addColorStop(0.5, '#f44336');
        grad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-s * 0.25, 0);
        ctx.quadraticCurveTo(0, -flameH * 1.3, s * 0.25, 0);
        ctx.fill();

        // Inner Core
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.moveTo(-s * 0.12, 0);
        ctx.quadraticCurveTo(0, -flameH * 0.8, s * 0.12, 0);
        ctx.fill();
    },

    /** 📦 창고 렌더링 */
    drawStorage(ctx, t, v) {
        const s = v.size || 40;
        
        // 1. 기초 (Foundation)
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(-s * 0.55, -s * 0.1, s * 1.1, s * 0.1);

        // 2. 몸체 (Detailed Planks)
        ctx.fillStyle = '#8d6e63';
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 1;
        ctx.fillRect(-s * 0.5, -s * 0.65, s, s * 0.6);
        ctx.strokeRect(-s * 0.5, -s * 0.65, s, s * 0.6);
        
        // Plank lines
        ctx.beginPath();
        for(let i=-1; i<=1; i++) {
            const px = i * (s * 0.25);
            ctx.moveTo(px, -s * 0.65);
            ctx.lineTo(px, -s * 0.05);
        }
        ctx.stroke();

        // 3. 지붕 (Heavy Timber Roof)
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(-s * 0.6, -s * 0.75, s * 1.2, s * 0.15);
        ctx.strokeRect(-s * 0.6, -s * 0.75, s * 1.2, s * 0.15);
        
        // 4. 문 (Dark Entrance)
        ctx.fillStyle = '#212121';
        ctx.fillRect(-s * 0.15, -s * 0.4, s * 0.3, s * 0.4);
        // Door Handle
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(s * 0.05, -s * 0.22, 2, 2);
    },

    /** 🏠 집/텐트 렌더링 */
    drawHouse(ctx, t, v) {
        const s = v.size || 42;
        
        // 1. 몸체 (Plastered Walls)
        ctx.fillStyle = '#f5f5f5';
        ctx.strokeStyle = '#bdbdbd';
        ctx.lineWidth = 1;
        ctx.fillRect(-s * 0.45, -s * 0.55, s * 0.9, s * 0.55);
        ctx.strokeRect(-s * 0.45, -s * 0.55, s * 0.9, s * 0.55);
        
        // 2. 지붕 (Tiled Roof)
        ctx.fillStyle = '#c62828';
        ctx.strokeStyle = '#8e24aa'; // Subtle decorative trim
        ctx.beginPath();
        ctx.moveTo(-s * 0.6, -s * 0.55);
        ctx.lineTo(0, -s * 1.0);
        ctx.lineTo(s * 0.6, -s * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // 3. 창문 (Glass with Reflection)
        ctx.fillStyle = '#81d4fa';
        ctx.strokeStyle = '#4fc3f7';
        const winS = s * 0.18;
        ctx.fillRect(-s * 0.32, -s * 0.4, winS, winS);
        ctx.strokeRect(-s * 0.32, -s * 0.4, winS, winS);
        ctx.fillRect(s * 0.14, -s * 0.4, winS, winS);
        ctx.strokeRect(s * 0.14, -s * 0.4, winS, winS);
        
        // Window Cross
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-s * 0.32 + winS/2, -s * 0.4); ctx.lineTo(-s * 0.32 + winS/2, -s * 0.4 + winS);
        ctx.moveTo(s * 0.14 + winS/2, -s * 0.4); ctx.lineTo(s * 0.14 + winS/2, -s * 0.4 + winS);
        ctx.stroke();

        // 4. 문 (Wooden Door)
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(-s * 0.12, -s * 0.32, s * 0.24, s * 0.32);
    },

    /** 🌾 농장 렌더링 */
    drawFarm(ctx, t, v) {
        const s = v.size || 50;
        
        // 1. 밭 구획 (Fenced Soil)
        ctx.fillStyle = '#4e342e';
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-s * 0.5, -s * 0.4, s, s * 0.8);
        ctx.strokeRect(-s * 0.5, -s * 0.4, s, s * 0.8);
        
        // 2. 밭 고랑 (Furrows)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 3;
        for (let i = -2; i <= 2; i++) {
            const py = i * (s * 0.15);
            ctx.beginPath();
            ctx.moveTo(-s * 0.45, py);
            ctx.lineTo(s * 0.45, py);
            ctx.stroke();
        }
        
        // 3. 작물 (Lush Crops)
        ctx.fillStyle = '#66bb6a';
        for (let ix = -2; ix <= 2; ix++) {
            for (let iy = -2; iy <= 2; iy++) {
                const ox = ix * (s * 0.18);
                const oy = iy * (s * 0.15);
                ctx.fillRect(ox - 2, oy - 4, 4, 6);
                // Crop head
                ctx.fillStyle = '#ffeb3b';
                ctx.fillRect(ox - 1, oy - 5, 2, 2);
                ctx.fillStyle = '#66bb6a';
            }
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
