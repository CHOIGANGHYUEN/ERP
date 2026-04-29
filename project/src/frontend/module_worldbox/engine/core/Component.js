/**
 * 🧩 Base Component Class
 * 
 * ECS 원칙 절대 준수: 
 * Component는 오직 상태(데이터)만 가져야 하며, 비즈니스 로직(메서드)을 포함해서는 안 됩니다.
 * 향후 JSON 직렬화(Serialization)를 통해 상태 저장/불러오기가 가능하도록 순수 데이터 객체 형태를 유지합니다.
 */
export default class Component {
    constructor(type) {
        this.type = type;
    }
    serialize() {
        return { ...this };
    }
}