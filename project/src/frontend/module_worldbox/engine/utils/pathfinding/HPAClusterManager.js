import { HPACluster } from '../../world/zones/ZoneData.js';
import MinHeap from './MinHeap.js';
import AStarSearch from './AStarSearch.js';

/**
 * 🗺️ HPAClusterManager
 * HPA* 계층적 길찾기 노드망 및 클러스터 관리를 담당합니다.
 * Pathfinder.js에서 SRP에 따라 분리되었습니다.
 */
export default class HPAClusterManager {
    constructor(pathfinderFacade) {
        this.pf = pathfinderFacade;
    }

    initHierarchy(engine) {
        if (!engine || !engine.mapWidth) return;
        
        const w = engine.mapWidth;
        const h = engine.mapHeight;
        const size = this.pf.clusterSize;
        
        const cols = Math.ceil(w / size);
        const rows = Math.ceil(h / size);
        
        this.pf.clusters.clear();
        this.pf.abstractNodes.clear();
        
        console.log(`🗺️ Initializing HPA* Hierarchy: ${cols}x${rows} clusters`);

        for (let cy = 0; cy < rows; cy++) {
            for (let cx = 0; cx < cols; cx++) {
                const id = `${cx},${cy}`;
                const cluster = new HPACluster(
                    id, 
                    cx * size, 
                    cy * size, 
                    Math.min(size, w - cx * size), 
                    Math.min(size, h - cy * size)
                );
                this.pf.clusters.set(id, cluster);
            }
        }

        this.rebuildAllTransitions(engine);
    }

    rebuildAllTransitions(engine) {
        const w = engine.mapWidth;
        const h = engine.mapHeight;
        const size = this.pf.clusterSize;
        const cols = Math.ceil(w / size);
        const rows = Math.ceil(h / size);
        
        if (engine.worker) {
            this.pf._isWorkerRebuilding = true;
            engine.worker.postMessage({
                type: 'REBUILD_HPA_GRAPH',
                payload: { clusterSize: this.pf.clusterSize, mapWidth: w, mapHeight: h }
            });
            return;
        }

        for (let cy = 0; cy < rows; cy++) {
            for (let cx = 0; cx < cols; cx++) {
                if (cx < cols - 1) {
                    this._findTransitionsBetween(cx, cy, cx + 1, cy, 'vertical', engine);
                }
                if (cy < rows - 1) {
                    this._findTransitionsBetween(cx, cy, cx, cy + 1, 'horizontal', engine);
                }
            }
        }
        
        for (const cluster of this.pf.clusters.values()) {
            this._computeIntraEdges(cluster, engine);
        }
    }

    updateHierarchy(engine) {
        if (!this.pf._isRebuildPending || this.pf.dirtyClusters.size === 0) return;

        if (engine.worker) {
            if (this.pf._isWorkerRebuilding) return;
            
            const now = performance.now();
            if (now - (this.pf._lastRebuildTime || 0) < 500) return;
            this.pf._lastRebuildTime = now;

            this.pf._isWorkerRebuilding = true;
            const dirtyIds = Array.from(this.pf.dirtyClusters);
            this.pf.dirtyClusters.clear(); 
            this.pf._isRebuildPending = false;

            engine.worker.postMessage({
                type: 'REBUILD_HPA_GRAPH',
                payload: { 
                    clusterSize: this.pf.clusterSize, 
                    mapWidth: engine.mapWidth, 
                    mapHeight: engine.mapHeight,
                    dirtyClusterIds: dirtyIds 
                }
            });
            return;
        }

        const it = this.pf.dirtyClusters.values();
        const clusterId = it.next().value;
        this.pf.dirtyClusters.delete(clusterId);

        if (this.pf.dirtyClusters.size === 0) this.pf._isRebuildPending = false;

        const cluster = this.pf.clusters.get(clusterId);
        if (!cluster) return;

        console.log(`🔄 Rebuilding HPA* Cluster: ${clusterId}`);
        
        const [cx, cy] = clusterId.split(',').map(Number);
        const cols = Math.ceil(engine.mapWidth / this.pf.clusterSize);
        const rows = Math.ceil(engine.mapHeight / this.pf.clusterSize);

        if (cx > 0) this._findTransitionsBetween(cx - 1, cy, cx, cy, 'vertical', engine);
        if (cx < cols - 1) this._findTransitionsBetween(cx, cy, cx + 1, cy, 'vertical', engine);
        if (cy > 0) this._findTransitionsBetween(cx, cy - 1, cx, cy, 'horizontal', engine);
        if (cy < rows - 1) this._findTransitionsBetween(cx, cy, cx, cy + 1, 'horizontal', engine);

        this._computeIntraEdges(cluster, engine);
        this.pf.invalidateCache();
    }

    _findTransitionsBetween(cx1, cy1, cx2, cy2, orientation, engine) {
        const cluster1 = this.pf.clusters.get(`${cx1},${cy1}`);
        const cluster2 = this.pf.clusters.get(`${cx2},${cy2}`);
        if (!cluster1 || !cluster2) return;

        const tg = engine.terrainGen;
        
        if (orientation === 'vertical') {
            const x1 = cluster1.x + cluster1.width - 1;
            const x2 = cluster2.x;
            const yStart = Math.max(cluster1.y, cluster2.y);
            const yEnd = Math.min(cluster1.y + cluster1.height, cluster2.y + cluster2.height);
            this._scanBoundary(x1, x2, yStart, yEnd, true, cluster1, cluster2, tg);
        } else {
            const y1 = cluster1.y + cluster1.height - 1;
            const y2 = cluster2.y;
            const xStart = Math.max(cluster1.x, cluster2.x);
            const xEnd = Math.min(cluster1.x + cluster1.width, cluster2.x + cluster2.width);
            this._scanBoundary(y1, y2, xStart, xEnd, false, cluster1, cluster2, tg);
        }
    }

    _scanBoundary(fixed1, fixed2, rangeStart, rangeEnd, isVertical, c1, c2, tg) {
        let gapStart = -1;
        for (let i = rangeStart; i < rangeEnd; i++) {
            const p1 = isVertical ? { x: fixed1, y: i } : { x: i, y: fixed1 };
            const p2 = isVertical ? { x: fixed2, y: i } : { x: i, y: fixed2 };
            const canPass = tg.isNavigable(p1.x, p1.y) && tg.isNavigable(p2.x, p2.y);
            if (canPass) {
                if (gapStart === -1) gapStart = i;
            } else {
                if (gapStart !== -1) {
                    this._createGate(gapStart, i - 1, fixed1, fixed2, isVertical, c1, c2);
                    gapStart = -1;
                }
            }
        }
        if (gapStart !== -1) {
            this._createGate(gapStart, rangeEnd - 1, fixed1, fixed2, isVertical, c1, c2);
        }
    }

    _createGate(start, end, f1, f2, isVertical, c1, c2) {
        const mid = Math.floor((start + end) / 2);
        const p1 = isVertical ? { x: f1, y: mid } : { x: mid, y: f1 };
        const p2 = isVertical ? { x: f2, y: mid } : { x: mid, y: f2 };
        const key1 = `${p1.x},${p1.y}`;
        const key2 = `${p2.x},${p2.y}`;
        this._addAbstractEdge(key1, key2, 1.0, c1, c2);
    }

    _addAbstractEdge(k1, k2, weight, c1, c2) {
        if (!this.pf.abstractNodes.has(k1)) this.pf.abstractNodes.set(k1, { neighbors: new Map() });
        if (!this.pf.abstractNodes.has(k2)) this.pf.abstractNodes.set(k2, { neighbors: new Map() });
        this.pf.abstractNodes.get(k1).neighbors.set(k2, weight);
        this.pf.abstractNodes.get(k2).neighbors.set(k1, weight);
        if (c1 !== c2) {
            if (!c1.transitions.has(c2.id)) c1.transitions.set(c2.id, []);
            c1.transitions.get(c2.id).push({ from: k1, to: k2, weight });
            if (!c2.transitions.has(c1.id)) c2.transitions.set(c1.id, []);
            c2.transitions.get(c1.id).push({ from: k2, to: k1, weight });
        }
    }

    _computeIntraEdges(cluster, engine) {
        const nodes = [];
        for (const key of this.pf.abstractNodes.keys()) {
            const [x, y] = key.split(',').map(Number);
            if (x >= cluster.x && x < cluster.x + cluster.width && y >= cluster.y && y < cluster.y + cluster.height) {
                nodes.push(key);
            }
        }
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const k1 = nodes[i], k2 = nodes[j];
                const [x1, y1] = k1.split(',').map(Number), [x2, y2] = k2.split(',').map(Number);
                const path = AStarSearch.findPath(x1, y1, x2, y2, engine, 10, true, this.pf);
                if (path && path.length > 0) this._addAbstractEdge(k1, k2, path.length, cluster, cluster);
            }
        }
    }

    applyRebuiltGraph(payload) {
        const { nodes, clusters, isIncremental } = payload;
        
        if (isIncremental) {
            for (const cId in clusters) {
                const cluster = this.pf.clusters.get(cId);
                if (!cluster) continue;
                
                for (const nodeKey of this.pf.abstractNodes.keys()) {
                    const [nx, ny] = nodeKey.split(',').map(Number);
                    if (nx >= cluster.x && nx < cluster.x + cluster.width && 
                        ny >= cluster.y && ny < cluster.y + cluster.height) {
                        this.pf.abstractNodes.delete(nodeKey);
                    }
                }
            }
        } else {
            this.pf.abstractNodes.clear();
        }

        for (const [k, v] of Object.entries(nodes)) {
            this.pf.abstractNodes.set(k, { neighbors: new Map(v.neighbors) });
        }

        for (const [cId, data] of Object.entries(clusters)) {
            const cluster = this.pf.clusters.get(cId);
            if (!cluster) continue;
            
            cluster.transitions.clear();
            for (const [nId, trans] of Object.entries(data.transitions)) {
                cluster.transitions.set(nId, trans);
            }
            cluster.isDirty = false;
        }

        this.pf.invalidateCache();
        this.pf._isWorkerRebuilding = false;
        console.log(`🗺️ [HPA] Graph ${isIncremental ? 'incrementally ' : ''}updated from Worker.`);
    }

    findAbstractPath(sx, sy, ex, ey, engine) {
        const startCluster = this.pf.clusters.get(`${Math.floor(sx / this.pf.clusterSize)},${Math.floor(sy / this.pf.clusterSize)}`);
        const endCluster = this.pf.clusters.get(`${Math.floor(ex / this.pf.clusterSize)},${Math.floor(ey / this.pf.clusterSize)}`);
        
        if (!startCluster || !endCluster) return null;
        if (startCluster === endCluster) return null;

        const cacheKey = `${startCluster.id}_${endCluster.id}`;
        if (this.pf.pathCache.has(cacheKey)) return this.pf.pathCache.get(cacheKey);

        const startNodeKeys = this._findNearbyAbstractNodes(sx, sy, startCluster, engine);
        const endNodeKeys = this._findNearbyAbstractNodes(ex, ey, endCluster, engine);
        
        if (startNodeKeys.length === 0 || endNodeKeys.length === 0) return null;

        const gScore = new Map();
        const fScore = new Map();
        const h = (k1, k2) => {
            const [x1, y1] = k1.split(',').map(Number);
            const [x2, y2] = k2.split(',').map(Number);
            return Math.abs(x1 - x2) + Math.abs(y1 - y2);
        };

        const openSet = new MinHeap((a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity));

        for (const sk of startNodeKeys) {
            gScore.set(sk, 0);
            fScore.set(sk, h(sk, endNodeKeys[0]));
            openSet.push(sk);
        }

        const endNodeSet = new Set(endNodeKeys);
        const cameFrom = new Map();
        let foundEndKey = null;

        while (openSet.size() > 0) {
            const currentKey = openSet.pop();
            if (endNodeSet.has(currentKey)) {
                foundEndKey = currentKey;
                break;
            }

            const node = this.pf.abstractNodes.get(currentKey);
            if (!node) continue;

            for (const [neighborKey, weight] of node.neighbors) {
                const tentativeG = (gScore.get(currentKey) || 0) + weight;
                if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
                    cameFrom.set(neighborKey, currentKey);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + h(neighborKey, endNodeKeys[0]));
                    openSet.push(neighborKey);
                }
            }
        }

        if (!foundEndKey) return null;

        const path = [];
        let curr = foundEndKey;
        while (curr) {
            path.unshift(curr);
            curr = cameFrom.get(curr);
        }

        this.pf.pathCache.set(cacheKey, path);
        return path;
    }

    _findNearbyAbstractNodes(x, y, cluster, engine) {
        const nodes = [];
        for (const [key, node] of this.pf.abstractNodes) {
            const [nx, ny] = key.split(',').map(Number);
            if (nx >= cluster.x && nx < cluster.x + cluster.width && 
                ny >= cluster.y && ny < cluster.y + cluster.height) {
                const path = AStarSearch.findPath(x, y, nx, ny, engine, 10, true, this.pf);
                if (path && path.length > 0) nodes.push(key);
            }
        }
        return nodes;
    }

    findHierarchicalPath(sx, sy, ex, ey, engine) {
        const abstractPath = this.findAbstractPath(sx, sy, ex, ey, engine);
        if (!abstractPath) {
            return AStarSearch.findPath(sx, sy, ex, ey, engine, 10, false, this.pf);
        }

        const [nextX, nextY] = abstractPath[0].split(',').map(Number);
        const localPath = AStarSearch.findPath(sx, sy, nextX, nextY, engine, 10, false, this.pf);
        
        return {
            fullAbstractPath: abstractPath,
            localPath: localPath,
            targetPos: { x: ex, y: ey }
        };
    }
}
