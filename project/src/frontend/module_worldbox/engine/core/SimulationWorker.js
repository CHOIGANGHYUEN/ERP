/**
 * 🧵 [Performance Overhaul] SimulationWorker
 * 메인 스레드와 분리되어 무거운 시뮬레이션 연산을 전담합니다.
 */
import EntityManager from './EntityManager.js';
import BufferManager from './BufferManager.js';
import SystemManager from './SystemManager.js';
import EventBus from './EventBus.js';
import FactoryProvider from '../factories/core/FactoryProvider.js';
import TerrainGen from '../world/TerrainGen.js';
import { TerrainLayer, BiomeLayer } from '../world/WorldLayers.js';
import { GlobalLogger } from '../utils/Logger.js';

let entityManager;
let systemManager;
let factoryProvider;
let terrainGen;
let isRunning = false;
let lastTime = 0;

// 워커 메시지 수신부
self.onmessage = (e) => {
    const { type, data } = e.data;

    switch (type) {
        case 'INIT':
            // 🚀 시뮬레이션 환경 초기화 (DOD 버퍼 연결 및 시스템 구축)
            initSimulation(data);
            // 📡 워커 내부 시스템들에게 준비 완료 알림
            if (systemManager && systemManager.engine.eventBus) {
                systemManager.engine.eventBus.emit('WORLD_READY');
            }
            break;
        case 'START':
            if (!isRunning) {
                isRunning = true;
                lastTime = performance.now();
                tick();
            }
            break;
        case 'STOP':
            isRunning = false;
            break;
        case 'INPUT_EVENT':
            // 메인 스레드로부터 온 도구/입력 명령 처리
            handleInput(data);
            break;
        case 'SYNC_CAMERA':
            if (systemManager && systemManager.engine.camera) {
                systemManager.engine.camera.x = data.x;
                systemManager.engine.camera.y = data.y;
                systemManager.engine.camera.zoom = data.zoom;
                systemManager.engine.camera.width = data.width;
                systemManager.engine.camera.height = data.height;
            }
            break;
    }
};

function initSimulation(options) {
    // 🚀 워커의 로그를 메인 스레드로 전송
    GlobalLogger.onUpdate = (logs) => {
        const latestLog = logs[0];
        if (latestLog) {
            self.postMessage({ type: 'WORKER_LOG', data: latestLog });
        }
    };

    // 🚀 [DOD] 메인 스레드의 버퍼 연결
    const bufferManager = new BufferManager(20000, options.sharedBuffer);

    // 🚀 [Critical Fix] 워커 내부에 '진짜' TerrainGen 인스턴스 구축
    // 단순 데이터 객체는 메서드가 없으므로 팩토리 연산 중 에러를 유발합니다.
    terrainGen = new TerrainGen(null);
    terrainGen.mapWidth = options.mapWidth;
    terrainGen.mapHeight = options.mapHeight;
    terrainGen.terrain = new TerrainLayer(options.mapWidth, options.mapHeight);
    terrainGen.biomes = new BiomeLayer(options.mapWidth, options.mapHeight);
    
    // 메인 스레드로부터 받은 공유 버퍼 직접 주입
    terrainGen.terrain.buffer = options.terrainGen.terrainBuffer;
    terrainGen.biomes.buffer = options.terrainGen.biomeBuffer;
    terrainGen.fertilityBuffer = options.terrainGen.fertilityBuffer;
    terrainGen.occupancyBuffer = options.terrainGen.occupancyBuffer;
    terrainGen.mineralDensityBuffer = options.terrainGen.mineralDensityBuffer;
    terrainGen.waterQualityBuffer = options.terrainGen.waterQualityBuffer;

    const mockEngine = {
        entityManager: new EntityManager(bufferManager),
        eventBus: new EventBus(),
        terrainGen: terrainGen,
        mapWidth: options.mapWidth,
        mapHeight: options.mapHeight,
        width: options.mapWidth,
        height: options.mapHeight,
        camera: { x: 0, y: 0, width: options.mapWidth, height: options.mapHeight, zoom: 1 },
        speciesConfig: options.speciesConfig,
        resourceConfig: options.resourceConfig,
        buildingsConfig: options.buildingsConfig,
        options: options
    };

    entityManager = mockEngine.entityManager;
    systemManager = new SystemManager(mockEngine, 'WORKER'); // 🚀 WORKER 모드로 초기화
    factoryProvider = new FactoryProvider(mockEngine); // 🚀 워커용 팩토리 초기화
    
    // 🔗 [Critical Link] 시스템들이 팩토리를 사용할 수 있도록 mockEngine에 연결
    mockEngine.factoryProvider = factoryProvider;
    mockEngine.systemManager = systemManager;
    
    // 🚀 [Sync Bridge] 엔티티 생명주기 변화를 메인 스레드에 보고
    // 엔티티가 특정 카테고리(인간, 동물, 자원 등)에 소속되는 시점을 정확히 보고합니다.
    const originalAddComponent = entityManager.addComponent.bind(entityManager);
    entityManager.addComponent = (id, component, overrideName) => {
        originalAddComponent(id, component, overrideName);
        
        const name = overrideName || component.constructor.name;
        let category = null;
        
        if (name === 'Animal') {
            category = (component.type === 'human') ? 'human' : 'animal';
        } else if (name === 'Resource' || name === 'DroppedItem') {
            category = 'resource';
        } else if (name === 'Building' || name === 'Structure') {
            category = 'building';
        }
        
        if (category) {
            // 🚀 [Optimization] 컴포넌트가 완전히 세팅될 때까지 아주 짧은 지연 후 전송 (Visual 등 데이터 보장)
            setTimeout(() => {
                const ent = entityManager.entities.get(id);
                if (!ent) return;
                
                const visual = ent.components.get('Visual');
                const typeStr = visual ? visual.type : 'fallback';
                const transform = ent.components.get('Transform');
                const animal = ent.components.get('Animal');
                const civ = ent.components.get('Civilization');
                
                self.postMessage({ 
                    type: 'ENTITY_CREATED', 
                    data: { 
                        id, 
                        category, 
                        type: typeStr, 
                        x: transform?.x || 0, 
                        y: transform?.y || 0,
                        visualData: visual ? {
                            subtype: visual.subtype,
                            size: visual.size,
                            color: visual.color,
                            isBaby: visual.isBaby,
                            flipX: visual.flipX,
                            facing: visual.facing
                        } : null,
                        animalData: animal ? {
                            gender: animal.gender,
                            role: animal.role,
                            species: animal.species
                        } : null,
                        isKing: civ?.isKing || false
                    } 
                });
            }, 0);
        }
    };

    const originalRemove = entityManager.removeEntity.bind(entityManager);
    entityManager.removeEntity = (id) => {
        originalRemove(id);
        self.postMessage({ type: 'ENTITY_REMOVED', data: { id } });
    };

    self.postMessage({ type: 'INITIALIZED' });
    GlobalLogger.success("🌉 SimulationWorker: initSimulation complete, Bridge active.");
}

function tick() {
    if (!isRunning) return;

    const currentTime = performance.now();
    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    try {
        // 🚀 [Simulation Phase] 모든 시스템 업데이트
        if (systemManager) {
            systemManager.update(dt, currentTime);
        }

        // 📊 [Stats Update] 1초마다 통계 전송
        if (currentTime - (self._lastStatsTime || 0) > 1000) {
            self._lastStatsTime = currentTime;
            
            const villageStats = [];
            const villageSystem = systemManager.villageSystem || systemManager.civilization;
            
            if (villageSystem && villageSystem.villages) {
                for (const [vId, village] of villageSystem.villages) {
                    villageStats.push({
                        id: vId,
                        name: village.name,
                        population: village.members?.size || 0,
                        food: Math.floor(village.resources?.food || 0),
                        wood: Math.floor(village.resources?.wood || 0)
                    });
                }
            }

            self.postMessage({ 
                type: 'STATS_UPDATE', 
                data: {
                    entityCount: entityManager.entities.size,
                    villages: villageStats
                }
            });
        }

        // 🚀 [Tick Report] 메인 스레드로 진행 상황 보고 (공간 해시 갱신 유도)
        self.postMessage({ type: 'TICK_COMPLETE', time: currentTime });

    } catch (error) {
        GlobalLogger.error(`❌ [SimulationWorker] Error in tick: ${error.message}\n${error.stack}`);
    }

    // 🔄 다음 프레임 예약 (워커 전용 루프)
    setTimeout(tick, 10); // 약 100 FPS 목표로 시뮬레이션 구동
}

function handleInput(input) {
    const { type, payload } = input;
    
    if (type === 'SPAWN_ENTITY') {
        const { cat, type: entityType, x, y, options } = payload;

        if (factoryProvider && cat && entityType) {
            factoryProvider.spawn(cat, entityType, x, y, options);
        }
    } else if (type === 'TOOL_EFFECT') {
        // 지형 변경 등의 효과를 시스템 매니저나 이벤트 버스를 통해 처리
        if (payload.action === 'CHANGE_BIOME') {
            const { x, y, biome, radius } = payload;
            // 워커의 지형 데이터도 갱신
            if (systemManager.engine.terrainGen) {
                // radius 내의 타일들을 변경하는 로직은 TerrainGen에 맡기거나 여기서 직접 수행
                // 간단하게 한 점만 변경 (실제로는 브러시 로직 필요)
                const tg = systemManager.engine.terrainGen;
                const idx = tg.getIndex(x, y);
                if (tg.isValidIndex(idx)) {
                    tg.biomeBuffer[idx] = biome;
                }
            }
        }
    }
}
