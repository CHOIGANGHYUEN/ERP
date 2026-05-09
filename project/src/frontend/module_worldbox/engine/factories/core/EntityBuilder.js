import { factoryProvider } from './FactoryProvider.js';

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
        const transform = factoryProvider.getComponent('Transform', { x, y });
        transform.vx = 0;
        transform.vy = 0;
        return this.addComponent('Transform', transform);
    }

    /** 🚀 [DOD Support] 이동 가능 개체를 위한 벨로시티 컴포넌트 추가 */
    withVelocity(vx = 0, vy = 0) {
        return this.addComponent('Velocity', factoryProvider.getComponent('Velocity', { vx, vy }));
    }

    withVisual(options) {
        return this.addComponent('Visual', factoryProvider.getComponent('Visual', options));
    }

    withStats(options) {
        return this.addComponent('BaseStats', factoryProvider.getComponent('BaseStats', options));
    }

    withHealth(maxHp) {
        return this.addComponent('Health', factoryProvider.getComponent('Health', { currentHp: maxHp, maxHp }));
    }

    withAIState(options = {}) {
        return this.addComponent('AIState', factoryProvider.getComponent('AIState', options));
    }

    withAge(options) {
        return this.addComponent('Age', factoryProvider.getComponent('Age', options));
    }

    withJobController(options = {}) {
        return this.addComponent('JobController', factoryProvider.getComponent('JobController', options));
    }

    build() {
        return this.id;
    }
}
