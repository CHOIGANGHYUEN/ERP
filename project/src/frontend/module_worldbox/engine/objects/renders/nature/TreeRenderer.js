/**
 * 🌳 TreeRenderer — 절차적 나무 및 식생 렌더링 엔진
 * [Expert Design] 기둥 그라데이션, 다층 잎사귀 클러스터, 벚꽃 및 과실수 연출
 */
export const TreeRenderer = {
    draw(ctx, t, v, size, isWithered, time, wind, isXRay = false, entity = null) {
        // 🌲 [FALLING] 쓰러지는 나무 애니메이션
        const res = entity?.components.get('Resource');
        if (res && res.isFalling) {
            const fallAngle = (res.fallProgress || 0) * (Math.PI / 2) * (res.fallDirection || 1);
            ctx.rotate(fallAngle);
            if (res.fallProgress >= 1.0) return;
        }

        const trunkW = Math.max(2, Math.floor(size / 4));
        const trunkH = isWithered ? Math.floor(size * 0.7) : size;
        
        // 1. 나무 기둥 (Trunk with Gradient)
        const trunkGrad = ctx.createLinearGradient(-trunkW/2, 0, trunkW/2, 0);
        const trunkCol = isWithered ? '#3e2723' : '#4e342e';
        trunkGrad.addColorStop(0, this.adjustColor(trunkCol, -20));
        trunkGrad.addColorStop(0.5, trunkCol);
        trunkGrad.addColorStop(1, this.adjustColor(trunkCol, -30));
        
        ctx.fillStyle = trunkGrad;
        ctx.fillRect(-trunkW/2, -trunkH, trunkW, trunkH);
        
        // 뿌리 부분 디테일
        ctx.beginPath();
        ctx.moveTo(-trunkW/2, 0);
        ctx.lineTo(-trunkW/2 - 2, 2);
        ctx.lineTo(trunkW/2 + 2, 2);
        ctx.lineTo(trunkW/2, 0);
        ctx.fill();

        ctx.translate(0, -trunkH);
        const cSize = isWithered ? Math.floor(size * 0.6) : size;
        
        // 2. 나뭇잎 클러스터 (Leaves)
        if (cSize > 0) {
            let leafColor = isWithered ? '#795548' : v.color || '#2e7d32';
            if (v.subtype === 'blossom') leafColor = '#f48fb1'; // 🌸 벚꽃 색상
            
            const colors = [
                this.adjustColor(leafColor, -40), 
                this.adjustColor(leafColor, -15),
                leafColor,
                this.adjustColor(leafColor, 30),
                this.adjustColor(leafColor, 50)
            ];

            const drawCluster = (ox, oy, radius, col, hasDetail = false) => {
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(ox, oy, radius, 0, Math.PI * 2);
                ctx.fill();
                
                if (hasDetail) {
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.beginPath();
                    ctx.arc(ox - radius*0.3, oy - radius*0.3, radius*0.3, 0, Math.PI*2);
                    ctx.fill();
                }
            };

            // 레이어링된 클러스터 배치
            drawCluster(0, -cSize * 0.1, cSize * 0.75, colors[0]);
            drawCluster(-cSize * 0.45, -cSize * 0.25, cSize * 0.5, colors[1]);
            drawCluster(cSize * 0.45, -cSize * 0.25, cSize * 0.5, colors[1]);
            drawCluster(0, -cSize * 0.4, cSize * 0.65, colors[2]);
            drawCluster(-cSize * 0.25, -cSize * 0.55, cSize * 0.45, colors[3], true);
            drawCluster(cSize * 0.2, -cSize * 0.6, cSize * 0.35, colors[4], true);
        }

        // 3. 서브타입 데코레이션
        if (v.subtype === 'fruit' && !isWithered) {
            // 🍎 사과 열매
            ctx.fillStyle = '#ff1744';
            const fruits = [
                {x: -cSize * 0.3, y: -cSize * 0.2},
                {x: cSize * 0.4, y: -cSize * 0.3},
                {x: -cSize * 0.1, y: -cSize * 0.5},
                {x: cSize * 0.2, y: -cSize * 0.1}
            ];
            fruits.forEach(f => {
                ctx.beginPath();
                ctx.arc(f.x, f.y, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fillRect(f.x - 0.5, f.y - 1, 1, 1);
                ctx.fillStyle = '#ff1744';
            });
        } else if (v.subtype === 'blossom' && !isWithered) {
            // 🌸 꽃잎 디테일 (흩날리는 꽃잎 효과는 파티클에서 담당)
            ctx.fillStyle = '#fce4ec';
            for(let i=0; i<6; i++) {
                const bx = (Math.sin(i * 1.2) * cSize * 0.4);
                const by = (Math.cos(i * 1.2) * cSize * 0.3) - cSize * 0.3;
                ctx.beginPath();
                ctx.arc(bx, by, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (v.subtype === 'beehive' && !isWithered) {
            this.drawBeehive(ctx, trunkW, size, isXRay, entity);
        }
    },

    drawBeehive(ctx, trunkW, size, isXRay, entity) {
        const bx = trunkW/2 + 2;
        const by = -size * 0.15;
        const C = { out: '#3e2723', base: '#fbc02d', ring: '#f9a825', high: '#fff176', hole: '#1a0f0d' };

        ctx.fillStyle = C.out;
        ctx.beginPath();
        ctx.ellipse(bx, by, 4, 6, 0, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = C.base;
        ctx.beginPath();
        ctx.ellipse(bx, by, 3.2, 5, 0, 0, Math.PI*2);
        ctx.fill();

        // 고리 무늬
        ctx.strokeStyle = C.ring;
        ctx.lineWidth = 1;
        for(let i=-2; i<=2; i++) {
            ctx.beginPath();
            ctx.moveTo(bx - 3, by + i*1.5);
            ctx.lineTo(bx + 3, by + i*1.5);
            ctx.stroke();
        }

        // 입구
        ctx.fillStyle = C.hole;
        ctx.beginPath();
        ctx.arc(bx, by + 2, 1.5, 0, Math.PI*2);
        ctx.fill();

        if (isXRay && entity) {
            const hive = entity.components.get('Hive');
            if (hive) {
                ctx.save();
                ctx.scale(0.8, 0.8);
                ctx.font = 'bold 10px Inter, Arial';
                ctx.textAlign = 'left';
                const tx = bx + 8;
                const ty = by - 15;
                ctx.fillStyle = '#ffc107'; ctx.fillText(`🍯 ${Math.floor(hive.honey)}/${hive.maxHoney}`, tx, ty);
                ctx.fillStyle = '#ffffff'; ctx.fillText(`🐝 ${hive.beeCount} ${hive.hasQueen?'👑':'💀'}`, tx, ty + 12);
                ctx.restore();
            }
        }
    },

    adjustColor(color, amount) {
        if (!color || typeof color !== 'string' || !color.startsWith('#')) return color;
        const num = parseInt(color.slice(1), 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
        return `#${(g | (r << 8) | (b << 16)).toString(16).padStart(6, '0')}`;
    }
};

