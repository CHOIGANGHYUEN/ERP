import System from '../../core/System.js';

/**
 * 😊 EmotionSystem
 * 환경 요인에 따른 인간의 감정(행복도, 스트레스) 변화를 처리합니다.
 */
export default class EmotionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
    }

    update(dt, time) {
        const entities = this.entityManager.getEntitiesByComponent('Emotion');
        for (const entity of entities) {
            this.processEmotion(entity, dt);
        }
    }

    processEmotion(entity, dt) {
        const emotion = entity.components.get('Emotion');
        const stats = entity.components.get('BaseStats');
        const housing = entity.components.get('Housing');

        if (!emotion || !stats) return;

        // 1. 기본 감정 쇠퇴 (서서히 중립으로 회복)
        if (emotion.happiness > 50) emotion.happiness -= dt * 0.1;
        if (emotion.happiness < 50) emotion.happiness += dt * 0.1;

        // 2. 허기에 따른 스트레스 증가
        if (stats.hunger < 30) {
            emotion.stress += dt * 0.5;
            emotion.happiness -= dt * 0.5;
        }

        // 3. 거주지 효과 (집이 있으면 안정감)
        if (housing) {
            emotion.happiness += dt * 0.2;
            emotion.stress -= dt * 0.3;
        } else {
            emotion.stress += dt * 0.1; // 노숙 중이면 스트레스 누적
        }

        // 수치 캡핑 및 상태 갱신
        emotion.happiness = Math.max(0, Math.min(100, emotion.happiness));
        emotion.stress = Math.max(0, Math.min(100, emotion.stress));
        emotion.calculateMood();
    }
}
