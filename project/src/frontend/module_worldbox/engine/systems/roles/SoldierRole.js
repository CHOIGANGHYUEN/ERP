import BaseRole from './BaseRole.js';

/**
 * ⚔️ SoldierRole
 * 마을 방어 병사 직업입니다.
 * - 마을 주변을 순찰하며 위협 요소(적 국가 인간, 야생 맹수)를 탐지하고 제거합니다.
 * - CombatSystem과 연동하여 실제 전투를 처리합니다.
 * - 치명상 시 후퇴 로직은 SoldierState 내부 FSM이 담당합니다.
 */
export default class SoldierRole extends BaseRole {
    decide(entity, dt) {
        const state = entity.components.get('AIState');
        const civ = entity.components.get('Civilization');
        const jobCtrl = entity.components.get('JobController');
        const transform = entity.components.get('Transform');
        if (!state || !civ || !transform) return null;

        // 이미 전투 상태 중이면 SoldierState에게 위임
        if (state.mode === 'job_soldier') {
            return 'job_soldier';
        }

        // 빠른 위협 선-감지: 가까운 위협이 있으면 즉시 전투 전환
        const QUICK_SCAN_RADIUS = 150;
        const combatSystem = this.engine.systemManager?.combatSystem;
        if (combatSystem) {
            const threatId = combatSystem.findNearestWarEnemy(entity, QUICK_SCAN_RADIUS);
            if (threatId !== null) {
                if (jobCtrl) {
                    jobCtrl.setData('engageTargetId', threatId);
                    jobCtrl.jobState = 'ENGAGING';
                }
                return 'job_soldier';
            }
        }

        return 'job_soldier'; // SoldierState의 PATROLLING 진입
    }
}
