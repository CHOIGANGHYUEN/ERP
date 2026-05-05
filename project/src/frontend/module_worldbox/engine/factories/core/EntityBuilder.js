import Transform from '../../components/motion/Transform.js';
import Visual from '../../components/render/Visual.js';

/**
 * 🛠️ EntityBuilder
 * 컴포넌트 조립을 규격화하는 빌더 패턴 유틸리티입니다.
 */
export default class EntityBuilder {
    constructor(entityManager, id) {
        this.em = entityManager;
        this.id = id || this.em.createEntity();
    }

    addComponent(name, component) {
        this.em.addComponent(this.id, component, name);
        return this;
    }

    withTransform(x, y) {
        const transform = new Transform(x, y, this.id, this.em.bufferManager);
        return this.addComponent('Transform', transform);
    }

    withVisual(options) {
        const visual = new Visual(options, this.id, this.em.bufferManager);
        return this.addComponent('Visual', visual);
    }

    build() {
        return this.id;
    }
}
