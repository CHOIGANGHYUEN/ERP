import AStarSearch from './pathfinding/AStarSearch.js';
import HPAClusterManager from './pathfinding/HPAClusterManager.js';
import PathRequestQueue from './pathfinding/PathRequestQueue.js';
import PathFollower from './pathfinding/PathFollower.js';

/**
 * 🚀 Pathfinder (Facade)
 * 길찾기 시스템의 통합 인터페이스입니다.
 * 리팩토링을 통해 내부 로직을 전문 모듈(A*, HPA*, Queue, Follower)로 분리하였습니다.
 * 기존의 static API를 유지하여 외부 시스템과의 호환성을 보장합니다.
 */
class PathfinderFacade {
    constructor() {
        this.pathCountThisFrame = 0;
        this.lastFrameTime = 0;
        this.MAX_PATHS_PER_FRAME = 15;

        // 🗺️ [HPA*] Shared State
        this.clusters = new Map();
        this.clusterSize = 100;
        this.abstractNodes = new Map();
        this.dirtyClusters = new Set();
        this._isRebuildPending = false;
        this._isWorkerRebuilding = false;
        this._lastRebuildTime = 0;
        this.tileCostOverrides = new Map();

        // 🚀 전문 모듈 초기화
        this.clusterManager = new HPAClusterManager(this);
        this.requestQueue = new PathRequestQueue(this);
        this.follower = new PathFollower(this);
    }

    // 🕊️ [Shortcuts to Shared Data]
    get pathCache() { return this.requestQueue.cache; }
    get pathPointPool() { return this.requestQueue.pointPool; }
    get pathArrayPool() { return this.requestQueue.arrayPool; }

    // 🧠 [A* Delegates]
    findPath(sx, sy, ex, ey, engine, gridSize = 10, bypassThrottle = false) {
        return AStarSearch.findPath(sx, sy, ex, ey, engine, gridSize, bypassThrottle, this);
    }

    findPathToZone(sx, sy, zoneBounds, engine, gridSize = 10) {
        return AStarSearch.findPathToZone(sx, sy, zoneBounds, engine, gridSize, this);
    }

    isLineBlocked(x1, y1, x2, y2, engine) {
        return AStarSearch.isLineBlocked(x1, y1, x2, y2, engine);
    }

    // 🗺️ [HPA* Delegates]
    initHierarchy(engine) { return this.clusterManager.initHierarchy(engine); }
    rebuildAllTransitions(engine) { return this.clusterManager.rebuildAllTransitions(engine); }
    updateHierarchy(engine) { return this.clusterManager.updateHierarchy(engine); }
    applyRebuiltGraph(payload) { return this.clusterManager.applyRebuiltGraph(payload); }
    findAbstractPath(sx, sy, ex, ey, engine) { return this.clusterManager.findAbstractPath(sx, sy, ex, ey, engine); }
    findHierarchicalPath(sx, sy, ex, ey, engine) { return this.clusterManager.findHierarchicalPath(sx, sy, ex, ey, engine); }
    
    markClusterDirty(x, y) {
        const cx = Math.floor(x / this.clusterSize);
        const cy = Math.floor(y / this.clusterSize);
        const id = `${cx},${cy}`;
        this.dirtyClusters.add(id);
        this._isRebuildPending = true;
        this.invalidateCache();
    }

    setTileCost(tx, ty, cost) {
        const key = (ty << 16) | tx;
        if (!Number.isFinite(cost) || cost >= 1) {
            this.tileCostOverrides.delete(key);
        } else {
            this.tileCostOverrides.set(key, Math.max(0.1, cost));
        }
        this.invalidateCache();
    }

    getMovementCost(x, y, engine) {
        const roadCost = engine?.systemManager?.roadNetwork?.getCostAt?.(x, y);
        if (roadCost && roadCost < 1) return roadCost;

        const tx = Math.floor(x / 16);
        const ty = Math.floor(y / 16);
        return this.tileCostOverrides.get((ty << 16) | tx) || 1;
    }

    // ⚙️ [Queue & Memory Delegates]
    requestPath(entityId, state, sx, sy, ex, ey, engine, callback) {
        this.requestQueue.requestPath(entityId, state, sx, sy, ex, ey, engine, callback);
    }

    processQueue() {
        this.requestQueue.processQueue();
    }

    releasePath(path) {
        this.requestQueue.releasePath(path);
    }

    invalidateCache() {
        this.requestQueue.invalidateCache();
    }

    // 🚶 [Movement Delegate]
    followPath(transform, state, targetPos, speed, engine, targetRadius = 12, recalcIntervalOverride = null, targetIdOverride = null, velocity = null) {
        return this.follower.followPath(transform, state, targetPos, speed, engine, targetRadius, recalcIntervalOverride, targetIdOverride, velocity);
    }
}

// 🌐 [Singleton] 글로벌 인스턴스 생성 및 Static Wrapper 제공
const instance = new PathfinderFacade();

export default class Pathfinder {
    static get pathCountThisFrame() { return instance.pathCountThisFrame; }
    static set pathCountThisFrame(v) { instance.pathCountThisFrame = v; }
    static get lastFrameTime() { return instance.lastFrameTime; }
    static set lastFrameTime(v) { instance.lastFrameTime = v; }
    static get MAX_PATHS_PER_FRAME() { return instance.MAX_PATHS_PER_FRAME; }

    static findPath(...args) { return instance.findPath(...args); }
    static findPathToZone(...args) { return instance.findPathToZone(...args); }
    static isLineBlocked(...args) { return instance.isLineBlocked(...args); }
    
    static initHierarchy(...args) { return instance.initHierarchy(...args); }
    static updateHierarchy(...args) { return instance.updateHierarchy(...args); }
    static markClusterDirty(...args) { return instance.markClusterDirty(...args); }
    static applyRebuiltGraph(...args) { return instance.applyRebuiltGraph(...args); }
    static setTileCost(...args) { return instance.setTileCost(...args); }
    static getMovementCost(...args) { return instance.getMovementCost(...args); }
    
    static requestPath(...args) { return instance.requestPath(...args); }
    static processQueue() { instance.processQueue(); }
    static releasePath(...args) { instance.releasePath(...args); }
    static invalidateCache() { instance.invalidateCache(); }
    
    static followPath(...args) { return instance.followPath(...args); }
    
    // Internal state access for modules
    static get clusters() { return instance.clusters; }
    static get abstractNodes() { return instance.abstractNodes; }
}
