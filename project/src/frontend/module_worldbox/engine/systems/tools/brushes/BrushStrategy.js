/**
 * 🖌️ BrushStrategy (Base Interface)
 * 모든 브러쉬 전략의 기본 클래스입니다.
 */
export default class BrushStrategy {
    constructor(engine) {
        this.engine = engine;
    }

    /**
     * 브러쉬를 적용합니다.
     * @param {Object} start {x, y} 이전 그리드 좌표
     * @param {Object} end {x, y} 현재 그리드 좌표
     * @param {number} size 브러쉬 크기
     * @param {Object} toolConfig 도구 설정 (biome, count 등)
     */
    apply(start, end, size, toolConfig) {
        throw new Error('BrushStrategy.apply() must be implemented.');
    }

    /** 도구의 동작 유형에 따라 실제 월드에 반영 (파티클 시스템 연동으로 씨앗 비 효과 복구) */
    _paint(x, y, toolConfig) {
        const payload = { ...toolConfig, x, y };
        
        // 🚀 [Visual Restoration] 즉시 소환 대신 파티클 시스템을 거쳐 착지 후 소환되도록 변경
        if (toolConfig.actionType === 'SPAWN_RESOURCE' || toolConfig.actionType === 'SPAWN_ENTITY') {
            this.engine.dispatchCommand({ type: 'SPAWN_PARTICLES', payload });
        } else {
            this.engine.dispatchCommand({ type: toolConfig.actionType, payload });
        }
    }
}
