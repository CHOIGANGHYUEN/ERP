/**
 * 🌳 TreeRenderer
 * 나무의 줄기, 잎사귀, 열매 등을 절차적으로 생성하는 도트 렌더러입니다.
 */
export const TreeRenderer = {
    draw(ctx, t, v, size, isWithered, time, wind, isXRay = false, entity = null) {
        const trunkW = Math.max(1, Math.floor(size / 4));
        const trunkH = isWithered ? Math.floor(size * 0.7) : size;
        
        // 1. 나무 기둥 (Trunk)
        const trunkBaseColor = isWithered ? '#3e2723' : '#4e342e';
        ctx.fillStyle = trunkBaseColor;
        
        ctx.beginPath();
        ctx.moveTo(-trunkW / 2, 0);
        ctx.lineTo(trunkW / 2, 0);
        ctx.lineTo(trunkW / 2, -trunkH);
        ctx.lineTo(-trunkW / 2, -trunkH);
        ctx.closePath();
        ctx.fill();
        
        // 나무껍질 디테일 (Bark Texture)
        if (!isWithered && trunkW >= 2) {
            ctx.fillStyle = '#3d2b1f';
            for (let i = 0; i < trunkH; i += 4) {
                ctx.fillRect(-Math.floor(trunkW / 2), -trunkH + i, 1, 2);
            }
        }
        
        ctx.translate(0, -trunkH); // 기둥 끝점으로 이동
        const cSize = isWithered ? Math.floor(size * 0.6) : size;
        
        // 2. 나뭇잎 클러스터 (Leaves)
        if (cSize > 0) {
            const leafColor = isWithered ? '#795548' : v.color || '#2e7d32';
            const colors = [
                this.adjustColor(leafColor, -45), // Deep shadow
                this.adjustColor(leafColor, -20), // Shadow
                leafColor,                       // Base
                this.adjustColor(leafColor, 35),  // Light
                this.adjustColor(leafColor, 60)   // Highlight
            ];

            const drawCluster = (ox, oy, radius, col, isTop = false) => {
                ctx.fillStyle = col;
                // ⚡ [Optimization] 지옥의 이중 루프 제거 -> 원형 프리미티브로 변경
                ctx.beginPath();
                ctx.arc(ox, oy, radius, 0, Math.PI * 2);
                ctx.fill();
                
                // 질감을 위한 최소한의 디테일 (3~5개 점만 찍기)
                if (!isTop) {
                    ctx.fillStyle = this.adjustColor(col, -20);
                    for(let i=0; i<3; i++) {
                        const rx = (Math.random() - 0.5) * radius;
                        const ry = (Math.random() - 0.5) * radius;
                        ctx.fillRect(ox + rx, oy + ry, 2, 2);
                    }
                }
            };

            drawCluster(0, -cSize * 0.1, cSize * 0.7, colors[0]);
            drawCluster(-cSize * 0.4, -cSize * 0.2, cSize * 0.5, colors[1]);
            drawCluster(cSize * 0.4, -cSize * 0.2, cSize * 0.5, colors[1]);
            drawCluster(0, -cSize * 0.35, cSize * 0.6, colors[2]);
            drawCluster(-cSize * 0.2, -cSize * 0.5, cSize * 0.4, colors[3]);
            if (!isWithered) {
                drawCluster(cSize * 0.1, -cSize * 0.6, cSize * 0.3, colors[4], true);
            }
        }

        // 3. 서브타입 데코레이션 (열매, 벌집)
        if (v.subtype === 'fruit' && !isWithered) {
            ctx.fillStyle = '#ff1744'; 
            ctx.fillRect(-cSize * 0.2, -cSize * 0.3, 1.5, 1.5); 
            ctx.fillRect(cSize * 0.25, -cSize * 0.15, 1.5, 1.5);
        } else if (v.subtype === 'beehive' && !isWithered) {
            // 🍯 [Masterpiece Beehive] 벌집 렌더링
            const bx = trunkW/2 + 3;
            const by = -size * 0.1; // 위치 조정
            
            const dot = (x, y, w, h, c) => {
                ctx.fillStyle = c;
                ctx.fillRect(bx + x, by + y, w, h);
            };

            const C = {
                out: '#3e2723', base: '#fbc02d', ring: '#f9a825', 
                high: '#fff176', hole: '#1a0f0d'
            };

            dot(-3, -4, 6, 9, C.out);   dot(-2.5, -4.5, 5, 10, C.out); 
            dot(-2, -4, 4, 9, C.base);  dot(-2.5, -3, 5, 7, C.base);
            dot(-2.5, -2, 5, 1, C.ring); dot(-2.5, 1, 5, 1, C.ring); dot(-2, 3, 4, 1, C.ring);
            dot(-1.5, -4, 3, 1, C.high); dot(-0.5, -4.5, 1, 1, C.high);
            dot(-1, 1.5, 2, 2.5, C.hole); dot(-1.5, 2.5, 3, 1.5, C.hole);

            // 🚀 [X-RAY View] 벌집 상태 텍스트 오버레이
            if (isXRay && entity) {
                const hive = entity.components.get('Hive');
                if (hive) {
                    ctx.save();
                    ctx.scale(0.8, 0.8);
                    ctx.font = 'bold 10px Inter, Arial';
                    ctx.textAlign = 'left';
                    
                    const tx = bx + 8;
                    const ty = by - 15;
                    
                    // 꿀 양
                    ctx.fillStyle = '#ffc107';
                    ctx.fillText(`🍯 ${Math.floor(hive.honey)}/${hive.maxHoney}`, tx, ty);
                    
                    // 벌 마릿수 (여왕벌 포함)
                    ctx.fillStyle = '#ffffff';
                    const queenStr = hive.hasQueen ? '👑' : '💀';
                    ctx.fillText(`🐝 ${hive.beeCount} ${queenStr}`, tx, ty + 12);
                    
                    // 애벌레 수
                    ctx.fillStyle = '#eeeeee';
                    ctx.fillText(`🐛 ${hive.larvaCount}`, tx, ty + 24);
                    
                    ctx.restore();
                }
            }
        }
    },

    adjustColor(color, amount) {
        if (!color || typeof color !== 'string') return '#ffffff';
        if (color.startsWith('#')) {
            return '#' + color.replace(/^#/, '').replace(/../g, color => 
                ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).slice(-2));
        }
        return color;
    }
};
