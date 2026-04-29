/**
 * 수질을 나타내는 컴포넌트.
 */
export default class WaterQuality {
    constructor(value = 0) {
        this.value = value; // 0 (오염됨) ~ 1 (깨끗함)
    }
}