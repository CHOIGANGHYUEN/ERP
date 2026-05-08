/**
 * 💹 EconomyManager.js
 * 전역 자원 흐름과 창고 재고를 관리하는 시스템입니다.
 * 물류의 불균형을 해소하기 위한 태스크를 생성합니다.
 */
export default class EconomyManager {
    constructor(entityManager, eventBus, blackboard) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.blackboard = blackboard;
        this.transportTasks = [];
        this.blueprints = [];
        this.updateTimer = 0;
    }

    /**
     * 1초에 한 번씩 물류 상태를 점검 (저주기 업데이트)
     */
    update(dt) {
        this.updateTimer += dt;
        // 첫 업데이트이거나 1초가 지났을 때 갱신
        if (this.updateTimer >= 1.0 || this.blackboard.storages.length === 0) {
            this.updateTimer = 0;
            this._refreshStorageCache();
            this._analyzeResourceBalance();
        }
    }

    processNationalTributeAndDistribution(nationSystem, villageSystem) {
        if (!nationSystem || !villageSystem) return null;
        const ledger = [];
        const resourceTypes = ['food', 'wood', 'stone', 'gold'];

        for (const nation of nationSystem.nations.values()) {
            if (!nation.resources) nation.resources = { wood: 0, food: 0, stone: 0, gold: 0 };
            const villageList = Array.from(nation.villages || [])
                .map(id => villageSystem.getVillage(id))
                .filter(Boolean);

            for (const village of villageList) {
                village.resources = village.resources || {};
                village.resourceNeeds = village.resourceNeeds || {};

                for (const type of resourceTypes) {
                    const current = village.resources[type] || 0;
                    const reserve = Math.max(20, (village.resourceNeeds[type] || 0) * 1.4);
                    if (current <= reserve) continue;

                    const tribute = Math.min(current - reserve, Math.max(1, current * 0.08));
                    const taken = this._withdrawFromVillage(village, type, tribute);
                    if (taken <= 0) continue;

                    nation.resources[type] = (nation.resources[type] || 0) + taken;
                    village.resources[type] = Math.max(0, (village.resources[type] || 0) - taken);
                    ledger.push({ nationId: nation.id, villageId: village.id, type, amount: taken, direction: 'tribute' });
                }
            }

            for (const village of villageList) {
                for (const type of resourceTypes) {
                    const current = village.resources?.[type] || 0;
                    const need = village.resourceNeeds?.[type] || 0;
                    if (need <= 0 || current >= need || (nation.resources[type] || 0) <= 0) continue;

                    const grant = Math.min(need - current, nation.resources[type], 35);
                    const added = this._depositToVillage(village, type, grant);
                    if (added <= 0) continue;

                    nation.resources[type] -= added;
                    village.resources[type] = (village.resources[type] || 0) + added;
                    ledger.push({ nationId: nation.id, villageId: village.id, type, amount: added, direction: 'grant' });
                }
            }

            nation.tributeLedger = ledger.filter(entry => entry.nationId === nation.id).slice(-20);
        }

        return ledger;
    }

    _withdrawFromVillage(village, type, amount) {
        let remaining = amount;
        if (!village.storageIds) return 0;
        for (const storageId of village.storageIds) {
            const storageEnt = this.entityManager.entities.get(storageId);
            const storage = storageEnt?.components.get('Storage');
            if (!storage) continue;
            remaining -= storage.withdraw(type, remaining);
            if (remaining <= 0) break;
        }
        return amount - remaining;
    }

    _depositToVillage(village, type, amount) {
        if (!village.storageIds || village.storageIds.size === 0) return 0;
        let remaining = amount;
        for (const storageId of village.storageIds) {
            const storageEnt = this.entityManager.entities.get(storageId);
            const storage = storageEnt?.components.get('Storage');
            if (!storage) continue;
            remaining -= storage.addItem(type, remaining);
            if (remaining <= 0) break;
        }
        return amount - remaining;
    }

    /**
     * Blackboard에 최신 창고 정보를 갱신
     */
    _refreshStorageCache() {
        const storages = [];
        const resourceNodes = new Map();
        let totalFound = 0;

        for (const [id, entity] of this.entityManager.entities) {
            const transform = entity.components.get('Transform');
            if (!transform) continue;

            // 창고 캐싱
            const storage = entity.components.get('Storage');
            if (storage) {
                storages.push({
                    id,
                    x: transform.x,
                    y: transform.y,
                    items: { ...storage.items },
                    isFull: storage.isFull
                });
            }

            // 자원 노드 캐싱 (Resource 및 DroppedItem 통합 지원)
            const res = entity.components.get('Resource');
            const drop = entity.components.get('DroppedItem');
            
            if ((res && res.value > 0 && !res.isFalling) || drop) {
                let type = (res?.type || drop?.itemType || 'unknown').toLowerCase();
                
                // 🍎 [Normalization] AI가 요청하는 표준 카테고리로 매핑
                if (type.includes('tree') || type === 'wood') {
                    type = 'wood';
                } else if (type === 'berry' || type === 'fruit' || type === 'wheat' || type === 'plant' || type === 'grass' || type === 'flower') {
                    type = 'food';
                } else if (type.includes('stone') || type === 'rock') {
                    type = 'stone';
                } else if (type.includes('iron') || type === 'iron_ore') {
                    type = 'iron_ore';
                } else if (type.includes('gold') || type === 'gold_ore') {
                    type = 'gold_ore';
                }

                if (!resourceNodes.has(type)) resourceNodes.set(type, []);
                resourceNodes.get(type).push({
                    id,
                    x: transform.x,
                    y: transform.y
                });
                totalFound++;
            }

            // 🏗️ 청사진 캐싱 (건설 AI용)
            const structure = entity.components.get('Structure');
            if (structure && structure.isBlueprint && !structure.isComplete) {
                this.blueprints.push({
                    id,
                    type: structure.type,
                    progress: structure.progress
                });
            }
        }
        
        this.blackboard.updateStorages(storages);
        this.blackboard.blueprints = this.blueprints || []; // 블랙보드에 청사진 정보 주입
        this.blueprints = []; // 다음 업데이트를 위해 클리어
        for (const [type, nodes] of resourceNodes) {
            this.blackboard.updateResourceNodes(type.toLowerCase(), nodes);
        }

        if (totalFound > 0) {
            // console.log(`[EconomyManager] Cached ${totalFound} resources in ${resourceNodes.size} categories.`);
        }
    }

    /**
     * 창고 간 자원 불균형을 분석하고 운반 태스크 생성
     */
    _analyzeResourceBalance() {
        const storages = this.blackboard.storages;
        if (storages.length < 2) return;

        // 📦 [Balance Fix] 운반 대상 자원 종류 확대
        const resourceTypes = ['wood', 'stone', 'food', 'iron_ore'];

        for (const type of resourceTypes) {
            let overstocked = storages.filter(s => (s.items[type] || 0) > 100); // 100개 이상이면 과적
            let shortage = storages.filter(s => (s.items[type] || 0) < 20);    // 20개 미만이면 부족

            for (const source of overstocked) {
                for (const dest of shortage) {
                    // 이미 같은 목적지로 가는 태스크가 있는지 확인
                    if (!this.transportTasks.find(t => t.destId === dest.id && t.resourceType === type)) {
                        this._createTransportTask(source.id, dest.id, type, 50);
                    }
                }
            }
        }
    }

    _createTransportTask(sourceId, destId, resourceType, amount) {
        const task = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            sourceId,
            destId,
            resourceType,
            amount,
            assignedEntityId: null,
            status: 'PENDING'
        };
        this.transportTasks.push(task);
        // [Optimization] Logistics log removed to reduce console noise. 
        // Can be moved to GlobalLogger if user wants to monitor trade specifically.
    }

    /**
     * 운반자 AI가 수행할 태스크를 요청할 때 호출
     */
    getAvailableTask(entityId) {
        const task = this.transportTasks.find(t => t.status === 'PENDING');
        if (task) {
            task.status = 'ASSIGNED';
            task.assignedEntityId = entityId;
            return task;
        }
        return null;
    }

    completeTask(taskId) {
        this.transportTasks = this.transportTasks.filter(t => t.id !== taskId);
    }

    cancelTask(taskId) {
        const task = this.transportTasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'PENDING';
            task.assignedEntityId = null;
        }
    }
}
