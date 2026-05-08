/**
 * ⚒️ EquipmentSlots
 * 각 직업에 맞는 도구를 장착하는 슬롯 컴포넌트.
 *
 * 장착된 도구는 작업 효율(buildSpeed, attackDamage 등)에 배율을 부여합니다.
 * 도구 제작은 BlacksmithRole/CarpenterRole 에서 처리하며,
 * 장착은 VillageSystem의 BUILDING_COMPLETE 이벤트 이후 주민에게 지급합니다.
 *
 * 도구 타입 및 효과:
 *   - axe      : 벌목꾼 도끼   → 벌목 속도 +50%
 *   - pickaxe  : 광부 곡괭이   → 채굴 속도 +50%
 *   - hoe      : 농부 괭이     → 파종/수확 속도 +40%
 *   - spear    : 병사 창       → 공격 데미지 +30%, 공격 속도 +20%
 *   - sword    : 전사 검       → 공격 데미지 +50%
 *   - bow      : 궁수 활       → 사거리 +100px, 데미지 +20%
 *   - hammer   : 건축가 망치   → 건설 속도 +40%
 *   - basket   : 채집가 바구니 → 최대 수납량 +30%
 */
export const ToolBonuses = Object.freeze({
    axe:     { gatherSpeed: 1.5, label: '도끼 🪓' },
    pickaxe: { mineSpeed: 1.5, label: '곡괭이 ⛏️' },
    hoe:     { farmSpeed: 1.4, label: '괭이 🌾' },
    spear:   { attackDamage: 1.3, attackSpeed: 1.2, label: '창 🪃' },
    sword:   { attackDamage: 1.5, label: '검 ⚔️' },
    bow:     { attackRange: 100, attackDamage: 1.2, label: '활 🏹' },
    hammer:  { buildSpeed: 1.4, label: '망치 🔨' },
    basket:  { carryCapacity: 1.3, label: '바구니 🧺' },
});

/** 직업별 권장 도구 매핑 */
export const JobToolMap = Object.freeze({
    logger:    'axe',
    miner:     'pickaxe',
    farmer:    'hoe',
    warrior:   'spear',
    soldier:   'spear',
    archer:    'bow',
    architect: 'hammer',
    gatherer:  'basket',
    hunter:    'bow',
});

export default class EquipmentSlots {
    constructor() {
        this.mainHand = null;   // 주 무기/도구 타입 ('axe', 'sword' 등)
        this.offHand  = null;   // 보조 장비 (방패 등 미래 확장용)
        this.armor    = null;   // 방어구 타입 (미래 확장용)
    }

    /** 도구를 장착하고 효과를 반환합니다. */
    equip(toolType) {
        if (!ToolBonuses[toolType]) return false;
        this.mainHand = toolType;
        return true;
    }

    unequip() {
        this.mainHand = null;
    }

    /** 현재 장착 도구의 보너스를 반환합니다. 없으면 빈 객체를 반환합니다. */
    getBonus() {
        return (this.mainHand && ToolBonuses[this.mainHand]) || {};
    }

    /** 특정 스탯의 배율을 반환합니다. (없으면 1.0) */
    getBonusMultiplier(stat) {
        const bonus = this.getBonus();
        return bonus[stat] || 1.0;
    }

    /** 특정 스탯의 추가 수치를 반환합니다. (없으면 0) */
    getBonusFlat(stat) {
        const bonus = this.getBonus();
        return bonus[stat] || 0;
    }

    get isEquipped() {
        return this.mainHand !== null;
    }

    get label() {
        if (!this.mainHand) return '없음';
        return ToolBonuses[this.mainHand]?.label || this.mainHand;
    }
}
