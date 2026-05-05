import TerrainGen, { BIOME_NAMES_TO_IDS } from '../world/TerrainGen.js';
import Camera from './Camera.js';
import EntityRenderer from '../systems/render/EntityRenderer.js';
import EntityManager from './EntityManager.js';
import EventBus from './EventBus.js';
import FactoryProvider from '../factories/core/FactoryProvider.js';
import ChunkManager from '../world/ChunkManager.js';
import StatsMonitor from './StatsMonitor.js';
import speciesConfig from '../config/species.json'; // 🚀 LOAD SPECIES 
import resourceConfig from '../config/resource_balance.json'; // 🚀 LOAD RESOURCES
import buildingsConfig from '../config/buildings.json';
import techTreeConfig from '../config/tech_tree.json';
import RenderCoordinator from '../systems/render/RenderCoordinator.js';
import SystemManager from './SystemManager.js';
import TimeSystem from '../systems/core/TimeSystem.js';
import ToolManager from './ToolManager.js';
import { JobTypes } from '../config/JobTypes.js';
import { GlobalLogger } from '../utils/Logger.js';

// 🚀 [Critical Imports] 멀티스레딩 및 DOD 아키텍처 필수 클래스
import SpatialHash from '../utils/SpatialHash.js';
import WorkerBridge from './WorkerBridge.js';
import BufferManager from './BufferManager.js';



export default class Engine {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.options = options; // 🗺️ Store user map settings
        this.speciesConfig = speciesConfig;
        this.resourceConfig = resourceConfig;
        this.buildingsConfig = buildingsConfig;
        this.techTreeConfig = techTreeConfig;

        // 🚀 SMART RESOLUTION: Fix the 'tiny canvas' issue
        const rect = canvas.getBoundingClientRect();
        this.width = rect.width || window.innerWidth;
        this.height = rect.height || window.innerHeight;

        // Ensure the drawing buffer matches high-DPI screens without shrinking the layout
        canvas.width = this.width;
        canvas.height = this.height;

        // Force the canvas to stretch back to its intended layout size
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        this.ctx = canvas.getContext('2d', { alpha: false });
        // 🌍 [Scale Expansion] 사용자 설정 맵 크기 적용 (기본값 2400x2400)
        this.mapWidth = options.width || 2400;
        this.mapHeight = options.height || 2400;


        this.terrainCanvas = document.createElement('canvas');
        this.terrainCanvas.width = this.mapWidth;
        this.terrainCanvas.height = this.mapHeight;
        this.terrainCtx = this.terrainCanvas.getContext('2d', { alpha: false });

        // 👁️ RESTORED: Intelligent Camera with Boundary & Mouse-Center Zoom
        this.camera = new Camera(this.width, this.height, this.mapWidth, this.mapHeight);

        // 🚀 FULL SCREEN INIT: Auto-scale to fill the viewport
        const fitZoom = Math.max(this.width / this.mapWidth, this.height / this.mapHeight);
        this.camera.zoom = Math.max(1.0, fitZoom);
        this.camera.clamp();

        this.terrainGen = new TerrainGen();
        this.eventBus = new EventBus();
        this.entityManager = new EntityManager();
        this.spatialHash = new SpatialHash(100);
        this.entityManager.spatialHash = this.spatialHash;
        
        // 🚀 [MAIN Thread Systems] 입력, 파티클, UI 담당
        this.systemManager = new SystemManager(this, 'MAIN');
        
        // 편리한 참조 연결 (RenderCoordinator 등에서 사용)
        this.inputSystem = this.systemManager.inputSystem;
        this.particleSystem = this.systemManager.particleSystem;
        this.wind = this.systemManager.wind;
        
        this.workerBridge = new WorkerBridge(this);
        this.renderer = new EntityRenderer(this);
        this.factoryProvider = new FactoryProvider(this);

        // 메인 스레드 전용 상태 관리
        this.isRunning = false;
        this.lastTime = 0;
        this.time = 0;
        this.timeSystem = new TimeSystem(this);

        this.isPainting = false;
        this.brushSize = 50; 
        this.viewFlags = { wind: false, fertility: false, fertilityValue: false, xray: false, water: false, mineral: false, debugAI: true, showNames: false, village: false, zone: false };

        // 🌉 [Input Sync] 툴 사용 이벤트를 워커로 토스
        this.eventBus.on('APPLY_TOOL_EFFECT', (payload) => {
            if (payload.action === 'CHANGE_BIOME') {
                if (this.terrainGen) {
                    const idx = this.terrainGen.getIndex(payload.x, payload.y);
                    if (this.terrainGen.isValidIndex(idx)) {
                        this.terrainGen.biomeBuffer[idx] = payload.biome;
                        this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: payload.x, y: payload.y, reason: 'biome_change' });
                    }
                }
                if (this.workerBridge) this.workerBridge.sendInput('TOOL_EFFECT', payload);
            } else if (payload.action === 'SPAWN_RESOURCE' || payload.action === 'SPAWN_ENTITY') {
                payload.isFalling = true;
                this.dispatchCommand({ type: payload.action, payload: payload });
            } else {
                if (this.workerBridge) this.workerBridge.sendInput('TOOL_EFFECT', payload);
            }
        });
        
        this.eventBus.on('SPAWN_ENTITY', (payload) => {
            if (this.workerBridge) this.workerBridge.sendInput('SPAWN_ENTITY', payload);
        });

        // 🌉 Global -> EventBus Bridge (AnimalRenders -> ParticleSystem)
        this._onWorldSpawnDust = (e) => {
            this.eventBus.emit('SPAWN_DUST', e.detail);
        };
        window.addEventListener('WORLD_SHAKE', this._onWorldSpawnDust);

        this.simParams = { spreadSpeed: 1.0, spreadAmount: 5000 };
        this.frameCount = 0; // 🚀 Frame Counter Init

        // 🌡️ [사용자 피드백 반영] 시뮬레이션 파라미터 실시간 업데이트 핸들러
        this.eventBus.on('UPDATE_SIM_PARAMS', (params) => {
            this.simParams = { ...this.simParams, ...params };
        });

        // 🎨 [사용자 피드백 반영] 전체 배경 칠하기(Fill) 핸들러
        this.eventBus.on('APPLY_FILL_TOOL', (payload) => {
            const biomeId = payload.biome;
            const width = this.mapWidth;
            const height = this.mapHeight;
            const buffer = this.terrainGen.biomeBuffer;
            
            for (let i = 0; i < buffer.length; i++) {
                // 바다가 아닌 육지(DIRT, GRASS 등)만 채우기 대상으로 설정
                if (this.terrainGen.isLand(buffer[i])) {
                    buffer[i] = biomeId;
                }
            }
            // 전체 렌더링 갱신 통보 (메모리 효율을 위해 전체 업데이트 플래그 사용 가능)
            this.eventBus.emit('CACHE_PIXEL_UPDATE', { all: true, reason: 'fill_biome' });
        });




        this.onEntitySelect = null;
        this.selectedId = null;
        this.chunkManager = new ChunkManager(this, 50);
        this.isFollowing = false;

        this.monitor = new StatsMonitor(this);
        this.toolManager = new ToolManager(this); // 🛠️ 전략 패턴 기반 툴 매니저 도입

        this.init();
        this.renderCoordinator = new RenderCoordinator(this.entityManager, this.eventBus, this); // 🖼️ Render Orchestrator Init

        // 📡 Subscribe to UI Selection Event for Rendering
        this.eventBus.on('ENTITY_SELECTED', (id) => {
            this.selectedId = id;
        });

        // 📡 Subscribe to Spawner/Environment pixel updates
        this.eventBus.on('CACHE_PIXEL_UPDATE', (data) => {
            // 전체 갱신 요청 (예: 배경 칠하기)
            if (data.all) {
                this.preRenderTerrain();
                return;
            }
            // 비옥도 변화나 바이옴 변화 시 항상 픽셀 갱신
            if (data.reason === 'biome_change' || data.reason === 'biome_spread' || data.reason === 'fertility_change' || this.viewFlags.fertility) {
                this.updateCachePixel(data.x, data.y);
            }
        });
        this.eventBus.on('REFRESH_FERTILITY_VIEW', () => {
            if (this.viewFlags.fertility) {
                this.chunkManager.markAllDirty();
            }
        });


        this.eventBus.on('REFRESH_WATER_PIXELS', () => {
            this.refreshWaterPixels();
        });

        // 💀 [God Power] 엔티티 강제 제거 요청 처리
        this.eventBus.on('ENTITY_KILL_REQUEST', (id) => {
            GlobalLogger.info(`💀 God Power: Removing entity ${id}`);
            this.entityManager.removeEntity(id);
            if (this.selectedId === id) {
                this.selectedId = null;
                this.eventBus.emit('ENTITY_SELECTED', null);
            }
        });

        // 📡 Subscribe to Stats updates
        // Engine은 StatsMonitor를 통해 통계를 관리하므로, EventBus를 통해 업데이트를 받습니다.
        this.eventBus.on('STATS_UPDATED', (payload) => {
            if (payload.type === 'fertility') {
                this.updateFertilityStat(payload.oldVal, payload.newVal);
            } else if (payload.type === 'potential_fertility') {
                this.updatePotentialStat(payload.oldVal, payload.newVal);
            }
        });
    }

    async init() {
        this.isGenerating = true;
        
        // 📊 통계 및 물 데이터 수집용 객체
        const stats = { totalFertility: 0, potentialFertility: 0 };
        
        // 🚀 [Expert Optimization] Water Pixel 버퍼 초기화 (2400x2400 대응)
        if (!this.waterPixels) this.waterPixels = new Uint32Array(this.mapWidth * this.mapHeight);
        this.waterCount = 0;

        // 🚀 [Expert Design] 점진적 지형 생성 시작 (통계 및 수역 데이터 수집 병행)
        await this.terrainGen.generateProgressive(this.mapWidth, this.mapHeight, this, () => {
            this.preRenderTerrain(false); // 색상 재계산 생략
        }, stats, this.waterPixels);

        // 결과 적용
        this.monitor.setInitialFertility(stats.totalFertility, stats.potentialFertility);
        
        this.refreshWaterPixels();
        this.preRenderTerrain();
        
        this.isGenerating = false;
        console.log("🌍 World Initialization Complete. Ready for life.");

        // 📡 시뮬레이션 준비 완료 알림
        this.eventBus.emit('WORLD_READY');

        // 🚀 [Multithreading] 지형 생성이 완료된 후 워커 브릿지 초기화
        if (this.workerBridge) {
            this.workerBridge.init();
        }

        // 🏗️ PoC: 테스트용 글로벌 구역 생성
        setTimeout(() => {
            const zm = this.systemManager?.zoneManager;
            if (zm && zm.zones.size === 0) {
                zm.createZone(100, 100, 150, 150, 'residential');
                zm.createZone(300, 100, 200, 150, 'lumber');
                // Test zones initialized
            }
        }, 1000);
    }


    updateFertilityStat(oldVal, newVal) { this.monitor.updateFertilityStat(oldVal, newVal); }
    updatePotentialStat(oldMax, newMax) { this.monitor.updatePotentialStat(oldMax, newMax); }

    async preRenderTerrain(recalculateColors = true) {
        if (this.chunkManager) {
            // 🚀 [Optimization] 생성 중에는 색상 재계산을 생략하여 메인 스레드 점유 방지
            const shouldRecalculate = recalculateColors && !this.isGenerating;
            await this.chunkManager.markAllDirty(shouldRecalculate);
            this.chunkManager.render(this.terrainCtx);
        }
    }

    renderDirtyTiles() {
        this.chunkManager.render(this.terrainCtx);
    }

    updateCachePixel(x, y) {
        this.chunkManager.markDirty(x, y);
    }

    refreshWaterPixels() {
        // 🚀 [Memory Optimization] 일반 배열 대신 TypedArray 사용 (메모리 파편화 방지)
        if (!this.waterPixels || this.waterPixels.length !== this.mapWidth * this.mapHeight) {
            this.waterPixels = new Uint32Array(this.mapWidth * this.mapHeight);
        }
        this.waterCount = 0;
        
        const buffer = this.terrainGen.biomeBuffer;
        const OCEAN_ID = BIOME_NAMES_TO_IDS.get('OCEAN');
        const DEEP_ID = BIOME_NAMES_TO_IDS.get('DEEP_OCEAN');
        const LAKE_ID = BIOME_NAMES_TO_IDS.get('LAKE');
        const RIVER_ID = BIOME_NAMES_TO_IDS.get('RIVER');

        // [Optimization] Loop removed. Incremental sync enabled.
    }

    handleResize(w, h) {
        this.width = w;
        this.height = h;
        this.canvas.width = w;
        this.canvas.height = h;

        if (this.camera) {
            this.camera.width = w;
            this.camera.height = h;
            this.camera.clamp();
        }

        if (this.renderCoordinator) {
            this.renderCoordinator.resize(w, h);
        }
        this.preRenderTerrain();
        this.chunkManager.dirtyChunks.clear();
    }


    setActiveTool(tool) {
        if (this.activeTool && this.activeTool.onMouseUp) {
            const command = this.activeTool.onMouseUp();
            this.dispatchCommand(command);
        }
        this.activeTool = tool;
        if (this.toolManager && tool) {
            this.toolManager.setTool(tool.id);
            GlobalLogger.info(`🛠️ Tool Switched: ${tool.name}`);
        }
        this.isPainting = false;
        if (this.camera) this.camera.isDragging = false;
    }

    toggleView(id) {
        if (id === 'view_wind') this.viewFlags.wind = !this.viewFlags.wind;
        if (id === 'view_fertility') {
            this.viewFlags.fertility = !this.viewFlags.fertility;
            this.viewFlags.water = false;
            this.viewFlags.mineral = false;
            this.preRenderTerrain();
            this.chunkManager.dirtyChunks.clear();
        }
        if (id === 'view_fertility_value') {
            this.viewFlags.fertilityValue = !this.viewFlags.fertilityValue;
        }
        if (id === 'view_water') {

            this.viewFlags.water = !this.viewFlags.water;
            this.viewFlags.fertility = false;
            this.viewFlags.mineral = false;
            this.preRenderTerrain();
            this.chunkManager.dirtyChunks.clear();
        }
        if (id === 'view_mineral') {
            this.viewFlags.mineral = !this.viewFlags.mineral;
            this.viewFlags.fertility = false;
            this.viewFlags.water = false;
            this.preRenderTerrain();
            this.chunkManager.dirtyChunks.clear();
        }
        if (id === 'view_xray') this.viewFlags.xray = !this.viewFlags.xray;
        if (id === 'view_debug_ai') this.viewFlags.debugAI = !this.viewFlags.debugAI;
        if (id === 'view_showNames') this.viewFlags.showNames = !this.viewFlags.showNames;
        if (id === 'view_village') this.viewFlags.village = !this.viewFlags.village;
        if (id === 'view_zone') this.viewFlags.zone = !this.viewFlags.zone;
    }


    // 🚀 도구 및 이벤트 등에서 넘어온 명령(Command)을 일괄적으로 처리하는 중앙 분배기
    dispatchCommand(command) {
        if (!command) return;
        switch (command.type) {
            case 'CAMERA_DOWN':
                this.camera.handleMouseDown(command.event);
                break;
            case 'CAMERA_MOVE':
                this.camera.handleMouseMove(command.event);
                break;
            case 'CAMERA_UP':
                this.camera.handleMouseUp();
                break;
            case 'SPAWN_PARTICLES':
                this.eventBus.emit('SPAWN_PARTICLES', command.payload);
                break;
            case 'SPAWN_ENTITY':
                const methodToType = { 
                    spawnSheep: 'sheep', 
                    spawnHuman: 'human', 
                    spawnCow: 'cow', 
                    spawnWolf: 'wolf', 
                    spawnHyena: 'hyena', 
                    spawnWildDog: 'wild_dog',
                    spawnTiger: 'tiger',
                    spawnLion: 'lion',
                    spawnBear: 'bear',
                    spawnFox: 'fox',
                    spawnCrocodile: 'crocodile',
                    spawnDeer: 'deer',
                    spawnRabbit: 'rabbit',
                    spawnHorse: 'horse',
                    spawnElephant: 'elephant',
                    spawnGoat: 'goat'
                };
                const type = methodToType[command.payload.method];
                if (type) {
                    const cat = type === 'human' ? 'human' : 'animal';
                    this.eventBus.emit('SPAWN_ENTITY', { 
                        cat, 
                        type, 
                        x: command.payload.x, 
                        y: command.payload.y, 
                        options: { isBaby: false, isFalling: command.payload.isFalling } 
                    });
                }
                break;
            case 'CHANGE_BIOME':
                this.eventBus.emit('APPLY_TOOL_EFFECT', { ...command.payload, action: 'CHANGE_BIOME' });
                break;
            case 'SPAWN_RESOURCE':
                const resType = command.payload.type || command.payload.resourceId;
                const resAmount = command.payload.amount || 1;
                
                // 🌳 [Data-Driven Fix] 하드코딩된 목록 대신 resource_balance.json의 type을 기반으로 자동 판별
                const config = this.resourceConfig[resType];
                const resCategory = config?.type; 
                
                // food, wood 카테고리는 NatureFactory에서, mineral, fertilizer 등은 ResourceFactory에서 처리
                const isNature = resCategory === 'food' || resCategory === 'wood' || resType.includes('tree');
                const cat = isNature ? 'nature' : 'resource';
                
                this.eventBus.emit('SPAWN_ENTITY', { 
                    cat, 
                    type: resType, 
                    x: command.payload.x, 
                    y: command.payload.y, 
                    options: { quality: resAmount / 20, isFalling: command.payload.isFalling } 
                });
                break;
            case 'TOGGLE_VIEW':
                this.toggleView(`view_${command.payload.flagName}`);
                break;
            case 'INSPECT':
                this.eventBus.emit('INSPECT_REQUEST', command.payload.worldPos);
                break;
            case 'APPLY_FILL_TOOL':
                this.eventBus.emit('APPLY_FILL_TOOL', command.payload);
                break;
            case 'PLACE_BLUEPRINT':
                this.eventBus.emit('SPAWN_ENTITY', { 
                    cat: 'building', 
                    type: command.payload.type, 
                    x: command.payload.x, 
                    y: command.payload.y, 
                    options: { isBlueprint: true } 
                });
                break;
            case 'SPAWN_DROPPED_ITEM':
                this.eventBus.emit('SPAWN_ENTITY', { 
                    cat: 'item', 
                    type: command.payload.type, 
                    x: command.payload.x, 
                    y: command.payload.y, 
                    options: { amount: command.payload.amount, isFalling: command.payload.isFalling } 
                });
                break;
        }
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    start() {
        if (this.isRunning) return;
        
        // 🚀 [Safety Check] 지형 생성 중이면 완료 후 자동 시작 예약
        if (this.isGenerating) {
            this.eventBus.once('WORLD_READY', () => this.start());
            GlobalLogger.info("⏳ World is generating... Simulation will start automatically when ready.");
            return;
        }

        // 🚀 [Worker Check] 워커가 아직 준비되지 않았다면 대기
        if (this.workerBridge && !this.workerBridge.isInitialized) {
            this.eventBus.once('WORKER_READY', () => this.start());
            GlobalLogger.info("⏳ Waiting for Simulation Worker to initialize...");
            return;
        }

        this.isRunning = true;
        this.lastTime = performance.now();
        if (this.workerBridge) this.workerBridge.start(); // 🚀 워커 시작
        requestAnimationFrame((t) => this.loop(t));
    }

    stop() { 
        this.isRunning = false; 
        if (this.workerBridge) this.workerBridge.stop(); // 🚀 워커 정지
    }

    loop(time) {
        if (!this.isRunning) return;
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.monitor.update(time);
        this.frameCount++; 

        this.update(dt);
        
        // 🚀 [Render] 데이터는 SharedArrayBuffer를 통해 워커가 실시간 갱신 중
        if (this.chunkManager.dirtyChunks.size > 0) this.renderDirtyTiles();
        this.render();
        
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.isGenerating) return;

        // ⏳ 시간 시스템 업데이트
        this.timeSystem.update(dt * 1000, this);

        // 🚀 [MAIN Thread Systems] 입력, 파티클, 바람 등 업데이트
        if (this.systemManager) {
            this.systemManager.update(dt, performance.now());
        }
        
        if (this.workerBridge) {
            this.workerBridge.syncCamera();
        }

        if (this.selectedId) {
            const e = this.entityManager.entities.get(this.selectedId);
            if (e) {
                // 🎥 카메라 추적 (DOD 버퍼에서 직접 좌표 읽기)
                if (this.isFollowing) {
                    const bm = this.entityManager.bufferManager;
                    this.camera.x = bm.x[this.selectedId] - (this.width / this.camera.zoom) / 2;
                    this.camera.y = bm.y[this.selectedId] - (this.height / this.camera.zoom) / 2;
                    this.camera.clamp();
                }
            } else {
                this.selectedId = null;
                this.eventBus.emit('ENTITY_SELECTED', null);
            }
        }
    }

    render() {
        // 🖼️ [Step 5: Offscreen Canvas] Delegate all rendering to the coordinator
        this.renderCoordinator.render(this.ctx);
    }



    // renderFertilityTooltip is now handled by RenderCoordinator.js
    /**
     * 🧹 [Memory Management] 엔진 종료 및 자원 일괄 해제
     */
    destroy() {
        this.isRunning = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);

        // 1. 모든 시스템 파괴
        if (this.systemManager) this.systemManager.destroy();

        // 2. 엔티티 및 컴포넌트 강제 해제
        if (this.entityManager) this.entityManager.clearAll();

        // 3. 이벤트 구독 일괄 해제
        if (this.eventBus) this.eventBus.clear();

        // 4. 큰 버퍼 메모리 해제 지원
        this.terrainGen = null;
        this.chunkManager = null;
        
        GlobalLogger.warn("🛑 [Engine] Destroyed. Memory cleared.");
    }
}
