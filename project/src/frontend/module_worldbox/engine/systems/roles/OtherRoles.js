import BaseRole from './BaseRole.js';

/**
 * 👨‍🌾 FarmerRole  — 농부 (향후 FarmingSystem 연동)
 * 🐄 RancherRole  — 목축업자
 * ⚔️  WarriorRole  — 전사
 * 💰 MerchantRole — 상인
 * ⚒️  BlacksmithRole — 대장장이
 * 🪚 CarpenterRole  — 목수
 */

export class FarmerRole extends BaseRole {
    decide(entity, dt) {
        // TODO: FarmingSystem과 연동하여 농장 타일로 이동 후 경작
        // 현재는 채집가(FORAGE)로 임시 처리
        const state = entity.components.get('AIState');
        if (!state) return null;
        return null; // 기본 HumanBrain에 위임
    }
}

export class RancherRole extends BaseRole {
    decide(entity, dt) {
        // TODO: LivestockSystem과 연동하여 가축 관리
        return null;
    }
}

export class WarriorRole extends BaseRole {
    decide(entity, dt) {
        // TODO: CombatSystem과 연동하여 마을 위협 대상 제거
        // 현재는 배회하며 주변 적 감지 시 전투 전환을 CombatSystem에 위임
        return null;
    }
}

export class MerchantRole extends BaseRole {
    decide(entity, dt) {
        // TODO: 마을 간 자원 교역 시스템 구축 후 구현
        return null;
    }
}

export class BlacksmithRole extends BaseRole {
    decide(entity, dt) {
        // TODO: 제작 시스템 연동 후 구현
        return null;
    }
}

export class CarpenterRole extends BaseRole {
    decide(entity, dt) {
        // TODO: 목재를 이용한 건설/도구 제작 시스템 연동 후 구현
        // 현재는 ArchitectRole과 유사하게 건설 우선 처리
        const state = entity.components.get('AIState');
        const civ = entity.components.get('Civilization');
        const vs = this.engine.systemManager?.villageSystem;
        if (!state || !civ || !vs) return null;
        const village = vs.getVillage(civ.villageId);
        if (village?.currentTask?.type === 'build') {
            const bp = this.em.entities.get(village.currentTask.targetId);
            if (bp) { state.targetId = village.currentTask.targetId; return 'build'; }
        }
        return null;
    }
}
