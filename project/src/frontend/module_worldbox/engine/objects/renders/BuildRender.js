
/**
 * 🏛️ BuildRender
 * 마을 건물의 도트 그래픽 렌더링을 담당합니다.
 */
export const BuildRender = {
    render(ctx, type, t, v, structure, time, engine, overlayOnly = false) {
        ctx.save();

        const actualType = v?.subtype || type;
        const isComplete = !structure || structure.isComplete;
        
        // 💡 [Fix] 청사진 상태(건설 중)일 때도 본체(집 모양 등)를 반투명하게 그리도록 강제
        if (!isComplete && !overlayOnly) {
            this.renderConstructionDust(ctx, t, v, time);
            
            ctx.save();
            ctx.globalAlpha = 0.6; // 청사진 알파
            this._drawBuildingBody(ctx, t, v, actualType, time, false);
            ctx.restore();
            
            this.renderBlueprintInfo(ctx, t, structure);
            ctx.restore();
            return;
        }

        // 완성된 건물의 오버레이(연기 등)만 그리는 경우
        if (overlayOnly) {
            this._drawBuildingBody(ctx, t, v, actualType, time, true);
            ctx.restore();
            return;
        }

        // 일반 렌더링 (완성된 건물)
        this._drawBuildingBody(ctx, t, v, actualType, time, false);
        
        ctx.restore();
    },

    /** 🏗️ 실제 건물 모양을 그리는 내부 메서드 (중복 제거) */
    _drawBuildingBody(ctx, t, v, type, time, overlayOnly) {
        switch (type) {
            case 'bonfire':
            case 'camp':
                this.drawBonfire(ctx, t, v, time, overlayOnly);
                break;
            case 'storage':
            case 'warehouse':
                this.drawStorage(ctx, t, v, time, overlayOnly);
                break;
            case 'house':
            case 'tent':
                this.drawHouse(ctx, t, v, time, overlayOnly);
                break;
            case 'farm':
                this.drawFarm(ctx, t, v, time, overlayOnly);
                break;
            case 'well':
                this.drawWell(ctx, t, v, time, overlayOnly);
                break;
            case 'watchtower':
                this.drawWatchtower(ctx, t, v, time, overlayOnly);
                break;
            case 'blacksmith':
                this.drawBlacksmith(ctx, t, v, time, overlayOnly);
                break;
            case 'temple':
                this.drawTemple(ctx, t, v, time, overlayOnly);
                break;
            case 'fence':
                if (!overlayOnly) this.drawFence(ctx, t, v, time);
                break;
            case 'fence_gate':
                if (!overlayOnly) this.drawGate(ctx, t, v, time);
                break;
            default:
                if (!overlayOnly) this.drawDefaultBuilding(ctx, t, v);
                break;
        }
    },

    /** 🧱 건설 중 먼지 파티클 효과 */
    renderConstructionDust(ctx, t, v, time) {
        const s = v.size || 30;
        const animTime = time * 0.005;
        ctx.fillStyle = 'rgba(210, 180, 140, 0.4)';
        for (let i = 0; i < 4; i++) {
            const pTime = (animTime + i * 0.7) % 2;
            const px = Math.sin(pTime * 5) * (s * 0.6);
            const py = - (pTime * s * 0.4);
            const pSize = 3 + pTime * 5;
            ctx.beginPath();
            ctx.arc(px, py, pSize, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    /** 🔥 모닥불 렌더링 (일렁이는 효과 강화) */
    drawBonfire(ctx, t, v, time = 0, overlayOnly = false) {
        const s = v.size || 25;
        const animTime = time * 0.006;

        if (!overlayOnly) {
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
        }

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
        for (let i = 0; i < 3; i++) {
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
    drawHouse(ctx, t, v, time = 0, overlayOnly = false) {
        const s = v.size || 42;
        const animTime = time * 0.006;

        if (!overlayOnly) {
            // 1. 벽면
            ctx.fillStyle = '#efebe9';
            ctx.strokeStyle = '#d7ccc8';
            ctx.lineWidth = 1.5;
            ctx.fillRect(-s * 0.4, -s * 0.5, s * 0.8, s * 0.5);
            ctx.strokeRect(-s * 0.4, -s * 0.5, s * 0.8, s * 0.5);

            // 2. 굴뚝
            const cx = s * 0.25, cy = -s * 0.8;
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(cx - 3, cy, 6, s * 0.3);

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
        }

        // 연기 파티클 (Dynamic Overlay)
        const cx = s * 0.25, cy = -s * 0.8;
        ctx.fillStyle = 'rgba(150, 150, 150, 0.4)';
        for (let i = 0; i < 3; i++) {
            const pTime = (animTime * 0.3 + i * 0.5) % 2;
            const px = cx + Math.sin(pTime * 3) * 5;
            const py = cy - (pTime * 15);
            const pSize = 4 + pTime * 4;
            ctx.beginPath();
            ctx.arc(px, py, pSize, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    /** 🌾 농장 렌더링 (8x8 고밀도 작물 격자) */
    drawFarm(ctx, t, v, time = 0, overlayOnly = false) {
        const s = v.size || 50;
        const animTime = time * 0.005;

        if (!overlayOnly) {
            // 1. 흙 바닥 및 고랑(Furrows)
            ctx.fillStyle = '#4e342e';
            ctx.fillRect(-s * 0.5, -s * 0.4, s, s * 0.8);

            // 고랑 디테일
            ctx.strokeStyle = '#3e2723';
            ctx.lineWidth = 1;
            for (let i = -3; i <= 3; i++) {
                const fy = i * (s * 0.1);
                ctx.beginPath();
                ctx.moveTo(-s * 0.45, fy); ctx.lineTo(s * 0.45, fy);
                ctx.stroke();
            }

            // 2. 울타리
            ctx.strokeStyle = '#3e2723';
            ctx.lineWidth = 2;
            ctx.strokeRect(-s * 0.52, -s * 0.42, s * 1.04, s * 0.84);
        }

        // 3. 8x8 작물 격자 (64개)
        const rows = 8, cols = 8;
        const stepX = (s * 0.85) / cols;
        const stepY = (s * 0.75) / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const px = -s * 0.4 + c * stepX;
                const py = -s * 0.35 + r * stepY;

                // 개별 작물 흔들림 (랜덤 오프셋 부여)
                const sway = Math.sin(animTime + (r * 0.5) + (c * 0.3)) * 2.0;

                // 작물 색상 (녹색에서 황금색으로 약간의 변이)
                const colorVar = (r + c) % 2 === 0 ? '#4caf50' : '#8bc34a';
                const headColor = (r + c) % 3 === 0 ? '#cddc39' : '#fbc02d';

                ctx.fillStyle = colorVar;
                ctx.fillRect(px + sway * 0.1, py - 4, 1.5, 5);
                ctx.fillStyle = headColor;
                ctx.fillRect(px + sway * 0.2, py - 6, 2, 2.5);
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

    /** 🚧 울타리 렌더링 (Auto-tiling) */
    drawFence(ctx, t, v, time, engine) {
        const s = v.size || 10;
        const sh = engine?.spatialHash;
        const em = engine?.entityManager;

        let mask = 0;
        if (sh && em) {
            const checkDist = 15;
            // North
            const n = sh.query(t.x, t.y - checkDist, 5).some(id => {
                const ent = em.entities.get(id);
                return ent && ent.components.get('Visual')?.subtype === 'fence';
            });
            // East
            const e = sh.query(t.x + checkDist, t.y, 5).some(id => {
                const ent = em.entities.get(id);
                return ent && ent.components.get('Visual')?.subtype === 'fence';
            });
            // South
            const sPos = sh.query(t.x, t.y + checkDist, 5).some(id => {
                const ent = em.entities.get(id);
                return ent && ent.components.get('Visual')?.subtype === 'fence';
            });
            // West
            const w = sh.query(t.x - checkDist, t.y, 5).some(id => {
                const ent = em.entities.get(id);
                return ent && ent.components.get('Visual')?.subtype === 'fence';
            });

            if (n) mask |= 1;
            if (e) mask |= 2;
            if (sPos) mask |= 4;
            if (w) mask |= 8;
        }

        ctx.fillStyle = '#8d6e63';
        ctx.strokeStyle = '#4e342e';
        ctx.lineWidth = 2;

        // 중앙 기둥
        ctx.fillRect(-2, -8, 4, 10);
        ctx.strokeRect(-2, -8, 4, 10);

        // 연결부 그리기
        if (mask & 1) { // North
            ctx.fillRect(-1, -12, 2, 6);
        }
        if (mask & 2) { // East
            ctx.fillRect(0, -6, 8, 2);
            ctx.fillRect(0, -3, 8, 2);
        }
        if (mask & 4) { // South
            ctx.fillRect(-1, 0, 2, 6);
        }
        if (mask & 8) { // West
            ctx.fillRect(-8, -6, 8, 2);
            ctx.fillRect(-8, -3, 8, 2);
        }
    },

    /** 🚪 울타리 문 렌더링 */
    drawGate(ctx, t, v, time, engine) {
        const s = v.size || 12;
        // Entity 찾기 (UISystem 등에서 렌더링 시 id를 알 수 없으므로 근접 검색 활용 가능하나, 
        // 보통 렌더링 시점에 이미 entity가 있으면 좋음. EntityRenderer에서 넘겨받도록 수정 필요)
        // 일단 t(Transform) 주변의 문 엔티티를 찾습니다.
        const em = engine?.entityManager;
        const sh = engine?.spatialHash;
        let doorComp = null;

        if (sh && em) {
            const nearby = sh.query(t.x, t.y, 5);
            for (const id of nearby) {
                const ent = em.entities.get(id);
                if (ent && ent.components.has('Door')) {
                    doorComp = ent.components.get('Door');
                    break;
                }
            }
        }

        const isOpen = doorComp ? doorComp.isOpen : false;

        // 양쪽 기둥
        ctx.fillStyle = '#5d4037';
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 2;
        ctx.fillRect(-8, -10, 4, 12);
        ctx.strokeRect(-8, -10, 4, 12);
        ctx.fillRect(4, -10, 4, 12);
        ctx.strokeRect(4, -10, 4, 12);

        // 문짝
        ctx.fillStyle = '#8d6e63';
        if (isOpen) {
            // 열린 문 (옆으로 비스듬히)
            ctx.save();
            ctx.transform(1, 0.5, 0, 1, 0, 0);
            ctx.fillRect(-4, -8, 8, 6);
            ctx.strokeRect(-4, -8, 8, 6);
            ctx.restore();
        } else {
            // 닫힌 문
            ctx.fillRect(-4, -8, 8, 6);
            ctx.strokeRect(-4, -8, 8, 6);
            // 가로 문양
            ctx.beginPath();
            ctx.moveTo(-4, -5); ctx.lineTo(4, -5);
            ctx.stroke();
        }
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
        ctx.fillRect(bx, by, Math.max(2, barW * progress), barH); 

        // 4. 테두리 (가이드라인)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, by, barW, barH);
        ctx.strokeStyle = '#00e5ff'; // 사이버틱한 청사진 느낌
        ctx.setLineDash([5, 3]); // 점선 효과
        ctx.lineWidth = 1;
        ctx.strokeRect(-15, -15, 30, 30);
        ctx.setLineDash([]); // 다시 실선으로 복구
    },

    /** 💧 우물 (Well) - 물 파동 효과 */
    drawWell(ctx, t, v, time, overlayOnly) {
        const s = v.size || 30;
        if (!overlayOnly) {
            ctx.fillStyle = '#78909c'; // 돌 재질
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#455a64';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 내부 물
            ctx.fillStyle = '#0288d1';
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        // 물 일렁임
        const ripple = Math.sin(time * 0.005) * 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.2 + ripple, 0, Math.PI * 2);
        ctx.stroke();
    },

    /** ⚒️ 대장간 (Blacksmith) - 불꽃 및 연기 */
    drawBlacksmith(ctx, t, v, time, overlayOnly) {
        const s = v.size || 45;
        if (!overlayOnly) {
            ctx.fillStyle = '#4e342e'; // 벽
            ctx.fillRect(-s * 0.4, -s * 0.6, s * 0.8, s * 0.6);
            ctx.fillStyle = '#212121'; // 화로
            ctx.fillRect(-s * 0.3, -s * 0.2, s * 0.2, s * 0.2);
        }
        // 화로 불꽃
        const flicker = Math.sin(time * 0.02) * 2;
        ctx.fillStyle = '#ff5722';
        ctx.beginPath();
        ctx.arc(-s * 0.2, -s * 0.1, 3 + flicker, 0, Math.PI * 2);
        ctx.fill();
    },

    /** 🏛️ 사원 (Temple) - 위엄 있는 건축물 */
    drawTemple(ctx, t, v, time, overlayOnly) {
        const s = v.size || 55;
        if (!overlayOnly) {
            ctx.fillStyle = '#eceff1'; // 대리석
            ctx.beginPath();
            ctx.moveTo(-s * 0.5, 0);
            ctx.lineTo(s * 0.5, 0);
            ctx.lineTo(s * 0.4, -s * 0.8);
            ctx.lineTo(-s * 0.4, -s * 0.8);
            ctx.fill();
            ctx.strokeStyle = '#cfd8dc';
            ctx.stroke();

            // 지붕 금박 느낌
            ctx.fillStyle = '#ffd600';
            ctx.beginPath();
            ctx.moveTo(-s * 0.45, -s * 0.8);
            ctx.lineTo(s * 0.45, -s * 0.8);
            ctx.lineTo(0, -s * 1.1);
            ctx.fill();
        }
    }
}