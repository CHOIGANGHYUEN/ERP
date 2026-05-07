/**
 * 🛠️ BitmaskUtils
 * 
 * 비트 연산을 사용한 고속 데이터 필터링 유틸리티입니다.
 */
export const BitmaskUtils = {
    /**
     * 특정 마스크에 해당 태그가 포함되어 있는지 확인
     */
    has(mask, tag) {
        return (mask & tag) === tag;
    },

    /**
     * 마스크에 새로운 태그 추가
     */
    add(mask, tag) {
        return mask | tag;
    },

    /**
     * 마스크에서 특정 태그 제거
     */
    remove(mask, tag) {
        return mask & ~tag;
    },

    /**
     * 두 마스크가 겹치는 부분이 있는지 확인
     */
    intersects(mask1, mask2) {
        return (mask1 & mask2) !== 0;
    },

    /**
     * 마스크 1이 마스크 2를 완전히 포함하는지 확인 (System 요구사항 체크용)
     */
    matches(mask, required) {
        return (mask & required) === required;
    }
};