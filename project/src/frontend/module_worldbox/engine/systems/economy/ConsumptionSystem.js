import System from '../../core/System.js';

export default class ConsumptionSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
    }

    update(dt, time) {
        // TODO: 인간(Human) 등 인벤토리를 가지는 개체가 포만감 저하 시 보관된 식량을 자체 소비하는 로직 구현 예정 (Phase 5)
    }
}
