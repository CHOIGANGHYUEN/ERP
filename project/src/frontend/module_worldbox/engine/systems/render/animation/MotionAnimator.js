import { AnimalStates } from '../../../components/behavior/State.js';

/**
 * 🌀 MotionAnimator
 * 엔티티의 물리적인 애니메이션 변환(Squash & Stretch, Breathing, Swaying 등)을 담당합니다.
 * AnimalRenders.js에서 SRP에 따라 분리되었습니다.
 */
export default class MotionAnimator {
    static applyImpactMotion(ctx, visual, time) {
        if (!visual || visual.impactTime <= 0) return;

        const dt = time - visual.impactTime;
        const duration = 300;
        if (dt < duration) {
            const progress = dt / duration;
            const wave = Math.sin(progress * Math.PI * 2) * Math.exp(-progress * 3);
            ctx.scale(1.0 + wave * 0.2, 1.0 - wave * 0.2);
        } else {
            visual.impactTime = 0;
        }
    }

    static applyDeathMotion(ctx, visual, mode, time) {
        if (mode !== AnimalStates.DIE) return false;

        const dieTime = visual.lastDeathTime ? (time - visual.lastDeathTime) : 0;
        const progress = Math.min(1.0, dieTime / 1000);
        ctx.rotate(progress * Math.PI * 2);
        ctx.scale(1 - progress, 1 - progress);
        ctx.globalAlpha = 1 - progress;
        
        return progress >= 1.0;
    }

    static applyAdvancedStateMotion(ctx, type, mode, time, entity) {
        const visual = entity.components.get('Visual');
        if (!visual) return;

        // ⚔️ Combat Motion: Attack
        if (visual.lastAttackTime && (time - visual.lastAttackTime) < 150) {
            const progress = (time - visual.lastAttackTime) / 150;
            const lunge = Math.sin(progress * Math.PI) * 12;
            ctx.translate(lunge, -Math.sin(progress * Math.PI) * 4);
            ctx.rotate(0.2 * Math.sin(progress * Math.PI)); 
        }

        // 🩸 Combat Motion: Hit Shake
        if (visual.lastHitTime && (time - visual.lastHitTime) < 200) {
            const hitProgress = (time - visual.lastHitTime) / 200;
            const shake = (1 - hitProgress) * 4;
            ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }

        if (mode === AnimalStates.DIE) {
            ctx.filter = 'grayscale(80%) brightness(120%)';
            return;
        }

        // State-based Physics
        const beat = Math.sin(time * 0.01);
        
        switch (mode) {
            case AnimalStates.SLEEP:
                ctx.scale(1.02, 0.96 + Math.sin(time * 0.002) * 0.04);
                break;
            case AnimalStates.EAT:
            case AnimalStates.FORAGE:
                // 🍎 [Expert Motion] 먹을 때는 몸을 앞으로 숙이고 율동적으로 움직임
                ctx.translate(0, Math.abs(Math.sin(time * 0.015)) * 3.5);
                ctx.rotate(Math.sin(time * 0.015) * 0.15);
                ctx.scale(1.05, 0.95);
                break;
            case AnimalStates.RUN:
            case AnimalStates.HUNT:
            case AnimalStates.FLEE:
            case 'flee':
                // 🏃 [Kinetic Leaning] 가속도에 따른 전경 자세
                const lean = mode === 'flee' ? 0.25 : 0.15;
                ctx.rotate(lean + Math.sin(time * 0.02) * 0.05);
                ctx.translate(0, Math.sin(time * 0.025) * 2.0);
                // 역동적인 Squash & Stretch
                const stretch = 1.0 + Math.abs(Math.sin(time * 0.025)) * 0.15;
                ctx.scale(stretch, 2.0 - stretch);
                break;
            case AnimalStates.WALK:
                ctx.translate(0, Math.sin(time * 0.012) * 1.0);
                ctx.rotate(Math.sin(time * 0.01) * 0.04);
                break;
            case 'gather_wood': {
                const aiState = entity?.components?.get('AIState');
                if (aiState?.isChopping) {
                    const chopPhase = Math.min(1, (aiState.chopTimer || 0) / 0.4);
                    // 🪓 [Anticipation] 내려찍기 전 살짝 몸을 띄움
                    const punch = Math.sin(chopPhase * Math.PI);
                    ctx.rotate(0.2 * punch);
                    ctx.translate(0, -punch * 2.0);
                    ctx.scale(1.0 - punch * 0.1, 1.0 + punch * 0.2);
                }
                break;
            }
            case 'job_miner': {
                const jobCtrl = entity?.components?.get('JobController');
                if (jobCtrl && jobCtrl.jobState === 'WORKING') {
                    // ⛏️ 광부 채굴 모션: 더 무겁고 강하게 내려찍음
                    const mineTimer = jobCtrl.getData('mineTimer') || 0;
                    // mineInterval은 1.2이므로, 모션 주기를 1.2로 설정
                    const minePhase = (mineTimer % 1.2) / 1.2;
                    
                    // 0.0 ~ 0.7: 들어 올림 (Anticipation)
                    // 0.7 ~ 0.8: 강하게 내리찍음 (Strike)
                    // 0.8 ~ 1.2: 반동 및 회복 (Recovery)
                    let punch = 0;
                    if (minePhase < 0.7) {
                        punch = -Math.sin((minePhase / 0.7) * Math.PI * 0.5) * 0.5; // 천천히 들어올림
                    } else if (minePhase < 0.8) {
                        punch = Math.sin(((minePhase - 0.7) / 0.1) * Math.PI * 0.5); // 빠르게 내리찍음
                    } else {
                        punch = (1.0 - (minePhase - 0.8) / 0.4) * 0.3; // 반동
                    }

                    ctx.rotate(0.3 * punch);
                    ctx.translate(punch * 1.5, punch * 3.0); // 위아래 + 앞뒤 약간
                    ctx.scale(1.0 - punch * 0.15, 1.0 + punch * 0.15); // Squash & Stretch
                } else if (jobCtrl && jobCtrl.jobState === 'MOVING') {
                    // 이동 시 모션 (WALK 재사용)
                    ctx.translate(0, Math.sin(time * 0.012) * 1.0);
                    ctx.rotate(Math.sin(time * 0.01) * 0.04);
                }
                break;
            }
            case 'build':
                ctx.translate(0, Math.abs(Math.sin(time * 0.015)) * 2.0);
                ctx.rotate(0.08 * Math.sin(time * 0.02));
                break;
            case 'berserk':
                // ⚡ [Jitter] 광분 상태에서의 고주파 진동
                ctx.translate((Math.random()-0.5) * 2, (Math.random()-0.5) * 2);
                ctx.filter = 'brightness(130%) saturate(200%) contrast(110%)';
                const pulse = 1.0 + Math.sin(time * 0.05) * 0.1;
                ctx.scale(pulse, pulse);
                break;
            default:
                const social = entity.components.get('Social');
                if (social?.isBreeding) {
                    ctx.translate(Math.sin(time * 0.04) * 2.0, 0);
                    const pulse = 1.0 + Math.sin(time * 0.03) * 0.15;
                    ctx.scale(pulse, 2.0 - pulse);
                } else {
                    // 🧘 [Natural Breathing]
                    const breathe = Math.sin(time * 0.0025) * 0.02;
                    ctx.scale(1 + breathe, 1 - breathe);
                    ctx.translate(0, breathe * 2.0);
                }
                break;
        }

        if (type === 'sheep' && mode === AnimalStates.WALK) {
            ctx.rotate(Math.sin(time * 0.01) * 0.05);
        }
    }
}
