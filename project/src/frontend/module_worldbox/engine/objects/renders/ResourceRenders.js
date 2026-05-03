/**
 * 🌲 ResourceRenders: 월드 내 모든 환경 자원(식물, 광석 등)의 
 * 절차적 도트 그래픽 렌더링 로직을 담당합니다.
 */
export const ResourceRenders = {
    // 🎨 컬러 조절 유틸리티
    adjustColor(color, amount) {
        if (!color || typeof color !== 'string') return '#ffffff';
        // hex color 처리
        if (color.startsWith('#')) {
            return '#' + color.replace(/^#/, '').replace(/../g, color => 
                ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).slice(-2));
        }
        return color;
    },

    /** 🌲 나무 렌더링 (도트 레이어 방식) */
    drawTree(ctx, t, v, size, isWithered, time, wind, entity) {
        const trunkW = Math.max(1, Math.floor(size / 4));
        const trunkH = isWithered ? Math.floor(size * 0.7) : size;
        
        // 🤕 [Hit Shake] 타격 시 흔들림 적용
        const health = entity?.components?.get('Health');
        if (health && health.hitTimer > 0) {
            const shake = Math.sin(time * 0.05) * 2.5 * (health.hitTimer / 0.2);
            ctx.translate(shake, 0);
            ctx.rotate(shake * 0.02);
        }

        ctx.fillStyle = isWithered ? '#3e2723' : '#4e342e';
        ctx.fillRect(-Math.floor(trunkW / 2), -trunkH, trunkW, trunkH);
        
        ctx.translate(0, -trunkH);
        const cSize = isWithered ? Math.floor(size * 0.6) : size;
        
        if (cSize > 0) {
            const leafColor = isWithered ? '#795548' : v.color || '#2e7d32';
            const colors = [
                this.adjustColor(leafColor, -30),
                this.adjustColor(leafColor, -15),
                leafColor,
                this.adjustColor(leafColor, 40)
            ];

            const drawCluster = (ox, oy, radius, col) => {
                ctx.fillStyle = col;
                const step = 0.8;
                for (let ry = -radius; ry <= radius; ry += step) {
                    for (let rx = -radius; rx <= radius; rx += step) {
                        if (rx * rx + ry * ry <= radius * radius) {
                            ctx.fillRect(ox + rx, oy + ry, step, step);
                        }
                    }
                }
            };

            drawCluster(0, -cSize * 0.2, cSize * 0.6, colors[0]);
            drawCluster(-cSize * 0.3, -cSize * 0.1, cSize * 0.4, colors[1]);
            drawCluster(cSize * 0.3, -cSize * 0.1, cSize * 0.4, colors[1]);
            drawCluster(0, -cSize * 0.4, cSize * 0.5, colors[2]);
            if (!isWithered) drawCluster(0, -cSize * 0.6, cSize * 0.3, colors[3]);
        }

        if (v.subtype === 'fruit' && !isWithered) {
            ctx.fillStyle = '#ff1744'; 
            ctx.fillRect(-cSize * 0.2, -cSize * 0.3, 1.5, 1.5); 
            ctx.fillRect(cSize * 0.25, -cSize * 0.15, 1.5, 1.5);
        } else if (v.subtype === 'beehive' && !isWithered) {
            // 🍯 [Masterpiece Beehive] 고퀄리티 벌집 렌더링
            const bx = trunkW/2 + 2;
            const by = -size * 0.4;
            
            // 1. 벌집 몸체 (타원형 레이어)
            ctx.fillStyle = '#fbc02d'; // 메인 노랑
            ctx.beginPath();
            ctx.ellipse(bx, by, 4, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // 2. 가로 줄무늬 (질감 표현)
            ctx.strokeStyle = '#f9a825';
            ctx.lineWidth = 1;
            for(let i=-3; i<=3; i+=2) {
                ctx.beginPath();
                ctx.moveTo(bx - 3, by + i);
                ctx.lineTo(bx + 3, by + i);
                ctx.stroke();
            }
            
            // 3. 입구 (검은 구멍)
            ctx.fillStyle = '#3e2723';
            ctx.beginPath();
            ctx.arc(bx, by + 1, 1.5, 0, Math.PI * 2);
            ctx.fill();
            
            // 4. 꿀 방울 (반짝임)
            ctx.fillStyle = '#fff176';
            ctx.fillRect(bx + 1, by - 2, 1, 1);
        }
    },

    /** 🌿 풀 렌더링 */
    drawGrass(ctx, t, v, isWithered, time, wind, entity) {
        const s = 0.8;
        const color = isWithered ? '#8d6e63' : v.color || '#4caf50';
        const darkColor = this.adjustColor(color, -40);
        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };

        // 🤕 [Hit Shake]
        const health = entity?.components?.get('Health');
        if (health && health.hitTimer > 0) {
            ctx.translate(Math.sin(time * 0.08) * 1.5, 0);
        }

        for (let i = 0; i < 3; i++) {
            const phase = i * 2 + t.x * 0.1;
            const osc = Math.sin(time * 0.006 + phase) * 0.5;
            const sway = isWithered ? 0 : (wv.x * 5 + osc);
            const ox = (i - 1) * 1.2;
            const height = 2 + Math.sin(phase) * 1;
            
            ctx.fillStyle = i === 1 ? color : darkColor;
            ctx.fillRect(ox, -1, s, 1.5);
            ctx.fillRect(ox + (sway * 0.2), -height, s, height - 1);
            ctx.fillRect(ox + (sway * 0.5), -height - 0.5, s, 1);
        }
    },

    /** 🌸 꽃 렌더링 */
    drawFlower(ctx, t, v, isWithered, time, wind, entity) {
        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };
        const osc = Math.sin(time * 0.008 + t.x * 0.2) * 1.0;
        const sway = isWithered ? 0 : (wv.x * 6 + osc);
        
        // 🤕 [Hit Shake]
        const health = entity?.components?.get('Health');
        if (health && health.hitTimer > 0) {
            ctx.translate(Math.sin(time * 0.08) * 1.5, 0);
        }

        ctx.fillStyle = isWithered ? '#5d4037' : '#2e7d32';
        ctx.fillRect(-0.2, -1.5, 0.5, 1.5);
        ctx.fillRect(sway * 0.2 - 0.2, -3.5, 0.5, 2.0);
        
        if (!isWithered) {
            const headX = sway * 0.5;
            const headY = -4.0;
            ctx.fillStyle = v.color || '#ff4081';
            const ps = 1.0;
            ctx.fillRect(headX - ps, headY, ps, ps);
            ctx.fillRect(headX + ps, headY, ps, ps);
            ctx.fillRect(headX, headY - ps, ps, ps);
            ctx.fillRect(headX, headY + ps, ps, ps);
            ctx.fillStyle = '#ffeb3b';
            ctx.fillRect(headX, headY, ps, ps);
        }
    },

    /** 🍄 버섯 렌더링 */
    drawMushroom(ctx, t, v, isWithered, entity, time) {
        const s = 1.0;
        // 🤕 [Hit Shake]
        const health = entity?.components?.get('Health');
        if (health && health.hitTimer > 0) {
            ctx.translate(Math.sin(time * 0.08) * 1.2, 0);
        }

        ctx.fillStyle = isWithered ? '#d7ccc8' : '#ffffff'; 
        ctx.fillRect(-s, 0, s*2, s*1.5);
        ctx.fillStyle = isWithered ? '#8d6e63' : (v.color || '#d32f2f');
        ctx.fillRect(-2*s, -1*s, 4*s, s*1.5);
        ctx.fillRect(-1.5*s, -2*s, 3*s, s);
        if (!isWithered) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-s, -1.2*s, 0.8, 0.8);
            ctx.fillRect(0.5*s, -1.8*s, 0.8, 0.8);
        }
    },

    /** 🌵 선인장 렌더링 */
    drawCactus(ctx, t, v, isWithered, entity, time) {
        const s = 1.2;
        // 🤕 [Hit Shake]
        const health = entity?.components?.get('Health');
        if (health && health.hitTimer > 0) {
            ctx.translate(Math.sin(time * 0.08) * 1.5, 0);
        }

        ctx.fillStyle = isWithered ? '#795548' : '#2e7d32';
        ctx.fillRect(-s, -5*s, s*2, 5*s);
        if (!isWithered) {
            ctx.fillStyle = '#1b5e20';
            ctx.fillRect(-s, -4*s, 0.5, 0.5);
            ctx.fillRect(s-0.5, -2*s, 0.5, 0.5);
            ctx.fillStyle = '#2e7d32';
            ctx.fillRect(-3*s, -3.5*s, 2*s, s); ctx.fillRect(-3*s, -4.5*s, s, s);
            ctx.fillRect(s, -2.5*s, 2*s, s); ctx.fillRect(2*s, -3.5*s, s, s);
        }
    },

    /** 💎 광석/바위 렌더링 */
    drawRock(ctx, t, v, isWithered, entity, time) {
        const s = 1.5;
        // 🤕 [Hit Shake]
        const health = entity?.components?.get('Health');
        if (health && health.hitTimer > 0) {
            ctx.translate(Math.sin(time * 0.1) * 2.0, 0);
        }

        const color = v.color || '#90a4ae';
        const dark = this.adjustColor(color, -30);
        const light = this.adjustColor(color, 30);

        ctx.fillStyle = dark;
        ctx.fillRect(-2*s, -s, 4*s, s*2);
        ctx.fillStyle = color;
        ctx.fillRect(-1.5*s, -2*s, 3*s, s);
        ctx.fillRect(-s, -2.5*s, 2*s, 0.5*s);
        ctx.fillStyle = light;
        ctx.fillRect(-s, -2*s, s, 0.5*s);
        
        if (v.subtype === 'gold') {
            ctx.fillStyle = '#ffd600';
            ctx.fillRect(0, -1.5*s, 1, 1);
            ctx.fillRect(s, -0.5*s, 1, 1);
        } else if (v.subtype === 'iron') {
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(-s, -s, 1, 1);
        }
    },

    /** 🌊 연꽃 렌더링 */
    drawLotus(ctx, t, v, isWithered) {
        const s = 1.0;
        ctx.fillStyle = isWithered ? '#4e342e' : '#2e7d32';
        ctx.fillRect(-3*s, -0.5*s, 6*s, s);
        ctx.fillRect(-2.5*s, -1*s, 5*s, s*2);
        if (!isWithered) {
            ctx.fillStyle = '#f48fb1';
            ctx.fillRect(-s, -2*s, 2*s, s);
            ctx.fillRect(-0.5*s, -2.5*s, s, 0.5*s);
        }
    },

    /** 🐚 뼈/유골 렌더링 */
    drawBones(ctx, t, v) {
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(-2, -1, 4, 2);
        ctx.fillRect(-3, -2, 2, 1); ctx.fillRect(-3, 1, 2, 1);
        ctx.fillRect(1, -2, 2, 1); ctx.fillRect(1, 1, 2, 1);
        ctx.fillStyle = '#bdbdbd';
        ctx.fillRect(0, 0, 1, 1);
    },

    /** 🍓 베리 덤불 렌더링 */
    drawBerries(ctx, t, v, isWithered, entity, time) {
        const s = 1.0;
        // 🤕 [Hit Shake]
        const health = entity?.components?.get('Health');
        if (health && health.hitTimer > 0) {
            ctx.translate(Math.sin(time * 0.08) * 1.5, 0);
        }

        ctx.fillStyle = isWithered ? '#5d4037' : '#1b5e20';
        ctx.fillRect(-2*s, -2*s, 4*s, 2*s);
        ctx.fillRect(-1.5*s, -3*s, 3*s, s);
        if (!isWithered) {
            ctx.fillStyle = '#e53935';
            ctx.fillRect(-s, -1.5*s, 1.2, 1.2);
            ctx.fillRect(0.8*s, -2.2*s, 1.2, 1.2);
        }
    },

    /** 🌊 미역/해초 렌더링 */
    drawKelp(ctx, t, v, time, isWithered) {
        const s = 1.2;
        const osc = Math.sin(time * 0.003 + t.x * 0.5) * 4;
        ctx.fillStyle = isWithered ? '#3e2723' : '#004d40';
        for(let i=0; i<4; i++) {
            const sway = osc * (i/4);
            ctx.fillRect(sway - s/2, -i*3, s, 3.5);
            ctx.fillRect(sway - s*1.5, -i*3 - 1, s, s);
            ctx.fillRect(sway + s*0.5, -i*3 - 2, s, s);
        }
    },

    /** 🌾 갈대 렌더링 */
    drawReed(ctx, t, v, isWithered, time) {
        const s = 0.8;
        const osc = Math.sin(time * 0.005 + t.x * 0.2) * 2;
        ctx.fillStyle = isWithered ? '#5d4037' : '#2e7d32';
        ctx.fillRect(-0.2, -6, 0.5, 6);
        ctx.fillRect(osc*0.5 - 0.2, -12, 0.5, 6);
        ctx.fillStyle = isWithered ? '#3e2723' : '#5d4037';
        ctx.fillRect(osc - 0.8, -14, 1.6, 3);
    },

    /** 💩 배설물 렌더링 */
    drawPoop(ctx, t, v) {
        const s = 1.0;
        // 메인 바디 (진한 갈색)
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(-1.5*s, -1*s, 3*s, s);   // 바닥층
        ctx.fillRect(-1*s, -2*s, 2*s, s);     // 중간층
        ctx.fillRect(-0.5*s, -3*s, 1*s, s);   // 꼭대기
        
        // 디테일 (약간 더 밝은 갈색 하이라이트)
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(-0.5*s, -1.8*s, 0.8, 0.8);
        ctx.fillRect(0.2*s, -1.2*s, 0.8, 0.8);
        
        // 그림자 (가장 진한 갈색)
        ctx.fillStyle = '#26140f';
        ctx.fillRect(-1.2*s, -0.2*s, 2.4*s, 0.4);
    }
};
