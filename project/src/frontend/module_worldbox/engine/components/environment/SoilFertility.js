/**
 * 토양의 비옥도를 나타내는 컴포넌트.
 */
export default class SoilFertility {
    constructor(value = 0) {
        this.value = value; // 0 (척박함) ~ 1 (매우 비옥함)
    }
}