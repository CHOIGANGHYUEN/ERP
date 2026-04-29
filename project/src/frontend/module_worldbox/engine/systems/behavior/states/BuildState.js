import State from './State.js';

export default class BuildState extends State {
    update(entityId, entity, dt) {
        // 실제 건설 및 자원 소모, 완성도 증가는 ConstructionSystem에서 처리합니다.
        // AI 시스템에서는 단순히 이동만 처리하거나 ConstructionSystem에 온전히 위임할 수 있습니다.
        // 현재 구조에서는 ConstructionSystem이 이동까지 처리하므로 여기서는 빈 상태를 유지합니다.
        // (ConstructionSystem과 역할 분리가 필요하지만 임시로 FSM 상태 전이용 껍데기만 둡니다)
        return null;
    }
}
