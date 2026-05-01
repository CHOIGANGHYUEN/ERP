/**
 * 🌳 TreeRenderer
 * 나무의 줄기, 잎사귀, 열매 등을 절차적으로 생성하는 도트 렌더러입니다.
 */
export const TreeRenderer = {
    draw(ctx, t, v, size, isWithered, time, wind) {
        const trunkW = Math.max(1, Math.floor(size / 4));
        const trunkH = isWithered ? Math.floor(size * 0.7) : size;
        
        // 1. 나무 기둥 (Trunk) - 캐싱을 위해 똑바로 그림 (휘어짐은 외부에서 처리)
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
        
        // 2. 나뭇잎 클러스터 (Leaves) - 바람에 따라 더 많이 흔들림
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
                const step = 0.8;
                for (let ry = -radius; ry <= radius; ry += step) {
                    for (let rx = -radius; rx <= radius; rx += step) {
                        if (rx * rx + ry * ry <= radius * radius) {
                            if (Math.random() > 0.1 || isTop) {
                                ctx.fillRect(ox + rx, oy + ry, step, step);
                            }
                        }
                    }
                }
            };

            // 5단계 레이어드 렌더링 (하단 그림자부터 최상단 하이라이트까지)
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
            ctx.fillStyle = '#fbc02d';
            ctx.fillRect(trunkW/2, -size * 0.2, 3, 4);
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
