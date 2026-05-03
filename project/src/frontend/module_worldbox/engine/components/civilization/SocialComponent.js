/**
 * 👫 SocialComponent
 * 개체의 사회적 관계(배우자, 가족 등)를 관리합니다.
 */
export default class SocialComponent {
    constructor() {
        this.partnerId = null;
        this.isMarried = false;
        this.marriageDate = 0;
        this.childrenIds = new Set();
        this.attractiveness = Math.random() * 100;
        this.lastSocialInteraction = 0;
    }
}
