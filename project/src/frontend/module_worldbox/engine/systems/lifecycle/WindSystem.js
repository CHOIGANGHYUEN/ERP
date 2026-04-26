import MathUtils from '../../utils/MathUtils.js';

export default class WindSystem {
    constructor() {
        this.math = new MathUtils();
        this.centers = [];

        // 시간 추적용 변수
        this.lastTime = 0;

        // 기상청(매크로 기압골) 업데이트 주기: 60초
        this.nextMetUpdate = 0;
        this.metInterval = 60000;

        // 국지풍(마이크로 돌풍) 업데이트 주기: 1초
        this.nextMicroUpdate = 0;
        this.microInterval = 1000;

        // 그리드 기반 바람 캐시 (1000x1000 월드 기준 40x40 그리드)
        this.gridSize = 40;
        this.cellWidth = 1000 / this.gridSize;
        this.windGrid = new Float32Array(this.gridSize * this.gridSize * 2); // [vx, vy, ...]

        // 물리적 관성(Inertia) 적용을 위한 현재 상태 및 목표 상태 캐싱
        this.currentPulse = 0.7;
        this.targetPulse = 0.7;
        this.currentTurbulenceX = 0;
        this.currentTurbulenceY = 0;
        this.targetTurbulenceX = 0;
        this.targetTurbulenceY = 0;

        // 초기 기압골 생성
        for (let i = 0; i < 8; i++) {
            this.centers.push({
                x: Math.random() * 1000,
                y: Math.random() * 1000,
                strength: (Math.random() - 0.5) * 1200,
                radius: 400 + Math.random() * 600
            });
        }

        this.updateMetOffice(0);
    }

    // 60초마다 거시적인 기상 패턴 재계산
    updateMetOffice(time) {
        this.nextMetUpdate = time + this.metInterval;

        // 기압골의 이동
        for (const c of this.centers) {
            c.x = (c.x + (Math.random() - 0.5) * 300 + 1000) % 1000;
            c.y = (c.y + (Math.random() - 0.5) * 300 + 1000) % 1000;
        }

        // 그리드에 코리올리 힘(Coriolis force) 및 기압 경도력 적용
        for (let gy = 0; gy < this.gridSize; gy++) {
            for (let gx = 0; gx < this.gridSize; gx++) {
                const wx = gx * this.cellWidth;
                const wy = gy * this.cellWidth;
                const idx = (gy * this.gridSize + gx) * 2;

                let vx = 0;
                let vy = 0;
                for (const c of this.centers) {
                    const dx = wx - c.x;
                    const dy = wy - c.y;
                    const distSq = dx * dx + dy * dy;
                    const r2 = c.radius * c.radius;
                    if (distSq < r2) {
                        const t = 1.0 - (Math.sqrt(distSq) / c.radius);
                        const force = (c.strength / c.radius) * (t * t * (3.0 - 2.0 * t));
                        // 소용돌이 형태의 물리적 유체 흐름 연산
                        vx += (dx * 0.2 - dy * 0.8) * force * 0.005;
                        vy += (dy * 0.2 + dx * 0.8) * force * 0.005;
                    }
                }
                // 글로벌 무역풍(Trade winds) 기저값
                this.windGrid[idx] = vx + 0.6;
                this.windGrid[idx + 1] = vy + 0.2;
            }
        }
    }

    // 1초 단위 마이크로 바람(돌풍, 난기류) 목표치 계산
    updateMicroWind(time) {
        this.nextMicroUpdate = time + this.microInterval;

        // 돌풍의 세기: 0.4 ~ 1.0 범위 내에서 무작위 변동 (바람의 세기가 1초마다 결정됨)
        this.targetPulse = 0.7 + (Math.random() * 0.6 - 0.3);

        // 전체적인 난기류(Turbulence) 흐름 목표치 (1초마다 무작위 풍향 변화)
        this.targetTurbulenceX = (Math.random() - 0.5) * 0.4;
        this.targetTurbulenceY = (Math.random() - 0.5) * 0.4;
    }

    // 매 프레임(틱) 호출되지만 무거운 계산은 하지 않음
    update(time) {
        // Delta time 계산 (예외 방지를 위해 기본값 16ms 적용)
        const deltaTime = (this.lastTime === 0) ? 16 : (time - this.lastTime);
        this.lastTime = time;

        if (time > this.nextMetUpdate) {
            this.updateMetOffice(time);
        }

        if (time > this.nextMicroUpdate) {
            this.updateMicroWind(time);
        }

        // 공기의 관성 시뮬레이션: 바람이 1초마다 즉시 바뀌지 않고 deltaTime에 따라 부드럽게 가속/감속됨
        // 초당 약 일정 비율로 타겟을 향해 이동 (lerp factor 조절로 바람의 무게감 표현)
        const inertiaFactor = Math.min(1.0, 0.003 * deltaTime);

        this.currentPulse = this.lerp(inertiaFactor, this.currentPulse, this.targetPulse);
        this.currentTurbulenceX = this.lerp(inertiaFactor, this.currentTurbulenceX, this.targetTurbulenceX);
        this.currentTurbulenceY = this.lerp(inertiaFactor, this.currentTurbulenceY, this.targetTurbulenceY);
    }

    // 렌더링 측에서 흔들림(Sway)을 가져갈 때 호출
    getSway(x, y) {
        // 이중 선형 보간 (Bilinear Interpolation)
        const gx = Math.max(0, Math.min(this.gridSize - 2, Math.floor(x / this.cellWidth)));
        const gy = Math.max(0, Math.min(this.gridSize - 2, Math.floor(y / this.cellWidth)));

        const tx = (x / this.cellWidth) - gx;
        const ty = (y / this.cellWidth) - gy;

        const i1 = (gy * this.gridSize + gx) * 2;
        const i2 = (gy * this.gridSize + (gx + 1)) * 2;
        const i3 = ((gy + 1) * this.gridSize + gx) * 2;
        const i4 = ((gy + 1) * this.gridSize + (gx + 1)) * 2;

        const vx = this.lerp(ty, this.lerp(tx, this.windGrid[i1], this.windGrid[i2]), this.lerp(tx, this.windGrid[i3], this.windGrid[i4]));
        const vy = this.lerp(ty, this.lerp(tx, this.windGrid[i1 + 1], this.windGrid[i2 + 1]), this.lerp(tx, this.windGrid[i3 + 1], this.windGrid[i4 + 1]));

        // 위치(x, y)에 따른 고정 공간 난기류 (시간 연산을 빼서 프레임 드랍 방지)
        const spatialTurbulence = this.math.perlin(x * 0.005, y * 0.005) * 0.2;

        return {
            x: Math.max(-3, Math.min(3, (vx * this.currentPulse) + this.currentTurbulenceX + spatialTurbulence)),
            y: Math.max(-2, Math.min(2, (vy * this.currentPulse) + this.currentTurbulenceY + spatialTurbulence))
        };
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }
}