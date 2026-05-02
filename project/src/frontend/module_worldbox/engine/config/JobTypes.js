/**
 * 🏷️ JobTypes
 * 월드박스 시뮬레이션에서 사용되는 직업 열거형 상수 정의
 */
export const JobTypes = Object.freeze({
    UNEMPLOYED:  'unemployed',   // 백수 (기본)
    CHIEF:       'chief',        // 촌장 - 마을 관리 및 직업 분배
    ARCHITECT:   'architect',    // 건축가 - 건물 건설
    LOGGER:      'logger',       // 벌목꾼 - 목재 수집
    GATHERER:    'gatherer',     // 채집가 - 식물/열매 채집
    FARMER:      'farmer',       // 농부 - 농업
    RANCHER:     'rancher',      // 목축업자 - 가축 관리
    HUNTER:      'hunter',       // 사냥꾼 - 동물 사냥
    WARRIOR:     'warrior',      // 전사 - 마을 방어
    MERCHANT:    'merchant',     // 상인 - 자원 교역
    BLACKSMITH:  'blacksmith',   // 대장장이 - 도구 제작
    CARPENTER:   'carpenter',    // 목수 - 목제품 제작
});

/** 직업별 UI 메타데이터 (이모지, 한글명, 색상) */
export const JobMeta = {
    [JobTypes.UNEMPLOYED]: { emoji: '😴', label: '백수',    color: '#9e9e9e' },
    [JobTypes.CHIEF]:      { emoji: '👑', label: '촌장',    color: '#ffc107' },
    [JobTypes.ARCHITECT]:  { emoji: '🏗️', label: '건축가',  color: '#03a9f4' },
    [JobTypes.LOGGER]:     { emoji: '🪓', label: '벌목꾼',  color: '#8d6e63' },
    [JobTypes.GATHERER]:   { emoji: '🧺', label: '채집가',  color: '#66bb6a' },
    [JobTypes.FARMER]:     { emoji: '👨‍🌾', label: '농부',   color: '#a5d6a7' },
    [JobTypes.RANCHER]:    { emoji: '🐄', label: '목축업자', color: '#ffcc80' },
    [JobTypes.HUNTER]:     { emoji: '🏹', label: '사냥꾼',  color: '#ef9a9a' },
    [JobTypes.WARRIOR]:    { emoji: '⚔️', label: '전사',    color: '#ef5350' },
    [JobTypes.MERCHANT]:   { emoji: '💰', label: '상인',    color: '#ffd54f' },
    [JobTypes.BLACKSMITH]: { emoji: '⚒️', label: '대장장이', color: '#b0bec5' },
    [JobTypes.CARPENTER]:  { emoji: '🪚', label: '목수',    color: '#a1887f' },
};
