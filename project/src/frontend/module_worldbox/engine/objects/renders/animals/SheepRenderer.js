/** 🐑 SheepRenderer (Masterpiece Final Edition)
 * 초정밀 디더링 명암법과 접지 그림자를 포함한 최상급 도트 아트를 구현합니다.
 */
export const SheepRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const isSleeping = mode === 'sleep';
        const isRunning = ['run', 'hunt', 'flee'].includes(mode);
        const isDead = mode === 'die';

        // 🎨 초정밀 팔레트 (톤의 깊이 강화)
        const C = {
            wool: '#ffffff',
            wool_mid: '#f1f5f9',
            wool_shadow: '#cbd5e1',
            wool_deep: '#94a3b8',
            skin: '#171717',
            skin_edge: '#262626',
            eye: '#ffffff',
            shadow: 'rgba(0, 0, 0, 0.15)' // 접지 그림자용
        };

        const dot = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.floor(x * s), Math.floor(y * s), Math.max(1, w * s), Math.max(1, h * s));
        };

        // 0. 접지 그림자 (공간감 부여)
        if (!isDead) {
            ctx.beginPath();
            ctx.ellipse(0, 1 * s, 6 * s, 2 * s, 0, 0, Math.PI * 2);
            ctx.fillStyle = C.shadow;
            ctx.fill();
        }

        // 1. 가느다란 다리 (애니메이션 정교화)
        if (!isSleeping && !isDead) {
            const legOsc = Math.sin(frameIdx * Math.PI);
            const drawLeg = (ox, oy, osc, isFront) => {
                const tx = ox + (osc * 2.5);
                dot(tx, oy, 1, 3, isFront ? C.skin : C.skin_edge);
            };
            drawLeg(-3.5, -0.5, -legOsc, false);
            drawLeg(1.5, -0.5, -legOsc, false);
            drawLeg(-1.5, -0.5, legOsc, true);
            drawLeg(3.5, -0.5, legOsc, true);
        }

        ctx.save();
        if (isSleeping) ctx.translate(0, 1 * s);

        // 2. 꼬리 (짧고 뭉툭한 꼬리 추가)
        const tailOsc = Math.sin(frameIdx * Math.PI) * 0.5;
        dot(-6.8, -4.5 + tailOsc, 1.5, 1.5, C.wool_shadow);

        // 3. 뭉게구름형 몸통 (디더링 명암 적용)
        // [레이어 1: 딥 셰도우]
        dot(-5.5, -2, 11, 2, C.wool_deep);
        dot(-6, -3, 12, 1, C.wool_shadow);
        
        // [레이어 2: 메인 몸통 & 디더링]
        dot(-6.5, -5, 13, 3, C.wool_mid);
        // 디더링 패턴 (털 질감 시뮬레이션)
        for(let i=-6; i<6; i+=2) dot(i, -2.5, 1, 1, C.wool_deep);
        for(let i=-5; i<6; i+=2) dot(i, -4.5, 1, 1, C.wool_shadow);

        // [레이어 3: 하이라이트 뭉치]
        dot(-5, -6.5, 4, 2, C.wool);
        dot(0, -6.8, 5, 2.5, C.wool);
        dot(3, -6, 3, 2, C.wool);
        dot(-1, -7, 2, 1, C.wool); // 최상단 뭉치

        // 4. 새까만 머리 (표정 고도화)
        ctx.save();
        let hX = 4; let hY = -5.5; let hR = 0;
        if (mode === 'eat') { hY += 3; hR = 0.45; }
        else if (isSleeping) { hX -= 0.5; hY += 2; hR = -0.2; }

        ctx.translate(hX * s, hY * s);
        ctx.rotate(hR);

        // 두상 (정밀한 블랙 셰이딩)
        dot(0, 0, 4.5, 4.5, C.skin);
        dot(0.5, 0.5, 3.5, 3.5, C.skin_edge); // 안면 하이라이트 경계
        dot(1.5, 3.5, 2.5, 1.5, C.skin);     // 주둥이

        // 귀 (물리 기반 흔들림)
        const earMov = isRunning ? -1 : (Math.sin(frameIdx * 3) * 0.3);
        dot(-1.2, 0.5 + earMov, 1.8, 2.2, C.skin);
        dot(-0.5, 0.8 + earMov, 0.8, 1.2, C.skin_edge);

        // 눈 (표정 디테일)
        if (!isDead) {
            dot(2.2, 1.2, 1.2, 1.2, C.eye); // 흰자
            dot(2.8, 1.4, 0.6, 0.8, '#000'); // 눈동자 (시선)
        } else {
            dot(2.2, 1.2, 1, 1, C.skin_edge);
        }

        // 코 (미세한 콧구멍 표현)
        dot(3.8, 4.2, 0.6, 0.6, '#000');

        ctx.restore();
        ctx.restore();
    }
};
