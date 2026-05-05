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



import Bridge from './Bridge.js';
import Transform from '../components/motion/Transform.js';
import Visual from '../components/render/Visual.js';
import State from '../components/behavior/State.js';

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
        this.entityManager = new EntityManager();
        this.eventBus = new EventBus(); // 📡 Global Event Network 생성
        this.renderer = new EntityRenderer(this);
        this.chunkManager = new ChunkManager(this, 50);

        // 🛰️ Bridge & Shared Buffer Init
        this.bridge = new Bridge(20000, this.mapWidth, this.mapHeight);

        this.entityManager.setSharedBuffer(this.bridge.buffer, this.bridge.stride);
        this.terrainGen.setSharedMapBuffers(this.bridge.mapBuffers);
        this.chunkManager.setSharedBuffer(this.bridge.mapBuffers.color);
        this.renderer.setSharedBuffer(this.bridge.buffer, this.bridge.stride);

        this.factoryProvider = new FactoryProvider(this);
        // 🚀 주입: 팩토리들이 설정을 참조할 수 있도록 엔진 참조 확인

        // 단일 책임 원칙(SRP) 준수를 위한 시스템 매니저 도입 (Main Thread Only Systems)
        this.systemManager = new SystemManager(this);
        this.inputSystem = this.systemManager.inputSystem;
        this.environment = this.systemManager.environment;
        this.particleSystem = this.systemManager.particleSystem;
        this.wind = this.systemManager.wind;
        this.spawner = this.systemManager.spawner;

        this.isRunning = false;
        this.lastTime = 0;
        this.time = 0;
        this.timeSystem = new TimeSystem(); // ⏳ World Clock Init

        this.isPainting = false;
        this.brushSize = 50; // 🚀 High-res optimized brush size
        this.viewFlags = { wind: false, fertility: false, fertilityValue: false, xray: false, water: false, mineral: false, debugAI: true, showNames: false, village: false, zone: false };
        this._simParams = { spreadSpeed: 0.1, spreadAmount: 3000 };

        // 🔗 [Expert Solution] simParams Proxy to auto-sync with worker
        this.simParams = new Proxy(this._simParams, {
            set: (target, prop, value) => {
                target[prop] = value;
                if (this.bridge) {
                    this.bridge.send('COMMAND', { 
                        type: 'UPDATE_SIM_PARAMS', 
                        payload: { [prop]: value } 
                    });
                }
                return true;
            }
        });

        this.monitor = new StatsMonitor(this);
        this.toolManager = new ToolManager(this);

        this.init();

        // 🏗️ Simulation Worker Initialization
        const workerUrl = new URL('./SimulationWorker.js', import.meta.url);
        this.bridge.initWorker(workerUrl);

        // Relay stats from worker to monitor
        this.bridge.on('STATS', (payload) => {
            if (this.monitor) {
                this.monitor.updateStats(payload);
            }
        });

        this.renderCoordinator = new RenderCoordinator(this.entityManager, this.eventBus, this);

        // 🛰️ [Lifecycle Synchronization] Simulation Worker -> Main Thread
        this.bridge.on('ENTITY_CREATED', (payload) => {
            this.entityManager.registerProxyEntity(payload.id, payload.sharedIndex);
        });

        this.bridge.on('ENTITY_REMOVED', (payload) => {
            this.entityManager.removeEntity(payload.id);
        });

        this.bridge.on('COMPONENT_ADDED', (payload) => {
            const { id, name, options } = payload;
            let component;
            if (name === 'Transform') component = new Transform(options.x, options.y);
            else if (name === 'Visual') component = new Visual(options);
            else if (name === 'AIState') component = new State(options);
            else if (name === 'Health') component = { ...options };
            else if (name === 'Building') component = { ...options };
            else if (name === 'Structure') component = { ...options, isComplete: options.progress >= options.maxProgress };
            else if (name === 'Resource') component = { ...options };
            else if (name === 'Storage') component = { ...options, items: options.items || {} };
            else if (name === 'Animal') component = { ...options };

            if (component) {
                this.entityManager.addComponent(id, component, name);
            }
        });

        // 🎨 [Visual/UI Bridging] Worker -> Main
        this.bridge.on('EVENT_RELAY', (data) => {
            if (data.event === 'SELECTED_ENTITY_DEBUG_SYNC') {
                const ent = this.entityManager.entities.get(data.payload.id);
                const state = ent?.components.get('AIState');
                if (state) {
                    Object.assign(state, data.payload);
                }
            }
            this.eventBus.emit(data.event, data.payload);
        });

        // 📡 Subscribe to UI Selection Event for Rendering
        this.eventBus.on('ENTITY_SELECTED', (id) => {
            this.selectedId = id;
            this.bridge.send('COMMAND', { type: 'SELECT_ENTITY', payload: id });
        });

        // 📡 Subscribe to Spawner/Environment pixel updates
        this.eventBus.on('CACHE_PIXEL_UPDATE', (data) => {
            if (data.all) {
                this.preRenderTerrain();
                return;
            }
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
            this.bridge.send('COMMAND', { type: 'ENTITY_KILL_REQUEST', payload: id });
        });

        // 📡 Subscribe to Stats updates
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

        // 🛰️ [Architecture Redesign] Logic-related commands are sent to the Simulation Worker
        const logicCommands = [
            'SPAWN_ENTITY', 'SPAWN_RESOURCE', 'APPLY_TOOL_EFFECT',
            'CHANGE_BIOME', 'APPLY_FILL_TOOL', 'PLACE_BLUEPRINT',
            'SPAWN_DROPPED_ITEM', 'ENTITY_KILL_REQUEST'
        ];

        if (logicCommands.includes(command.type)) {
            this.bridge.send('COMMAND', command);
            return;
        }

        // Main thread commands (Camera, View, UI)
        switch (command.type) {
            case 'CAMERA_DRAG':
            case 'CAMERA_DOWN':
                this.camera.handleMouseDown(command.event || { clientX: command.payload?.x, clientY: command.payload?.y });
                break;
            case 'CAMERA_MOVE':
                this.camera.handleMouseMove(command.event || { clientX: command.payload?.x, clientY: command.payload?.y });
                break;
            case 'CAMERA_UP':
                this.camera.handleMouseUp();
                break;
            case 'SPAWN_PARTICLES':
                if (this.particleSystem) this.eventBus.emit('SPAWN_PARTICLES', command.payload);
                break;
            case 'TOGGLE_VIEW':
                this.toggleView(`view_${command.payload.flagName}`);
                break;
            case 'INSPECT':
                this.eventBus.emit('INSPECT_REQUEST', command.payload.worldPos);
                break;
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();

        // 🛰️ Start Background Simulation
        this.bridge.send('START', {
            width: this.mapWidth,
            height: this.mapHeight,
            options: this.options,
            speciesConfig: this.speciesConfig,
            resourceConfig: this.resourceConfig,
            buildingsConfig: this.buildingsConfig
        });

        requestAnimationFrame((t) => this.loop(t));
    }

    stop() { this.isRunning = false; }

    loop(time) {
        if (!this.isRunning) return;
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.monitor.update(time);
        this.frameCount++;

        // 🚀 Simulation is in the Worker. Main thread only updates local systems.
        this.update(dt);

        if (this.chunkManager.dirtyChunks.size > 0) this.renderDirtyTiles();
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.isGenerating) return;
        const time = performance.now();

        // 메인 스레드 전용 시스템 (파티클, UI 등)만 업데이트
        this.systemManager.update(dt, time);

        if (this.selectedId) {
            const e = this.entityManager.entities.get(this.selectedId);
            if (e) {
                // 🎥 카메라 추적 (SAB를 통한 좌표 동기화 덕분에 자동 작동)
                if (this.onEntitySelect && this.isFollowing) {
                    const t = e.components.get('Transform');
                    if (t) {
                        this.camera.x = t.x - (this.width / this.camera.zoom) / 2;
                        this.camera.y = t.y - (this.height / this.camera.zoom) / 2;
                        this.camera.clamp();
                    }
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
