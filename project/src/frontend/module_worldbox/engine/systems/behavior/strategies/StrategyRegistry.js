import ResourceTargetStrategy from './ResourceTargetStrategy.js';
import StorageTargetStrategy from './StorageTargetStrategy.js';
import BlueprintTargetStrategy from './BlueprintTargetStrategy.js';

/**
 * 🗃️ StrategyRegistry
 * 타겟 타입에 따른 탐색 전략을 관리하고 반환합니다.
 * 새로운 탐색 로직을 추가할 때 TargetManager를 수정할 필요 없이 여기에 등록만 하면 됩니다 (OCP).
 */
export default class StrategyRegistry {
    static strategies = {
        'RESOURCE': new ResourceTargetStrategy(),
        'STORAGE': new StorageTargetStrategy(),
        'STORAGE_DEPOSIT': new StorageTargetStrategy(),
        'STORAGE_WITHDRAW': new StorageTargetStrategy(),
        'BLUEPRINT': new BlueprintTargetStrategy()
    };

    /**
     * 타겟 타입에 맞는 전략 반환
     */
    static get(targetType) {
        return this.strategies[targetType] || null;
    }

    /**
     * 동적으로 새로운 전략 등록 가능
     */
    static register(targetType, strategy) {
        this.strategies[targetType] = strategy;
    }
}
