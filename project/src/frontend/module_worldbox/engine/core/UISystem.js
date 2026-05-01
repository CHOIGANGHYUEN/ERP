import System from "./System";

export default class UISystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine; // Vue UI 콜백(onEntitySelect)과의 임시 브릿지 역할
        this.selectedId = null;

        // EventBus를 통해 사용자의 클릭(Inspect) 명령을 수신합니다.
        this.eventBus.on('INSPECT_REQUEST', (worldPos) => {
            this.handleSelect(worldPos);
        });
    }

    handleSelect(worldPos) {
        let nearest = null;
        let minDist = 30;

        for (const [id, entity] of this.entityManager.entities) {
            const t = entity.components.get('Transform');
            if (t) {
                const dist = Math.sqrt((t.x - worldPos.x) ** 2 + (t.y - worldPos.y) ** 2);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = id;
                }
            }
        }

        this.selectedId = nearest;
        this.eventBus.emit('ENTITY_SELECTED', nearest); // 엔진(렌더러) 쪽에 선택된 ID 전달
        this.syncUI();
    }

    syncUI() {
        if (this.selectedId && this.engine.onEntitySelect) {
            const data = this.getEntityData(this.selectedId);
            if (data) {
                this.engine.onEntitySelect(data);
            } else {
                // 동물이 굶어 죽거나 자원이 파괴되어 사라진 경우 상태창 닫기
                this.selectedId = null;
                this.eventBus.emit('ENTITY_SELECTED', null);
                this.engine.onEntitySelect(null);
            }
        } else if (!this.selectedId && this.engine.onEntitySelect) {
            this.engine.onEntitySelect(null);
        }
    }

    getEntityData(id) {
        const target = this.entityManager.entities.get(id);
        if (!target) return null;

        const m = target.components.get('Metabolism');
        const s = target.components.get('BaseStats'); // 📊 New Stats Component
        const a = target.components.get('Animal');
        const v = target.components.get('Visual');
        const r = target.components.get('Resource');
        const stateComp = target.components.get('AIState');

        let name = 'Unknown';
        let type = v?.type || a?.type || 'unknown';
        let subType = v?.treeType || v?.role || null;
        let state = 'Normal';
        
        // 🧪 [사용자 피드백 반영] 동물의 경우 축적된 영양분(비옥도)을 정확히 매핑
        let fertility = s ? (s.storedFertility || 0) : (m?.storedFertility || r?.storedFertility || 0);
        
        let inhabitants = null;
        let animalYield = null;

        if (type === 'tree') {
            name = subType === 'beehive' ? 'Beehive Tree' : (subType === 'fruit' ? 'Fruit Tree' : 'Tree');
            state = v?.isWithered ? 'Withered' : 'Healthy';

            if (subType === 'beehive') {
                let queen = 0, worker = 0, larva = 0;
                for (const [eId, e] of this.entityManager.entities) {
                    const eAnim = e.components.get('Animal');
                    if (eAnim && eAnim.type === 'bee' && eAnim.hiveId === id) {
                        if (eAnim.role === 'queen') queen++;
                        else if (eAnim.role === 'larva') larva++;
                        else worker++;
                    }
                }
                inhabitants = { queen, worker, larva, honey: Math.floor(r?.honey || 0) };
            }
        } else if (type === 'flower') {
            name = 'Flower';
            state = (v?.quality < 0.4) ? 'Withered' : 'Blooming';
        } else if (r?.isGrass) {
            name = 'Grass';
            type = 'grass';
            state = (v?.quality < 0.4) ? 'Withered' : 'Healthy';
        } else if (a) {
            name = a.type.charAt(0).toUpperCase() + a.type.slice(1);
            if (a.isBaby) name = 'Baby ' + name;
            state = stateComp?.mode || 'wander';

            if (a.type === 'cow') {
                subType = v?.cowType;
                name = subType === 'dairy' ? 'Dairy Cow' : 'Beef Cow';
                if (r) {
                    animalYield = subType === 'dairy' ? `🍼 Milk: ${r.amount} | 🥩 Meat: ${r.meat}` : `🥩 Meat: ${r.amount}`;
                }
            }
        }

        // 📏 UI용 데이터 정규화 (동물의 경우 배설 임계치 15.0 기준)
        const normalizedFertility = a ? Math.min(1.0, fertility / 15.0) : fertility;

        return {
            id: target.id, type: type, subType: subType, name: name, state: state,
            stomach: s ? s.hunger : m?.stomach, 
            maxStomach: s ? 100 : m?.maxStomach, 
            fatigue: s?.fatigue || 0, // 😴 추가된 피로도 수치
            fertility: normalizedFertility,
            quality: v?.quality, inhabitants: inhabitants, resourceValue: r?.value || r?.amount || 0,
            animalYield: animalYield,
            rank: a?.rank
        };
    }

    update(dt, time) {
        // 매 프레임마다 UI 동기화 수행
        if (this.selectedId) {
            this.syncUI();
        }
    }
}