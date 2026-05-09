import State from '../State.js';
import { JobToolMap } from '../../../../components/resource/EquipmentSlots.js';
import Pathfinder from '../../../../utils/Pathfinder.js';

/**
 * 🔧 BaseJobState
 * 모든 직업 전용 상태의 공통 기반 클래스.
 *
 * 제공 유틸리티:
 *   - checkOutOfBounds / returnToZone : 구역 이탈 체크 및 복귀
 *   - getWorkSpeedMultiplier         : 지도자 버프 + 장비 보너스 통합 속도 배율
 *   - tryAutoEquip                   : 직업에 맞는 도구 자동 장착 시도
 */
export default class BaseJobState extends State {
    constructor(system) {
        super(system);
    }

    // 하위 클래스에서 오버라이드
    enter(entityId, entity) { }
    
    // 하위 클래스에서 오버라이드
    update(entityId, entity, dt) { return null; }
    
    // 하위 클래스에서 오버라이드
    exit(entityId, entity) { }

    // ─────────────────────────────────────────────────────────────────────────
    // 공통 유틸리티: 구역 이탈 체크
    // ─────────────────────────────────────────────────────────────────────────
    checkOutOfBounds(entity) {
        const jobCtrl = entity.components.get('JobController');
        const transform = entity.components.get('Transform');
        if (!jobCtrl || !jobCtrl.zoneId || !transform) return false;

        const zoneManager = this.system.engine.systems?.find(s => s.constructor.name === 'ZoneManager')
            ?? this.system.engine.systemManager?.zoneManager;
        if (!zoneManager) return false;

        const zone = zoneManager.getZone(jobCtrl.zoneId);
        if (!zone) return false;

        return !zone.contains(transform.x, transform.y);
    }

    returnToZone(entity, transform, jobCtrl) {
        const zoneManager = this.system.engine.systems?.find(s => s.constructor.name === 'ZoneManager')
            ?? this.system.engine.systemManager?.zoneManager;
        if (!zoneManager) return;
        const zone = zoneManager.getZone(jobCtrl.zoneId);
        if (!zone) return;

        const targetPos = zone.center ?? { x: transform.x, y: transform.y };
        
        // 🚀 [HPA* Integration] Use Pathfinder for long-distance recovery
        if (Pathfinder) {
            Pathfinder.followPath(transform, jobCtrl, targetPos, 60, this.system.engine);
        } else {
            // Fallback
            const dx = targetPos.x - transform.x;
            const dy = targetPos.y - transform.y;
            const d = Math.hypot(dx, dy) || 1;
            transform.vx = (dx / d) * 60;
            transform.vy = (dy / d) * 60;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Task 57/59: 작업 속도 통합 배율 계산
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 지도자 아우라 버프 × 장비 보너스를 결합한 최종 작업 속도 배율을 반환합니다.
     * @param {object} entity - 대상 엔티티
     * @param {string} bonusStat - EquipmentSlots의 스탯 키 (e.g. 'gatherSpeed', 'buildSpeed')
     * @returns {number} 배율 (1.0 = 기본)
     */
    getWorkSpeedMultiplier(entity, bonusStat) {
        let multiplier = 1.0;

        // 1. 지도자 아우라 버프 (SocialComponent)
        const social = entity.components.get('Social');
        if (social && typeof social.getWorkSpeedBuff === 'function') {
            multiplier *= social.getWorkSpeedBuff();
        }

        // 2. 장비 보너스 (EquipmentSlots)
        const equip = entity.components.get('EquipmentSlots');
        if (equip && bonusStat) {
            multiplier *= equip.getBonusMultiplier(bonusStat);
        }

        return multiplier;
    }

    /**
     * 직업에 맞는 도구가 인벤토리에 있으면 자동으로 장착합니다.
     * 마을 창고에서도 탐색합니다.
     * @param {object} entity
     */
    tryAutoEquip(entity) {
        const civ = entity.components.get('Civilization');
        if (!civ) return;

        const jobType = civ.jobType;
        const recommendedTool = JobToolMap[jobType];
        if (!recommendedTool) return;

        let equip = entity.components.get('EquipmentSlots');
        if (!equip) return;

        // 이미 올바른 도구가 장착돼 있으면 무시
        if (equip.mainHand === recommendedTool) return;

        // 인벤토리에서 도구 확인
        const inv = entity.components.get('Inventory');
        if (inv && inv.has(recommendedTool, 1)) {
            equip.equip(recommendedTool);
            // 단순 장착이므로 소비하지 않음 (영구 보유)
            return;
        }

        // 마을 창고에서 도구 조달 시도
        const vs = this.system.engine.systemManager?.villageSystem;
        const village = vs?.getVillage(civ.villageId);
        if (!village) return;

        for (const bId of village.buildings) {
            const bEnt = this.system.engine.entityManager.entities.get(bId);
            const storage = bEnt?.components.get('Storage');
            if (!storage) continue;
            if ((storage.items[recommendedTool] || 0) >= 1) {
                storage.withdraw(recommendedTool, 1);
                if (inv) inv.add(recommendedTool, 1);
                equip.equip(recommendedTool);
                GlobalLogger.info(`🪓 [Equipment] ${jobType} equipped ${recommendedTool} from village storage.`);
                return;
            }
        }
    }
}
