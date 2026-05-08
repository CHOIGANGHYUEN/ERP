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
        this.lastBirth = 0;
        this.isBreeding = false;
        this.breedingTimer = 0;
        this.loyalty = 70;
        this.nationId = -1;
        this.villageId = -1;
        this.diplomacy = [];
        this.lastDiplomacySync = 0;
        // 👑 [Task 57] 지도자 아우라 버프
        this.workSpeedBuff = 1.0;    // 작업 속도 배율 (1.0 = 보통)
        this.workSpeedBuffExpiry = 0; // 버프 만료 시간 (ms)
    }

    /** 현재 작업 속도 배율을 반환합니다. 버프 만료 시 자동으로 1.0으로 원식됩니다. */
    getWorkSpeedBuff() {
        if (Date.now() > this.workSpeedBuffExpiry) {
            this.workSpeedBuff = 1.0; // 만료 시 자동 일반화
        }
        return this.workSpeedBuff;
    }
}
