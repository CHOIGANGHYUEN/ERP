import System from '../../core/System.js';
import { GlobalLogger } from '../../utils/Logger.js';
/**
 * 🌾 FarmingSystem
 * 농장 타일 내 작물의 성장과 관리를 담당합니다.
 */
export default class FarmingSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.growthTick = 0;
    }

    update(dt, time) {
        this.growthTick += dt;
        if (this.growthTick < 5.0) return; // 5초마다 성장 업데이트
        this.growthTick = 0;

        const em = this.entityManager;
        // 🚀 [Expert Optimization] 진행 중인 농장만 담긴 activeFarmIds 인덱스 활용 (O(Building) -> O(Farm))
        for (const id of em.activeFarmIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const farm = entity.components.get('Farm');
            if (farm) {
                this.processFarm(id, entity, farm);
            }
        }
    }

    processFarm(id, entity, farm) {
        const storage = entity.components.get('Storage');
        const transform = entity.components.get('Transform');
        const structure = entity.components.get('Structure');

        // 건설이 완료된 농장만 작동
        if (!farm || !transform || (structure && !structure.isComplete)) return;

        // 🚜 [System Decoupling] 농부가 씨앗을 뿌린 상태(isSeeded)여야만 성장이 진행됨
        if (!farm.isSeeded) {
            farm.growth = 0;
            return;
        }

        // 지형 비옥도 확인 (0~255)
        const terrain = this.engine.terrainGen;
        const x = Math.floor(transform.x);
        const y = Math.floor(transform.y);
        const fertility = terrain.getFertilityAt ? terrain.getFertilityAt(x, y) : 50;

        // 성장 연산
        if (farm.currentCrops === undefined) farm.currentCrops = 0;
        if (farm.growth === undefined) farm.growth = 0;

        if (farm.currentCrops < (farm.maxCrops || 10)) {
            // 농부가 옆에서 돌봐주고 있으면(isTending) 성장 속도 2배 보너스
            const tendingBonus = farm.isTending ? 2.0 : 1.0;
            const fertilityMult = (fertility / 255) + 0.2; // 비옥도 가중치
            
            farm.growth += (farm.growthRate || 0.05) * fertilityMult * 5 * tendingBonus;

            if (farm.growth >= 100) {
                farm.growth = 0;
                farm.currentCrops++;
                this.eventBus.emit('CROP_GROWN', { id, x: transform.x, y: transform.y });
            }
        }

        // 수확 가능 여부 플래그 업데이트 (농부 AI가 이를 보고 수확하러 옴)
        farm.isHarvestable = farm.currentCrops >= (farm.maxCrops || 10) * 0.8;
    }
}
