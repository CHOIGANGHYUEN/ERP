import BufferManager from './BufferManager.js';
import Transform from '../components/motion/Transform.js';
import Visual from '../components/render/Visual.js';
import Health from '../components/stats/Health.js';
import State from '../components/behavior/State.js';
import ResourceNode from '../components/resource/ResourceNode.js';
import { GlobalLogger } from '../utils/Logger.js';

/**
 * 🌉 [Performance Overhaul] WorkerBridge
 * 메인 스레드와 SimulationWorker 사이의 통신을 전담하는 브릿지입니다.
 */
export default class WorkerBridge {
    constructor(engine) {
        this.engine = engine;
        this.worker = null;
        this.isInitialized = false;
        this.lastCameraSync = 0;
    }

    /**
     * 워커를 생성하고 초기 데이터를 전송합니다.
     */
    init() {
        // Vite 전용 워커 생성 방식
        this.worker = new Worker(
            new URL('./SimulationWorker.js', import.meta.url),
            { type: 'module' }
        );

        this.worker.onmessage = (e) => this.handleMessage(e.data);

        // 초기화 데이터 준비
        const initData = {
            type: 'INIT',
            data: {
                mapWidth: this.engine.mapWidth,
                mapHeight: this.engine.mapHeight,
                sharedBuffer: this.engine.entityManager.bufferManager.sharedBuffer, // 🚀 공유 버퍼 전송
                terrainGen: {
                    terrainBuffer: this.engine.terrainGen.terrainBuffer,
                    biomeBuffer: this.engine.terrainGen.biomeBuffer,
                    fertilityBuffer: this.engine.terrainGen.fertilityBuffer,
                    occupancyBuffer: this.engine.terrainGen.occupancyBuffer,
                    mineralDensityBuffer: this.engine.terrainGen.mineralDensityBuffer,
                    waterQualityBuffer: this.engine.terrainGen.waterQualityBuffer
                },
                speciesConfig: this.engine.speciesConfig,
                resourceConfig: this.engine.resourceConfig,
                buildingsConfig: this.engine.buildingsConfig
            }
        };

        this.worker.postMessage(initData);
    }

    start() {
        if (this.worker) {
            this.worker.postMessage({ type: 'START' });
        }
    }

    stop() {
        if (this.worker) {
            this.worker.postMessage({ type: 'STOP' });
        }
    }

    /**
     * 툴 사용, 엔티티 스폰 등의 이벤트를 워커로 전달합니다.
     */
    sendInput(type, payload) {
        if (this.worker) {
            this.worker.postMessage({
                type: 'INPUT_EVENT',
                data: { type, payload }
            });
        }
    }

    /**
     * 동기화용 카메라 데이터 전송
     */
    syncCamera() {
        const now = performance.now();
        if (this.worker && this.engine.camera && now - this.lastCameraSync > 100) {
            this.lastCameraSync = now;
            this.worker.postMessage({
                type: 'SYNC_CAMERA',
                data: {
                    x: this.engine.camera.x,
                    y: this.engine.camera.y,
                    zoom: this.engine.camera.zoom,
                    width: this.engine.camera.width,
                    height: this.engine.camera.height
                }
            });
        }
    }

    handleMessage(msg) {
        const em = this.engine.entityManager;

        switch (msg.type) {
            case 'WORKER_LOG':
                const log = msg.data;
                if (log.type === 'info') GlobalLogger.info(log.message);
                else if (log.type === 'warn') GlobalLogger.warn(log.message);
                else if (log.type === 'error') GlobalLogger.error(log.message);
                else if (log.type === 'success') GlobalLogger.success(log.message);
                break;
            case 'INITIALIZED':
                this.isInitialized = true;
                this.engine.eventBus.emit('WORKER_READY');
                console.log("🌉 WorkerBridge: SimulationWorker is ready.");
                break;
            case 'ENTITY_CREATED':
                const { id, category, type, x, y, visualData, animalData, isKing } = msg.data;
                const entity = { id, components: new Map() };
                em.entities.set(id, entity);

                // 🚀 [Critical Fix] 메인 스레드에 프록시 컴포넌트 주입
                const bm = em.bufferManager;
                entity.components.set('Transform', new Transform(x, y, id, bm));
                entity.components.set('Visual', new Visual({ type, ...visualData }, id, bm));
                entity.components.set('Health', new Health(null, id, bm));
                entity.components.set('AIState', new State(null, id, bm));
                
                // 🎒 [Proxy Enhancement] 렌더러가 기대하는 인터페이스 구현
                entity.components.set('Inventory', { 
                    items: {}, 
                    getTotal: () => 0 
                });
                entity.components.set('Metabolism', { hunger: 100 });
                
                if (category === 'resource' || category === 'nature') {
                    entity.components.set('Resource', new ResourceNode(type, null, category, id, bm));
                }
                if (category === 'human' || category === 'animal') {
                    entity.components.set('Animal', { type, id, ...visualData, ...animalData }); 
                    entity.components.set('Social', { isBreeding: false });
                    entity.components.set('Civilization', { isKing: isKing || false });
                }
                if (category === 'building') {
                    entity.components.set('Building', { type, id });
                    entity.components.set('Structure', { isComplete: true, progress: 100, maxProgress: 100 });
                }

                if (category === 'human') em.humanIds.add(id);
                if (category === 'animal') em.animalIds.add(id);
                if (category === 'resource' || category === 'nature') em.resourceIds.add(id);
                if (category === 'building') em.buildingIds.add(id);

                GlobalLogger.info(`➕ Proxy Entity Created: [${category}] ${type} (ID: ${id})`);
                break;
            case 'ENTITY_REMOVED':
                const rid = msg.data.id;
                em.entities.delete(rid);
                em.animalIds.delete(rid);
                em.humanIds.delete(rid);
                em.resourceIds.delete(rid);
                em.buildingIds.delete(rid);
                GlobalLogger.info(`➖ Proxy Entity Removed: ID ${rid}`);
                break;
            case 'TICK_COMPLETE':
                // 🚀 메인 스레드에서도 공간 해시 갱신 (렌더링 쿼리용)
                this.syncSpatialHash();
                break;
            case 'STATS_UPDATE':
                // 워커로부터 받은 통계 데이터를 모니터에 반영
                if (this.engine.monitor) {
                    this.engine.monitor.entityCount = msg.data.entityCount;
                    this.engine.monitor.workerVillageStats = msg.data.villages;
                }
                break;
        }
    }

    /**
     * 버퍼 데이터를 기반으로 메인 스레드의 SpatialHash를 최신화합니다.
     */
    syncSpatialHash() {
        const sh = this.engine.spatialHash;
        const bm = this.engine.entityManager.bufferManager;
        if (!sh || !bm) return;

        sh.clearDynamic();
        
        // 🚀 모든 활성 엔티티(동물, 인간, 자원, 건물)를 공간 해시에 동기화
        const em = this.engine.entityManager;
        const sets = [em.animalIds, em.humanIds, em.resourceIds, em.buildingIds];
        
        let totalSynced = 0;
        for (const set of sets) {
            for (const id of set) {
                if (bm.active[id]) {
                    sh.insert(id, bm.x[id], bm.y[id], false, true);
                    totalSynced++;
                }
            }
        }

        // 🔍 [Debug] 너무 자주 찍히지 않도록 100프레임마다 출력
        if (this.engine.frameCount % 100 === 0 && totalSynced > 0) {
            console.log(`📡 SpatialHash Synced: ${totalSynced} entities`);
        }
    }

    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}
