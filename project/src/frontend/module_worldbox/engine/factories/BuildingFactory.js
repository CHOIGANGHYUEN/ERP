export default class BuildingFactory {
    constructor(engine) {
        this.engine = engine;
    }

    createBlueprint(type, x, y, villageId = -1) {
        const em = this.engine.entityManager;
        const config = this.engine.buildingsConfig[type];
        if (!config) return null;

        const id = em.createEntity();
        const entity = em.entities.get(id);

        entity.components.set('Transform', { x, y, width: config.width || 10, height: config.height || 10 });
        
        entity.components.set('Structure', {
            type: type,
            progress: 0,
            maxProgress: config.maxProgress || 100,
            isComplete: false,
            hp: config.maxHp || 100,
            maxHp: config.maxHp || 100,
            villageId: villageId
        });

        // 청사진 상태를 표시하기 위한 렌더링 컴포넌트
        entity.components.set('Visual', {
            type: 'blueprint',
            buildingType: type,
            color: 'rgba(255, 255, 255, 0.5)', // 투명하게 표시
            width: config.width || 10,
            height: config.height || 10
        });

        return id;
    }

    completeBuilding(entityId) {
        const entity = this.engine.entityManager.entities.get(entityId);
        if (!entity) return;

        const structure = entity.components.get('Structure');
        const visual = entity.components.get('Visual');
        if (structure && visual) {
            structure.isComplete = true;
            const config = this.engine.buildingsConfig[structure.type];
            visual.type = 'building';
            visual.color = config ? config.color : '#aaaaaa'; // 완성된 건물의 색상
        }
    }
}
