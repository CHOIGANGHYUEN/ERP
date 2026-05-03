import AnimalFactory from '../entities/AnimalFactory.js';
import HumanFactory from '../entities/HumanFactory.js';
import NatureFactory from '../entities/NatureFactory.js';
import ResourceFactory from '../entities/ResourceFactory.js';
import BuildingFactory from '../entities/BuildingFactory.js';
import ToolFactory from '../entities/ToolFactory.js';
import ItemFactory from '../entities/ItemFactory.js';

/**
 * 🏢 FactoryProvider
 * 객체 타입에 따라 적절한 팩토리를 매핑하고 반환하는 중앙 레지스트리입니다.
 * 개방-폐쇄 원칙(OCP)과 의존성 역전 원칙(DIP)을 준수합니다.
 */
export default class FactoryProvider {
    constructor(engine) {
        this.engine = engine;
        this.factories = new Map();
        
        // 🚀 초기 팩토리 등록
        this._registerDefaultFactories();
    }

    _registerDefaultFactories() {
        this.register('animal', new AnimalFactory(this.engine));
        this.register('human', new HumanFactory(this.engine));
        this.register('nature', new NatureFactory(this.engine));
        this.register('resource', new ResourceFactory(this.engine));
        this.register('building', new BuildingFactory(this.engine));
        this.register('tool', new ToolFactory(this.engine));
        this.register('item', new ItemFactory(this.engine));
    }

    /** 새 팩토리를 동적으로 등록 (OCP 준수) */
    register(category, factory) {
        this.factories.set(category, factory);
    }

    /** 카테고리에 맞는 팩토리 반환 */
    getFactory(category) {
        const factory = this.factories.get(category);
        if (!factory) {
            console.error(`Factory for category '${category}' not found.`);
            return null;
        }
        return factory;
    }

    /** 편의 메서드: 카테고리와 타입을 지정하여 즉시 생성 */
    spawn(category, type, x, y, options = {}) {
        const factory = this.getFactory(category);
        return factory ? factory.create(type, x, y, options) : null;
    }
}
