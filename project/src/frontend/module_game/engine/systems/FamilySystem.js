/**
 * FamilySystem — 가문(성씨) 관리 시스템
 * 크리쳐에게 한국식 성씨를 배정하고, 번식 시 부계 성씨를 계승합니다.
 * (하네스 원칙: engine/ 내부이므로 Vue 의존성을 주입받지 않습니다.)
 */

// 한국 주요 성씨 풀 (실제 인구 비율 참고)
const FAMILY_NAMES = [
  '김', '이', '박', '최', '정', '강', '조', '윤', '장', '임',
  '한', '오', '서', '신', '권', '황', '안', '송', '류', '전',
  '홍', '고', '문', '양', '손', '배', '백', '허', '유', '남',
  '심', '노', '하', '곽', '성', '차', '주', '우', '구', '민',
  '나', '진', '지', '엄', '채', '원', '천', '방', '공', '현',
]

// 성씨별 선천적 특성 보너스 (게임 플레이 다양성 부여)
const FAMILY_TRAITS = {
  '김': { workEfficiencyBonus: 0.1, desc: '근면한 장인 가문' },
  '이': { speedBonus: 0.05, desc: '민첩한 여행자 가문' },
  '박': { attackPowerBonus: 0.1, desc: '용맹한 무사 가문' },
  '최': { workEfficiencyBonus: 0.15, desc: '뛰어난 학자 가문' },
  '정': { speedBonus: 0.1, desc: '민첩한 상인 가문' },
  '강': { attackPowerBonus: 0.15, desc: '강인한 전사 가문' },
  '홍': { workEfficiencyBonus: 0.05, speedBonus: 0.05, desc: '균형잡힌 홍씨 가문' },
}

export class FamilySystem {
  /**
   * 신규 크리쳐에게 랜덤 성씨를 배정합니다.
   * @param {Creature} creature
   */
  static assignFamily(creature) {
    const idx = Math.floor(Math.random() * FAMILY_NAMES.length)
    creature.familyName = FAMILY_NAMES[idx]
    creature.familyId = idx
    FamilySystem._applyTraits(creature)
  }

  /**
   * 번식 시 부모(부계 우선)의 성씨를 자식에게 계승합니다.
   * @param {Creature} parent  - 번식을 주도한 부모 크리쳐 (ID가 큰 쪽)
   * @param {Creature} partner - 상대 파트너
   * @param {Creature} child   - 새로 태어난 자식 크리쳐
   */
  static inheritFamily(parent, partner, child) {
    // 부계 우선(parent), 50% 확률로 모계(partner) 성씨 계승
    const useFather = Math.random() < 0.7
    const source = useFather ? parent : partner
    child.familyName = source.familyName
    child.familyId = source.familyId
    FamilySystem._applyTraits(child)
  }

  /**
   * 성씨 ID로 성씨 이름을 반환합니다.
   * @param {number} id
   * @returns {string}
   */
  static getNameById(id) {
    return FAMILY_NAMES[id] || '무명'
  }

  /**
   * 전체 성씨 목록 반환 (Inspector 역변환용)
   */
  static getFamilyNames() {
    return FAMILY_NAMES
  }

  /**
   * 성씨별 특성 보너스를 크리쳐 스탯에 적용합니다.
   * @param {Creature} creature
   */
  static _applyTraits(creature) {
    const trait = FAMILY_TRAITS[creature.familyName]
    if (!trait) return
    if (trait.workEfficiencyBonus) creature.workEfficiency += trait.workEfficiencyBonus
    if (trait.speedBonus) creature.speed += trait.speedBonus
    if (trait.attackPowerBonus) creature.attackPower += trait.attackPowerBonus
  }
}
