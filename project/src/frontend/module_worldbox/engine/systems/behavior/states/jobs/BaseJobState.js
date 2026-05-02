import State from '../State.js';

export default class BaseJobState extends State {
    constructor(system) {
        super(system);
    }

    // 하위 클래스에서 오버라이드
    enter(entityId, entity) { }
    
    // 하위 클래스에서 오버라이드
    update(entityId, entity, dt) { return null; }
    
    // 하위 클래스에서 오버라이드
    exit(entityId, entity) { }

    // 공통 유틸리티: 구역 이탈 체크
    checkOutOfBounds(entity) {
        const jobCtrl = entity.components.get('JobController');
        const transform = entity.components.get('Transform');
        if (!jobCtrl || !jobCtrl.zoneId || !transform) return false;

        const zoneManager = this.system.engine.systems.find(s => s.constructor.name === 'ZoneManager');
        if (!zoneManager) return false;

        const zone = zoneManager.getZone(jobCtrl.zoneId);
        if (!zone) return false;

        return !zone.contains(transform.x, transform.y);
    }
}
