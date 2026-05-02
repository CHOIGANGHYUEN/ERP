/**
 * 👤 HumanRenderer — True 8-Directional & Natural Time-Based Motion
 * facing: 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
 * flipX (SW, W, NW) is handled by KinematicSystem -> maps to SE, E, NE visually.
 * This script explicitly draws the 5 unique visual profiles:
 * S (Front), N (Back), E (Side), SE (FrontSide), NE (BackSide)
 */
export const HumanRenderer = {
    draw(ctx, time, s, mode, entity) {
        const t = time * 0.001;

        const aiState    = entity?.components.get('AIState');
        const visual     = entity?.components.get('Visual');
        const inventory  = entity?.components.get('Inventory');
        const animal     = entity?.components.get('Animal');
        const metabolism = entity?.components.get('Metabolism');

        // ── 1. 방향 프로필 매핑 (8방향 → 5개 시각 고유 상태) ────────────
        const rawFacing = visual?.facing ?? 2;
        let vf = rawFacing;
        // flipX가 적용되므로 좌측을 바라보는 상태(3,4,5)는 우측(1,0,7) 로직 재사용
        if (rawFacing === 3) vf = 1; // SW -> SE
        if (rawFacing === 4) vf = 0; // W -> E
        if (rawFacing === 5) vf = 7; // NW -> NE

        const isFront = vf === 2;
        const isBack  = vf === 6;
        const isSide  = vf === 0;
        const isFrontSide = vf === 1;
        const isBackSide  = vf === 7;

        // ── 2. 모션 및 애니메이션 상태 ────────────────────────────────
        const isRunning   = mode === 'run';
        const isFleeing   = mode === 'flee';
        const isWalking   = mode === 'wander';
        const isMovingFast = isRunning || isFleeing;
        const isMoving    = isWalking || isMovingFast
                         || mode === 'deposit' || mode === 'forage'
                         || mode === 'gather_wood' || mode === 'build';
        
        const isSleeping  = mode === 'sleep';
        const isEating    = mode === 'eat';
        const isForaging  = mode === 'forage';
        const isDead      = mode === 'die';
        const isChopping  = mode === 'gather_wood' && aiState?.isChopping;
        const isBuilding  = mode === 'build';
        const isDepositing = mode === 'deposit';
        const isBerserk   = mode === 'berserk';
        const isHunting   = mode === 'hunt';

        const chopPhase = isChopping ? Math.min(1, (aiState.chopTimer || 0) / 0.4) : 0;
        const carryingWood = (inventory?.items?.wood || 0) > 0;
        const carryingFood = (inventory?.items?.food || 0) > 0;
        const isCarrying   = (inventory?.getTotal() || 0) > 0;

        const gender = animal?.gender || 'male';
        const isMale = gender === 'male';
        const isBaby = visual?.isBaby || false;
        const isStarving = (metabolism?.hunger ?? 100) < 20;

        // ── 3. 팔레트 설정 ────────────────────────────────────────────
        const C = isMale ? {
            skin:'#e0ac69', skin_dark:'#c68642',
            shirt: isBerserk ? '#c62828' : '#1e88e5', shirt_l: isBerserk ? '#ef9a9a' : '#64b5f6', shirt_d: isBerserk ? '#7f0000' : '#1565c0',
            pants:'#263238', hair:'#3e2723', eye:'#212121', shoe:'#212121', acc:'#ffeb3b',
        } : {
            skin:'#ffdbac', skin_dark:'#f1c27d',
            shirt:'#ec407a', shirt_l:'#f48fb1', shirt_d:'#ad1457',
            pants:'#37474f', hair:'#4e342e', eye:'#212121', shoe:'#212121', acc:'#9c27b0',
        };
        if (isStarving) { C.skin = isMale ? '#c8956a' : '#e8c49c'; }

        // ── 4. 그리기 헬퍼 ────────────────────────────────────────────
        const dot = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.round(x*s), Math.round(y*s), Math.max(1,Math.round(w*s)), Math.max(1,Math.round(h*s)));
        };
        const line = (x1, y1, x2, y2, color, lw=1) => {
            ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, lw*s);
            ctx.beginPath(); ctx.moveTo(x1*s, y1*s); ctx.lineTo(x2*s, y2*s); ctx.stroke();
        };

        // ── 5. 수면/사망 예외 처리 (옆으로 눕기) ──────────────────────
        if (isSleeping || isDead) {
            ctx.save(); ctx.rotate(Math.PI/2); ctx.translate(0, -4*s);
            const col = isDead ? '#888' : C.shirt;
            dot(-2.4,-8.5,4.8,5.5,col); dot(-2.4,-3.5,4.8,0.8,C.shirt_d);
            dot(-1.8,-3.5,1.8,4.3,C.pants); dot(0.2,-3.5,1.8,4.3,C.pants);
            dot(-1.8,0.8,1.8,0.8,C.shoe); dot(0.2,0.8,1.8,0.8,C.shoe);
            dot(-3.8,-8,1.8,4.5,C.shirt_d); dot(2.0,-8,1.8,4.5,col);
            ctx.save(); ctx.translate(0,-12.5*s);
            dot(-2,0,4,4,isDead?'#ccc':C.skin); 
            if (isMale) { dot(-2.2,-1.5,4.4,2.5,C.hair); dot(-2.2,0,0.8,2.5,C.hair); dot(1.4,0,0.8,2.5,C.hair); } 
            else { dot(-2.5,-1.8,5.0,2.8,C.hair); dot(-2.5,0,1.2,5.5,C.hair); dot(1.3,0,1.2,5.5,C.hair); }
            dot(-1.4,2.2,1.0,0.5,C.eye); dot(0.4,2.2,1.0,0.5,C.eye);
            if (isSleeping) { ctx.fillStyle='rgba(100,180,255,0.85)'; ctx.font=`bold ${5*s}px sans-serif`; ctx.fillText('z',3*s,-2*s); }
            ctx.restore();
            ctx.restore(); return;
        }

        // ── 6. 보행 사이클 (Walk/Run 진자 운동) ───────────────────────
        const stepFreq = isMovingFast ? 4.5 : isMoving ? 2.8 : 1.0;
        const step = t * stepFreq;
        const legSin  = Math.sin(step);          
        const armSin  = Math.sin(step + Math.PI); 
        const headBob = isMoving ? Math.sin(step * 2) * (isMovingFast ? 0.9 : 0.5) : 0;
        const stride  = isMovingFast ? 5.5 : isMoving ? 3.5 : 0;
        const armAmp  = isMovingFast ? 6.5 : isMoving ? 4.0 : 0;
        const breath  = !isMoving ? Math.sin(t * 1.0) * 0.6 : 0;

        ctx.save();
        
        // 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.13)';
        ctx.beginPath();
        ctx.ellipse(0, Math.round(0.8*s), 3.5*s, s, 0, 0, Math.PI*2);
        ctx.fill();

        // 전신 바운스 및 기울기
        if (!isMoving) ctx.translate(0, breath * s);
        if (isMovingFast) ctx.rotate(0.14);
        else if (isDepositing) ctx.rotate(0.08);

        // ── 7. 관절 좌표 계산 (방향별 3D 투영) ───────────────────────
        
        // [다리] 
        // 좌측 다리(Far Leg)는 뒤쪽, 우측 다리(Near Leg)는 앞쪽
        let lx = -2.2, ly = 0, rx = 0.4, ry = 0;
        if (isBuilding) {
            lx = -2.8; ly = 0; rx = 1.0; ry = 0; // 안정적인 스탠스
        } else if (isFront || isBack) {
            lx = -2.2; ly = -legSin * stride * 0.4;
            rx =  0.4; ry =  legSin * stride * 0.4;
        } else if (isSide) {
            lx = -1.0 + legSin * stride; ly = 0;
            rx = -1.0 - legSin * stride; ry = 0;
        } else { // FrontSide, BackSide
            lx = -1.5 + legSin * stride * 0.7; ly = -legSin * stride * 0.3;
            rx =  0.5 - legSin * stride * 0.7; ry =  legSin * stride * 0.3;
        }

        // [팔] 기본 보행
        let lax = -3.8, lay = 0, rax = 2.0, ray = 0;
        if (isFront || isBack) {
            lax = -3.8; lay = -armSin * armAmp * 0.3;
            rax =  2.0; ray =  armSin * armAmp * 0.3;
        } else if (isSide) {
            lax = -1.0 + armSin * armAmp; lay = 0;
            rax = -1.0 - armSin * armAmp; ray = 0;
        } else { // FrontSide, BackSide
            lax = -2.5 + armSin * armAmp * 0.7; lay = -armSin * armAmp * 0.3;
            rax =  1.0 - armSin * armAmp * 0.7; ray =  armSin * armAmp * 0.3;
        }

        // [팔] 특수 상태 오버라이드
        if (isChopping) {
            rax = 1.0 + chopPhase * 1.5; ray = -4.0 + chopPhase * 8; 
            lax = -2.5; lay = 2.0; 
        } else if (isBuilding) {
            const hp = (Math.sin(t*5.0)+1)/2;
            rax = 1.5; ray = -4.0 + hp * 7;
            lax = -2.5; lay = 2.0;
        } else if (isEating || isForaging) {
            const eo = Math.abs(Math.sin(t*3.5));
            rax = 1.0; ray = -2.0 + eo * 2.5;
            lax = -1.5; lay = -2.0 + eo * 2.5;
        } else if (isBerserk) {
            const sh = Math.sin(t*18)*1.2, shb = Math.sin(t*23+1.1)*1.0;
            rax = 2.0 - sh; ray = -3.0 - shb;
            lax = -4.5 + sh; lay = -3.0 + shb;
        } else if (isHunting) {
            const tp = (Math.sin(t*4.0)+1)/2;
            rax = 2.0 + tp * 2.5; ray = -2.0;
            lax = -3.0; lay = -1.0;
        } else if (isFleeing) {
            const fl = Math.sin(t*5.5);
            rax = 2.0 + fl * 1.5; ray = -1.5;
            lax = -4.5 - fl * 1.5; lay = -2.5;
        } else if (isDepositing) {
            rax = 2.0 - armSin * armAmp * 0.3; ray = -1.5;
            lax = -3.8 + armSin * armAmp * 0.3; lay = -1.5;
        }

        // [몸통] 방향에 따른 원근 투영 (너비 변화)
        let tW = 4.8, tX = -2.4;
        if (isSide) { tW = 3.0; tX = -1.5; }
        else if (isFrontSide || isBackSide) { tW = 4.0; tX = -2.0; }

        // ── 8. 파트별 그리기 함수 ──────────────────────────────────────
        const drawLeg = (ox, oy, isNear) => {
            const col = isNear ? C.pants : '#1a272d'; // 멀리 있는 다리는 어둡게
            dot(ox, -3.5 + oy, 1.8, 4.3, col);
            dot(ox,  0.8 + oy, 1.8, 0.8, C.shoe);
        };

        const drawArm = (ox, oy, isNear) => {
            const col = isNear ? C.shirt : C.shirt_d; // 멀리 있는 팔은 어둡게
            dot(ox, -8.0 + oy, 1.8, 2.5, col);
            dot(ox, -5.5 + oy, 1.8, 2.0, C.skin);
            
            // 무기/도구는 Right Hand(isNear)에 렌더링
            if (isNear) {
                const hx = ox + 0.5, hy = -3.5 + oy;
                if (isChopping) {
                    dot(hx, hy, 1, 4, '#5d4037'); 
                    ctx.fillStyle='#9e9e9e'; ctx.fillRect(Math.round(hx*s)-3, Math.round(hy*s)-1, 5, 3);
                } else if (isBuilding) {
                    dot(hx, hy, 1, 3.5, '#8d6e63');
                    ctx.fillStyle='#9e9e9e'; ctx.fillRect(Math.round(hx*s)-3, Math.round(hy*s), 6, 3);
                } else if (isHunting) {
                    const tipX = hx + 5.0; 
                    line(hx-1, hy+1, tipX, hy-6, '#5d4037', 1.5);
                    ctx.fillStyle='#9e9e9e';
                    ctx.beginPath();
                    ctx.moveTo(Math.round(tipX*s), Math.round((hy-6)*s));
                    ctx.lineTo(Math.round((tipX-1)*s), Math.round((hy-3)*s));
                    ctx.lineTo(Math.round((tipX+1)*s), Math.round((hy-3)*s));
                    ctx.fill();
                } else if (isBerserk) {
                    ctx.fillStyle='rgba(255,80,0,0.4)';
                    ctx.beginPath(); ctx.arc(Math.round(hx*s), Math.round((hy-1)*s), 3*s, 0, Math.PI*2); ctx.fill();
                }
            }
        };

        const drawTorso = () => {
            dot(tX, -8.5, tW, 5.5, C.shirt);
            dot(tX, -3.5, tW, 0.8, C.shirt_d); // belt
            if (isBerserk) { ctx.fillStyle='rgba(198,40,40,0.22)'; ctx.fillRect(tX*s,-8.5*s,tW*s,5.5*s); }
            
            // 넥 라인 / 디테일 (방향에 따라 가슴 디자인이 회전)
            if (isFront) {
                if (isMale) dot(-0.8, -8.5, 1.6, 2.0, C.skin); else dot(-1.2, -7.5, 2.4, 0.6, C.shirt_l);
            } else if (isFrontSide) {
                if (isMale) dot(0.0, -8.5, 1.2, 1.6, C.skin);  else dot(-0.5, -7.5, 1.8, 0.6, C.shirt_l);
            } else if (isSide) {
                if (isMale) dot(0.2, -8.5, 0.8, 1.6, C.skin);
            }
        };

        const drawBackpack = () => {
            if (!isCarrying) return;
            // 바라보는 방향과 반대(등 쪽)으로 가방 돌출
            let bx = -4.0, by = -9.5;
            if (!isFront && !isBack) bx = -4.8; // 측면 계열이면 등 쪽(Left)으로 돌출
            
            if (carryingWood) {
                dot(bx, by, 3.2, 7.5, '#5d4037');
                dot(bx, by+1, 3.2, 0.8, '#3e2723'); dot(bx, by+4, 3.2, 0.8, '#3e2723'); dot(bx, by+7, 3.2, 0.8, '#3e2723');
            } else if (carryingFood) {
                dot(bx-0.4, by+0.7, 4.0, 5.5, '#d7ccc8'); dot(bx, by+0.1, 3.0, 1.0, '#8d6e63');
            } else {
                dot(bx, by+1.5, 3.2, 4.5, '#8d6e63');
            }
        };

        const drawHead = () => {
            ctx.save();
            ctx.translate(0, (-12.5 + headBob) * s);
            if (isEating || isForaging) ctx.translate(0, Math.abs(Math.sin(t*3.5))*2.5*s);

            let hw = 4.0, hx = -2.0;
            if (isSide) { hw = 3.2; hx = -1.6; }

            if (isBack || isBackSide) {
                dot(hx, -0.5, hw, 4.0, C.skin);
                dot(hx-0.2, -2.0, hw+0.4, 3.0, C.hair); // 뒷머리
                if (!isMale) dot(-1.0, 0, 2.0, 5.5, C.hair); 
            } else {
                dot(hx, 0, hw, 4.0, C.skin);
                // 앞머리 (원근 적용)
                if (isMale) {
                    dot(hx-0.2, -1.5, hw+0.4, 2.5, C.hair); 
                    dot(hx-0.2, 0, 0.8, 2.5, C.hair); 
                    if (isFront || isFrontSide) dot(hx+hw-0.6, 0, 0.8, 2.5, C.hair); 
                    if (isBaby) dot(hx+1, -2, 2, 0.8, C.acc);
                } else {
                    dot(hx-0.5, -1.8, hw+1.0, 2.8, C.hair);
                    dot(hx-0.5, 0, 1.2, 5.5, C.hair);
                    if (isFront || isFrontSide) { dot(hx+hw-0.7, 0, 1.2, 5.5, C.hair); dot(hx+hw-0.2, 0, 1.2, 1.2, C.acc); }
                }
                
                // 눈 (방향에 따라 개수 및 위치 조절)
                let eyes = [];
                if (isFront) eyes = [-1.4, 0.4];
                else if (isFrontSide) eyes = [-0.6, 1.2]; // 우측으로 쏠림
                else if (isSide) eyes = [0.4]; // 우측 눈만 보임

                eyes.forEach(ex => {
                    if (isBerserk) {
                        dot(ex, 1.8, 1.0, 1.6, '#f44336');
                        ctx.fillStyle='#3e2723'; ctx.save();
                        ctx.translate(ex*s, 0.8*s); ctx.rotate(isFront ? 0.35 : 0.2);
                        ctx.fillRect(0,0,Math.round(1.5*s),Math.round(0.6*s)); ctx.restore();
                    } else if (isEating || isForaging) {
                        dot(ex, 2.0, 1.0, 0.9, C.eye);
                    } else if (isMovingFast) {
                        dot(ex, 1.9, 1.0, 1.4, C.eye);
                    } else if (isStarving) {
                        dot(ex, 2.0, 1.0, 1.3, '#424242');
                    } else {
                        dot(ex, 2.0, 1.0, 1.2, C.eye);
                    }
                });
                if (isEating || isForaging) dot(-0.6, 3.2, 1.2, 0.5, C.skin_dark);
            }

            // 상태 글리프
            if (isBerserk) { ctx.fillStyle='rgba(255,80,0,0.95)'; ctx.font=`bold ${6*s}px sans-serif`; ctx.fillText('!',3*s,-3*s); }
            if (isStarving && !isBack) { ctx.fillStyle='rgba(100,200,255,0.6)'; ctx.fillRect(-2.5*s,1.0*s,0.8*s,1.8*s); }
            ctx.restore();
        };

        // ── 9. Z-Order(심도) 기반 동적 렌더링 ─────────────────────────────
        // 방향에 따라 겹치는 순서가 완벽하게 바뀝니다. (8방향 리얼타임 Z-Sorting)
        
        const bothArmsFar = isBack;
        const bothArmsNear = isFront;

        // 1. Far Arm(s)
        if (bothArmsFar) { drawArm(lax, lay, false); drawArm(rax, ray, true); } 
        else if (!bothArmsNear) { drawArm(lax, lay, false); }

        // 2. Far Leg (Left is always far when facing Right/East)
        drawLeg(lx, ly, false);

        // 3. Torso & Backpack
        if (isBack || isBackSide) {
            drawTorso();
            drawBackpack(); // 등 뒤쪽 뷰면 몸통 그리고 가방 (가방이 앞)
        } else {
            drawBackpack(); // 앞쪽 뷰면 가방 그리고 몸통 (몸통이 앞)
            drawTorso();
        }

        // 4. Near Leg (Right is always near)
        drawLeg(rx, ry, true);

        // 5. Near Arm(s)
        if (bothArmsNear) { drawArm(lax, lay, false); drawArm(rax, ray, true); } 
        else if (!bothArmsFar) { drawArm(rax, ray, true); }

        // 6. Head (항상 최상단)
        drawHead();

        ctx.restore();
    }
};
