import System from '../../core/System.js';
import FenceRenderer from '../../objects/renders/building/FenceRenderer.js';

/**
 * 🧱 FenceSystem
 * 울타리의 연결 상태(Auto-tiling)와 지형 통행성(HPA*)을 관리합니다.
 */
export default class FenceSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        
        // 울타리 설치/제거 이벤트 리스너
        this.eventBus.on('ENTITY_SPAWNED', (data) => this.onEntityCreated(data));
        this.eventBus.on('BUILDING_SPAWNED', (data) => this.onEntityCreated(data));
        this.eventBus.on('ENTITY_REMOVED', (data) => this.onEntityRemoved(data));
        this.eventBus.on('BUILDING_COMPLETE', (data) => this.onBuildingComplete(data));
    }

    onBuildingComplete(data) {
        const entity = this.entityManager.entities.get(data.id);
        if (entity) {
            const fence = entity.components.get('Fence');
            const building = entity.components.get('Building');
            const isGate = building && building.type === 'fence_gate';

            if (fence) {
                const visual = entity.components.get('Visual');
                fence.isBlueprint = false;
                if (visual) visual.isBlueprint = false;
                this.updatePathfinder(entity, true);
                this.updateNeighbors(entity);
            } else if (isGate) {
                const transform = entity.components.get('Transform');
                if (transform) this.updateNeighborsAt(transform.x, transform.y);
            }
        }
    }

    onEntityCreated(data) {
        const entity = this.entityManager.entities.get(data.id);
        if (entity) {
            const isFence = entity.components.has('Fence');
            const building = entity.components.get('Building');
            const isGate = building && building.type === 'fence_gate';

            if (isFence || isGate) {
                // 울타리인 경우 본인 및 주변 갱신
                if (isFence) {
                    this.updateNeighbors(entity);
                    const fence = entity.components.get('Fence');
                    if (!fence.isBlueprint) this.updatePathfinder(entity, true);
                } else {
                    // 문인 경우 주변 울타리들만 갱신 유도
                    const transform = entity.components.get('Transform');
                    if (transform) this.updateNeighborsAt(transform.x, transform.y);
                }
            }
        }
    }

    onEntityRemoved(data) {
        if (data.type === 'fence' || data.type === 'fence_gate') {
            this.updateNeighborsAt(data.x, data.y);
            this.updatePathfinderAt(data.x, data.y, false);
        }
    }

    /** 🔗 주변 울타리 연결 상태 동기화 */
    updateNeighbors(entity) {
        const transform = entity.components.get('Transform');
        const fence = entity.components.get('Fence');
        if (!transform || !fence) return;

        // 본인 연결 상태 계산
        fence.connections = FenceRenderer.calculateConnections(entity.id, transform.x, transform.y, this.engine.spatialHash, this.entityManager);

        // 주변(N, E, S, W) 울타리들도 재계산 유도
        this.updateNeighborsAt(transform.x, transform.y);
    }

    updateNeighborsAt(x, y) {
        const spacing = 32;
        const directions = [[0, -spacing], [spacing, 0], [0, spacing], [-spacing, 0]];
        
        for (const [dx, dy] of directions) {
            const nearby = this.engine.spatialHash.query(x + dx, y + dy, 5);
            for (const nid of nearby) {
                const ent = this.entityManager.entities.get(nid);
                const fence = ent?.components.get('Fence');
                if (fence) {
                    const trans = ent.components.get('Transform');
                    fence.connections = FenceRenderer.calculateConnections(nid, trans.x, trans.y, this.engine.spatialHash, this.entityManager);
                }
            }
        }
    }

    /** 🗺️ Pathfinder HPA* 그래프 업데이트 */
    updatePathfinder(entity, isObstacle) {
        const transform = entity.components.get('Transform');
        if (transform) {
            this.updatePathfinderAt(transform.x, transform.y, isObstacle);
        }
    }

    updatePathfinderAt(x, y, isObstacle) {
        const pf = this.engine.systemManager?.pathfinder;
        if (pf) {
            // 울타리는 32x32 타일 하나를 차지한다고 가정
            const tx = Math.floor(x / 32);
            const ty = Math.floor(y / 32);
            
            // 지형 통행성 변경 알림 (HPA* 클러스터 더티 마킹)
            if (this.engine.terrainGen) {
                this.engine.terrainGen.setOccupancy(tx, ty, isObstacle ? 2 : 0);
                if (pf.markClusterDirty) pf.markClusterDirty(tx, ty);
            }
        }
    }

    update(dt) {
        // 울타리 상태 체크 (파괴 등)
        const items = this.entityManager.entities; // 효율적인 필터링 필요 시 최적화
        // 여기서는 ENTITY_REMOVED 이벤트가 처리하므로 매 프레임 루프는 불필요
    }
}
