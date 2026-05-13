import ObjectPool from '../../utils/ObjectPool.js';
import Transform from '../../components/motion/Transform.js';
import Velocity from '../../components/motion/Velocity.js';
import BaseStats from '../../components/stats/BaseStats.js';
import Health from '../../components/stats/Health.js';
import Visual from '../../components/render/Visual.js';
import State from '../../components/behavior/State.js';
import Age from '../../components/stats/Age.js';
import JobController from '../../components/behavior/JobController.js';

// Factories
import AnimalFactory from '../entities/AnimalFactory.js';
import HumanFactory from '../entities/HumanFactory.js';
import ItemFactory from '../entities/ItemFactory.js';
import NatureFactory from '../entities/NatureFactory.js';
import ResourceFactory from '../entities/ResourceFactory.js';
import BuildingFactory from '../entities/BuildingFactory.js';
import FenceFactory from '../entities/FenceFactory.js';
import Fence from '../../components/civilization/Fence.js';

/**
 * 🏭 FactoryProvider
 * 
 * 1. 엔티티 생성에 필요한 모든 컴포넌트들의 풀(Pool)을 관리합니다. (DOD 최적화)
 * 2. 다양한 도메인 팩토리(Animal, Human 등)를 등록하고 중앙 스폰 인터페이스를 제공합니다.
 */
class FactoryProvider {
    constructor() {
        this.engine = null;
        this.pools = new Map();
        this.factories = new Map();
        this._initPools();
    }

    /** 🚀 [Expert Optimization] 엔진 주입 및 팩토리 초기화 */
    init(engine) {
        this.engine = engine;
        
        // 도메인 팩토리 등록
        this.factories.set('animal', new AnimalFactory(engine));
        this.factories.set('human', new HumanFactory(engine));
        this.factories.set('resource', new ResourceFactory(engine)); // 🪨 광물/천연 자원 노드
        this.factories.set('item', new ItemFactory(engine));         // 📦 바닥에 떨어진 수집용 아이템
        this.factories.set('nature', new NatureFactory(engine));
        this.factories.set('building', new BuildingFactory(engine));
        this.factories.set('fence', new FenceFactory(engine));
        this.factories.set('material', new ResourceFactory(engine)); // Alias
    }

    _initPools() {
        this.pools.set('Transform', new ObjectPool(() => new Transform(), (c) => c.reset?.(), 100));
        this.pools.set('Velocity', new ObjectPool(() => new Velocity(), (c) => c.reset?.(), 100));
        this.pools.set('BaseStats', new ObjectPool(() => new BaseStats(), (c) => c.reset?.(), 100));
        this.pools.set('Health', new ObjectPool(() => new Health(), (c) => c.reset?.(), 100));
        this.pools.set('Visual', new ObjectPool(() => new Visual(), (c) => c.reset?.(), 100));
        this.pools.set('AIState', new ObjectPool(() => new State(), (c) => c.reset?.(), 100));
        this.pools.set('Age', new ObjectPool(() => new Age(), (c) => c.reset?.(), 100));
        this.pools.set('JobController', new ObjectPool(() => new JobController(), (c) => c.clearJob?.(), 100));
        this.pools.set('Fence', new ObjectPool(() => new Fence(), (c) => c.reset?.(), 500)); // 울타리는 개수가 많으므로 풀 크기 상향
    }

    /** 🚀 [Expert Interface] 중앙 스폰 브릿지 */
    spawn(category, type, x, y, options = {}) {
        const factory = this.factories.get(category.toLowerCase());
        if (!factory) {
            console.error(`Factory for category '${category}' not found.`);
            return null;
        }
        return factory.create(type, x, y, options);
    }

    getFactory(category) {
        return this.factories.get(category.toLowerCase());
    }

    /**
     * 특정 타입의 컴포넌트를 풀에서 가져옵니다.
     */
    getComponent(type, options = {}) {
        const pool = this.pools.get(type);
        if (!pool) return null;

        const component = pool.get();
        if (options && typeof options === 'object') {
            Object.assign(component, options);
        }
        return component;
    }

    /**
     * 사용이 끝난 컴포넌트를 풀에 반환합니다.
     */
    releaseComponent(type, component) {
        const pool = this.pools.get(type);
        if (pool) pool.release(component);
    }
}

export const factoryProvider = new FactoryProvider();
export default factoryProvider;
