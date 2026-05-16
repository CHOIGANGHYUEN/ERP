/**
 * 💓 PixelPulseSystem
 * 월드 전반의 애니메이션 리듬(Heartbeat)과 특수 시각 효과(Impact Frames)를 총괄합니다.
 * 모든 엔티티의 보행 및 행동 주기를 동기화하여 시각적 통일감을 부여합니다.
 */
export default class PixelPulseSystem {
    constructor(engine) {
        this.engine = engine;
        this.globalTime = 0;
        this.beat = 0; // 0.0 ~ 1.0 순환 비트
        
        // 💥 충격 효과 관리 (화면 전체 jiggle 등)
        this.globalImpacts = [];
    }

    update(dt) {
        this.globalTime += dt;
        
        // 60BPM 기준의 심장박동 (1초 주기)
        this.beat = (this.globalTime % 1000) / 1000;

        // 임팩트 프레임 수명 관리
        if (this.globalImpacts.length > 0) {
            this.globalImpacts = this.globalImpacts.filter(imp => {
                imp.life -= dt;
                return imp.life > 0;
            });
        }
    }

    /** 💥 월드 전역에 짧은 진동/충격 발생 */
    triggerGlobalImpact(strength = 1.0, duration = 200) {
        this.globalImpacts.push({ strength, life: duration, maxLife: duration });
    }

    /** 🎨 현재 프레임의 전역 진동 오프셋 반환 */
    getGlobalOffset() {
        if (this.globalImpacts.length === 0) return { x: 0, y: 0 };
        
        let offsetX = 0;
        let offsetY = 0;
        
        for (const imp of this.globalImpacts) {
            const ratio = imp.life / imp.maxLife;
            const power = imp.strength * ratio;
            offsetX += (Math.random() - 0.5) * 4 * power;
            offsetY += (Math.random() - 0.5) * 4 * power;
        }
        
        return { x: offsetX, y: offsetY };
    }

    /** ⏱️ 엔티티별 동기화된 애니메이션 타임 반환 */
    getSyncedTime(offset = 0) {
        return this.globalTime + offset;
    }
}
