/**
 * ⚙️ SimulationWorker
 * 월드의 모든 논리 연산(AI, 물리, 경제)을 담당하는 백그라운드 스레드입니다.
 */
import SystemManager from './SystemManager.js';
import EntityManager from './EntityManager.js';
import EventBus from './EventBus.js';
import TerrainGen from '../world/TerrainGen.js';
import TimeSystem from '../systems/core/TimeSystem.js';
import FactoryProvider from '../factories/core/FactoryProvider.js';

let systemManager = null;
let entityManager = null;
let eventBus = null;
let terrainGen = null;
let timeSystem = null;
let mockEngine = null;

let sharedBuffer = null;
let sharedData = null;
let sharedIntData = null;
let stride = 0;
let mapBuffers = null;

let lastTime = performance.now();
let isRunning = false;
let selectedId = null;

// 1. 초기화 메시지 대기
self.onmessage = (e) => {
    const { type, payload, buffer, maxEntities, stride: s } = e.data;

    switch (type) {
        case 'INIT_BUFFER':
            sharedBuffer = buffer;
            sharedData = new Float32Array(buffer);
            sharedIntData = new Int32Array(buffer);
            stride = s;
            mapBuffers = e.data.mapBuffers;
            break;

        case 'START':
            init(payload); // payload contains map options
            isRunning = true;
            loop();
            break;

        case 'COMMAND':
            // 메인 스레드로부터 온 명령 처리 (예: 스폰, 도구 사용)
            if (payload.type === 'SELECT_ENTITY') {
                selectedId = payload.payload;
            }
            if (payload.type === 'UPDATE_SIM_PARAMS' && mockEngine) {
                Object.assign(mockEngine.simParams, payload.payload);
            }
            if (eventBus) eventBus.emit(payload.type, payload.data || payload.payload);
            break;
    }
};

async function init(options) {
    console.log("⚙️ Simulation Worker: Initializing Engine Core...");
    
    eventBus = new EventBus();
    
    // 📡 [Lifecycle Synchronization] 워커 내의 엔티티 변화를 메인 스레드에 알림
    eventBus.on('ENTITY_CREATED_INTERNAL', (payload) => self.postMessage({ type: 'ENTITY_CREATED', payload }));
    eventBus.on('ENTITY_REMOVED_INTERNAL', (payload) => self.postMessage({ type: 'ENTITY_REMOVED', payload }));
    eventBus.on('COMPONENT_ADDED_INTERNAL', (payload) => self.postMessage({ type: 'COMPONENT_ADDED', payload }));

    // 🎨 [Visual/UI Bridging] 시각 효과 및 UI 알림을 메인 스레드로 전달
    const visualEvents = [
        'SPAWN_EFFECT_PARTICLES', 
        'SHOW_SPEECH_BUBBLE', 
        'ENTITY_SELECTED',
        'VILLAGE_CREATED',
        'VILLAGE_DESTROYED',
        'VILLAGE_RESOURCES_UPDATED',
        'LOG_MESSAGE'
    ];
    
    visualEvents.forEach(evt => {
        eventBus.on(evt, (payload) => self.postMessage({ type: 'EVENT_RELAY', event: evt, payload }));
    });

    entityManager = new EntityManager(eventBus);
    entityManager.setSharedBuffer(sharedBuffer, stride);

    terrainGen = new TerrainGen();
    terrainGen.setSharedMapBuffers(mapBuffers);
    
    mockEngine = {
        options: options.options || {},
        entityManager,
        eventBus,
        terrainGen,
        mapWidth: options.width || 2400,
        mapHeight: options.height || 2400,
        resourceConfig: options.resourceConfig || {},
        speciesConfig: options.speciesConfig || {},
        buildingsConfig: options.buildingsConfig || {},
        // 🏗️ [Worker Mock] 지형 생성용 버퍼 시뮬레이션
        chunkManager: { 
            buffer: new Uint32Array(mapBuffers.color),
            markDirty: () => {},
            markAllDirty: () => {}
        },
        waterCount: 0,
        // 👁️ [Worker Mock] LOD 로직용 가상 카메라
        camera: {
            x: 0, y: 0,
            width: options.width || 2400,
            height: options.height || 2400,
            zoom: 1.0
        },
        frameCount: 0,
        simParams: {
            spreadSpeed: 0.1,
            spreadAmount: 3000
        }
    };

    mockEngine.factoryProvider = new FactoryProvider(mockEngine);

    // 지형 생성 (비동기)
    await terrainGen.generateProgressive(options.width || 2400, options.height || 2400, mockEngine);

    systemManager = new SystemManager(mockEngine);
    timeSystem = new TimeSystem();

    // 워커 완료 알림
    self.postMessage({ type: 'READY' });
}

function loop() {
    if (!isRunning) return;

    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    // 1. 시뮬레이션 업데이트
    if (systemManager) {
        systemManager.update(dt, now);
    }
    if (timeSystem) {
        timeSystem.update(dt * 1000, { systemManager, entityManager, terrainGen });
    }

    // 2. 메인 스레드로 통계 및 디버그 정보 전송
    if (Math.random() < 0.1) {
        // 통계 전송
        self.postMessage({
            type: 'STATS',
            payload: {
                entityCount: entityManager.entities.size,
                fps: Math.round(1 / dt)
            }
        });

        // 🎯 선택된 엔티티 디버그 정보 전송
        if (selectedId !== null) {
            const ent = entityManager.entities.get(selectedId);
            const state = ent?.components.get('AIState');
            if (state) {
                self.postMessage({
                    type: 'EVENT_RELAY',
                    event: 'SELECTED_ENTITY_DEBUG_SYNC',
                    payload: {
                        id: selectedId,
                        targetId: state.targetId,
                        path: state.path,
                        pathIndex: state.pathIndex,
                        wanderAngle: state.wanderAngle,
                        isTargetRequested: state.isTargetRequested,
                        unreachableTargets: state.unreachableTargets ? Array.from(state.unreachableTargets) : []
                    }
                });
            }
        }
    }

    // 🚀 [Optimization] setTimeout(0) 대신 requestAnimationFrame은 워커에 없으므로 
    // 성능을 위해 최대한 빠르게 반복하거나 스케줄링
    setTimeout(loop, 16); 
}
