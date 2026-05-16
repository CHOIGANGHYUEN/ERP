import { JobExecutionStates } from '../../../systems/behavior/jobs/JobStateDefinitions.js';

/**
 * 👤 HumanRenderer — Premium 8-Directional Pixel Life
 * High-fidelity 3-tone shading, procedural secondary motion, and job-specific archetypes.
 */
export const HumanRenderer = {
    draw(ctx, time, s, mode, entity) {
        const t = time * 0.001;

        const aiState    = entity?.components.get('AIState');
        const visual     = entity?.components.get('Visual');
        const inventory  = entity?.components.get('Inventory');
        const animal     = entity?.components.get('Animal');
        const metabolism = entity?.components.get('Metabolism');
        const jobCtrl    = entity?.components.get('JobController');
        const social     = entity?.components.get('Social');

        // ── 1. 방향 프로필 매핑 ────────────
        const rawFacing = visual?.facing ?? 2;
        let vf = rawFacing;
        if (rawFacing === 3) vf = 1; // SW -> SE
        if (rawFacing === 4) vf = 0; // W -> E
        if (rawFacing === 5) vf = 7; // NW -> NE

        const isFront = vf === 2, isBack = vf === 6, isSide = vf === 0;
        const isFrontSide = vf === 1, isBackSide = vf === 7;

        // ── 2. 모션 상태 ────────────────────
        const job = jobCtrl?.currentJob || 'unemployed';
        const isMoving = (entity.components.get('Velocity')?.mag() || 0) > 0.2;
        const isRunning = mode === 'run' || mode === 'flee' || mode === 'hunt';
        
        const isSleeping = mode === 'sleep', isDead = mode === 'die';
        const isChopping = mode === 'gather_wood' && aiState?.isChopping;
        const isBuilding = mode === 'build';
        const isWorking  = jobCtrl?.jobState === JobExecutionStates.WORKING; // 🛠️ [Step 32] 엄격한 작업 상태 체크
        const isBerserk  = mode === 'berserk';
        const isChief    = job === 'chief';

        const gender = animal?.gender || 'male';
        const isMale = gender === 'male';
        const isStarving = (metabolism?.hunger ?? 100) < 20;

        // ── 3. 프리미엄 3-톤 팔레트 ──────────
        // [Shadow, Base, Highlight]
        const P = isMale ? {
            skin:  ['#c68642', '#e0ac69', '#f3d2a2'],
            shirt: isBerserk ? ['#7f0000', '#c62828', '#ef5350'] : ['#1565c0', '#1e88e5', '#64b5f6'],
            pants: ['#102027', '#263238', '#455a64'],
            hair:  ['#21100a', '#3e2723', '#5d4037'],
            acc:   ['#fbc02d', '#ffeb3b', '#fff176'], // Gold/Yellow
            cape:  ['#b71c1c', '#d32f2f', '#f44336'], // Red Cape
        } : {
            skin:  ['#f1c27d', '#ffdbac', '#ffeace'],
            shirt: ['#ad1457', '#ec407a', '#f06292'],
            pants: ['#263238', '#37474f', '#546e7a'],
            hair:  ['#2d1d1a', '#4e342e', '#6d4c41'],
            acc:   ['#7b1fa2', '#9c27b0', '#ba68c8'], // Purple
            cape:  ['#4a148c', '#7b1fa2', '#9c27b0'], // Royal Purple Cape
        };

        // ── 4. 픽셀-퍼펙트 헬퍼 ───────────────
        const dot = (x, y, w, h, colors) => {
            const rx = Math.round(x * s), ry = Math.round(y * s);
            const rw = Math.max(1, Math.round(w * s)), rh = Math.max(1, Math.round(h * s));
            
            // 3단 셰이딩 자동 적용 (위쪽 하이라이트, 아래쪽 그림자)
            ctx.fillStyle = colors[1]; // Base
            ctx.fillRect(rx, ry, rw, rh);
            
            ctx.fillStyle = colors[2]; // Highlight
            ctx.fillRect(rx, ry, rw, Math.max(1, Math.round(rh * 0.3)));
            
            ctx.fillStyle = colors[0]; // Shadow
            ctx.fillRect(rx, ry + Math.round(rh * 0.7), rw, Math.max(1, Math.round(rh * 0.3)));
        };

        const flatDot = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.round(x*s), Math.round(y*s), Math.max(1,Math.round(w*s)), Math.max(1,Math.round(h*s)));
        };

        // ── 5. 애니메이션 비트 ────────────────
        const animSpeed = social ? (social.workSpeedBuff || 1.0) : 1.0;
        const stepFreq = (isRunning ? 4.8 : isMoving ? 2.8 : 1.0) * animSpeed;
        const step = t * stepFreq;
        const legSin = Math.sin(step), armSin = Math.sin(step + Math.PI);
        const headBob = isMoving ? Math.sin(step * 2) * (isRunning ? 1.0 : 0.5) : Math.sin(t * 1.5) * 0.2;
        const stride = isRunning ? 5.5 : isMoving ? 3.5 : 0;
        const armAmp = isRunning ? 6.5 : isMoving ? 4.0 : isWorking ? 2.5 : 0;
        
        // 🛠️ [Step 32] 작업 중일 때는 애니메이션 폭을 키움 (Squash & Stretch)
        const workScale = isWorking ? 1.0 + Math.sin(t * 12) * 0.15 : 1.0;

        ctx.save();

        // ── 6. 촌장 특수 망토 (Secondary Motion) ──
        const drawCape = () => {
            if (!isChief) return;
            const wave = Math.sin(t * 4 + (isMoving ? 4 : 2)) * (isMoving ? 2.5 : 1.0);
            const cx = isBack ? -3.5 : -4.5, cy = -8.5, cw = 7.0, ch = 9.0;
            ctx.save();
            ctx.translate(cx * s, cy * s);
            ctx.rotate(wave * 0.05);
            // 망토 레이어링 (그라데이션 효과)
            flatDot(0, 0, cw, ch, P.cape[0]);
            flatDot(0.5, 0.5, cw-1, ch-1, P.cape[1]);
            if (isMoving) flatDot(wave*0.5, ch-1, cw, 1.5, P.cape[2]);
            ctx.restore();
        };

        // ── 7. 부위별 렌더링 함수 ─────────────
        const drawLeg = (ox, oy, isNear) => {
            const col = isNear ? P.pants : [P.pants[0], P.pants[0], P.pants[1]]; 
            dot(ox, -3.5 + oy, 1.8, 4.3, col);
            flatDot(ox, 0.8 + oy, 1.8, 0.8, '#212121'); // Shoe
        };

        const drawArm = (ox, oy, isNear) => {
            const col = isNear ? P.shirt : [P.shirt[0], P.shirt[0], P.shirt[1]];
            dot(ox, -8.0 + oy, 1.8, 2.8, col);
            flatDot(ox, -5.2 + oy, 1.8, 2.0, P.skin[1]); // Hand
            
            // 🛠️ 도구 렌더링
            if (isNear) {
                const hx = ox + 0.5, hy = -3.2 + oy;
                if (isChopping) {
                    flatDot(hx, hy, 1.2, 5.0, '#4e342e'); // Axe handle
                    flatDot(hx - 2, hy - 1, 4.5, 3.2, '#9e9e9e'); // Axe head
                    flatDot(hx + 1, hy - 0.8, 1.5, 2.8, '#e0e0e0'); // Sharp edge
                } else if (job === 'farmer') {
                    flatDot(hx, hy-4, 1.0, 8.0, '#5d4037'); // Hoe
                    flatDot(hx - 2, hy - 4, 3.5, 1.2, '#757575');
                }
            }
        };

        const drawHead = () => {
            ctx.save();
            ctx.translate(0, (-12.5 + headBob) * s);
            
            // 👑 왕관
            if (isChief) {
                const cw = 5.5, ch = 2.5, cx = -2.75, cy = -2.2;
                flatDot(cx, cy, cw, ch, P.acc[0]);
                flatDot(cx + 0.5, cy - 1.5, 1, 2, P.acc[1]);
                flatDot(cx + 2.2, cy - 2.5, 1.2, 3, P.acc[2]);
                flatDot(cx + 4, cy - 1.5, 1, 2, P.acc[1]);
            }

            let hw = 4.0, hx = -2.0;
            if (isSide) { hw = 3.2; hx = -1.6; }

            if (isBack || isBackSide) {
                dot(hx, -0.5, hw, 4.0, P.skin);
                flatDot(hx-0.2, -2.0, hw+0.4, 3.0, P.hair[1]); 
            } else {
                dot(hx, 0, hw, 4.0, P.skin);
                // Hair Detail
                flatDot(hx-0.2, -1.8, hw+0.4, 2.5, P.hair[1]);
                flatDot(hx-0.2, -1.8, hw+0.4, 0.8, P.hair[2]); // Highlight
                
                // Eyes
                const ex = isSide ? [0.6] : isFrontSide ? [-0.4, 1.2] : [-1.2, 0.6];
                ex.forEach(x => flatDot(x, 1.8, 1.0, 1.3, isBerserk ? '#f44336' : '#212121'));
            }
            ctx.restore();
        };

        // ── 8. Z-Order 구성 및 실행 ───────────
        
        // 그림자 (바닥)
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(0, 0.5*s, 4*s, 1.2*s, 0, 0, Math.PI*2); ctx.fill();

        if (isSleeping || isDead) {
            ctx.rotate(Math.PI/2); ctx.translate(0, -4*s);
        }

        if (isWorking) {
            ctx.scale(workScale, 2.0 - workScale);
        }

        // Z-Sorting 
        const lax = -3.8, rax = 2.2, lx = -2.2, rx = 0.6;
        const lay = armSin * armAmp * 0.2, ray = -armSin * armAmp * 0.2;
        const ly = legSin * stride * 0.3, ry = -legSin * stride * 0.3;

        if (isBack || isBackSide) {
            drawLeg(lx, ly, false); drawLeg(rx, ry, true);
            drawArm(lax, lay, false); drawArm(rax, ray, true);
            dot(-2.4, -8.5, 4.8, 5.5, P.shirt); // Torso
            drawCape();
            drawHead();
        } else {
            drawCape(); // 등 뒤 망토
            drawLeg(lx, ly, false); drawLeg(rx, ry, true);
            dot(-2.4, -8.5, 4.8, 5.5, P.shirt); // Torso
            drawArm(lax, lay, false); drawArm(rax, ray, true);
            drawHead();
        }

        ctx.restore();
    }
};
