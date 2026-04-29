import TerrainGen, { BIOME_NAMES_TO_IDS } from '../world/TerrainGen.js';
import Camera from './Camera.js';
import EntityRenderer from '../systems/render/EntityRenderer.js';
import EntityManager from './EntityManager.js';
import EventBus from './EventBus.js';
import AnimalBehaviorSystem from '../systems/behavior/AnimalBehaviorSystem.js';
import SocialSystem from '../systems/motion/SocialSystem.js';
import GatheringSystem from '../systems/economy/GatheringSystem.js';
import ConsumptionSystem from '../systems/economy/ConsumptionSystem.js';
import KinematicSystem from '../systems/motion/KinematicSystem.js';
import MetabolismSystem from '../systems/lifecycle/MetabolismSystem.js';
import ReproductionSystem from '../systems/lifecycle/ReproductionSystem.js';
import EnvironmentSystem from '../systems/lifecycle/EnvironmentSystem.js';
import SpawnerSystem from '../systems/economy/SpawnerSystem.js';
import WindSystem from '../systems/lifecycle/WindSystem.js';
import EntityFactory from '../factories/EntityFactory.js';
import ChunkManager from '../world/ChunkManager.js';
import StatsMonitor from './StatsMonitor.js';
import speciesConfig from '../config/species.json'; // 🚀 LOAD SPECIES 
import resourceConfig from '../config/resource_balance.json'; // 🚀 LOAD RESOURCES
import buildingsConfig from '../config/buildings.json';
import techTreeConfig from '../config/tech_tree.json';
import InputSystem from '../systems/input/InputSystem.js';
import UISystem from './UISystem.js';
import ParticleSystem from '../systems/render/ParticleSystem.js';

export default class Engine {
    constructor(canvas) {
        this.canvas = canvas;
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
        this.mapWidth = 1000;
        this.mapHeight = 1000;

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
        this.entityManager = new EntityManager(); // EntityManager는 TerrainGen 생성 후 초기화
        this.eventBus = new EventBus(); // 📡 Global Event Network 생성
        this.renderer = new EntityRenderer(this);

        this.behavior = new AnimalBehaviorSystem(this.entityManager, this.eventBus, this);
        this.social = new SocialSystem(this);
        this.gathering = new GatheringSystem(this.entityManager, this.eventBus, this); // engine 주입 필요
        this.consumption = new ConsumptionSystem(this.entityManager, this.eventBus, this);
        this.kinematics = new KinematicSystem(this);
        this.metabolism = new MetabolismSystem(this.entityManager, this.eventBus, this.terrainGen);
        this.reproduction = new ReproductionSystem(this.entityManager, this.eventBus);
        this.environment = new EnvironmentSystem(this.entityManager, this.eventBus, this.terrainGen);
        this.spawner = new SpawnerSystem(this.entityManager, this.eventBus, this.terrainGen);
        this.wind = new WindSystem();
        this.entityFactory = new EntityFactory(this);
        this.particleSystem = new ParticleSystem(this.entityManager, this.eventBus);

        this.isRunning = false;
        this.lastTime = 0;
        this.time = 0;

        this.isPainting = false;
        this.brushSize = 15;
        this.viewFlags = { wind: false, fertility: false, xray: false, water: false, mineral: false };
        this.simParams = { spreadSpeed: 0.1, spreadAmount: 3000 }; // 🚀 UI Params Sync

        this.onEntitySelect = null;
        this.selectedId = null;
        this.chunkManager = new ChunkManager(this, 50);
        this.isFollowing = false;

        this.monitor = new StatsMonitor(this);

        this.init();
        this.inputSystem = new InputSystem(this.entityManager, this.eventBus, this);
        this.uiSystem = new UISystem(this.entityManager, this.eventBus, this);

        // 📡 Subscribe to UI Selection Event for Rendering
        this.eventBus.on('ENTITY_SELECTED', (id) => {
            this.selectedId = id;
        });

        // 📡 Subscribe to Spawner/Environment pixel updates
        this.eventBus.on('CACHE_PIXEL_UPDATE', (data) => {
            if (data.reason === 'biome_change' || this.viewFlags.fertility) {
                this.updateCachePixel(data.x, data.y);
            }
        });
        this.eventBus.on('REFRESH_WATER_PIXELS', () => {
            this.refreshWaterPixels();
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

    init() {
        this.terrainGen.generate(this.mapWidth, this.mapHeight); // Call the new generate method
        let total = 0;
        let potential = 0;
        const fb = this.terrainGen.fertilityBuffer;
        const bb = this.terrainGen.biomeBuffer;
        for (let i = 0; i < fb.length; i++) {
            total += fb[i];
            potential += this.environment.getMaxFertility(bb[i]);
        }

        this.monitor.setInitialFertility(total, potential);
        this.refreshWaterPixels();
        this.preRenderTerrain();
    }

    updateFertilityStat(oldVal, newVal) { this.monitor.updateFertilityStat(oldVal, newVal); }
    updatePotentialStat(oldMax, newMax) { this.monitor.updatePotentialStat(oldMax, newMax); }

    preRenderTerrain() {
        this.chunkManager.markAllDirty();
        this.chunkManager.render(this.terrainCtx);
    }

    renderDirtyTiles() {
        this.chunkManager.render(this.terrainCtx);
    }

    updateCachePixel(x, y) {
        this.chunkManager.markDirty(x, y);
    }

    refreshWaterPixels() {
        this.waterPixels = [];
        const buffer = this.terrainGen.biomeBuffer;
        for (let i = 0; i < buffer.length; i++) { // BIOME_NAMES_TO_IDS를 사용하여 ID로 비교
            const b = buffer[i]; // b는 biomeId
            if (b === BIOME_NAMES_TO_IDS.get('OCEAN') || b === BIOME_NAMES_TO_IDS.get('DEEP_OCEAN') || b === BIOME_NAMES_TO_IDS.get('LAKE') || b === BIOME_NAMES_TO_IDS.get('RIVER')) {
                this.waterPixels.push(i);
            }
        }
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

        this.preRenderTerrain();
        this.chunkManager.dirtyChunks.clear();
    }

    setActiveTool(tool) {
        if (this.activeTool && this.activeTool.onMouseUp) {
            const command = this.activeTool.onMouseUp();
            this.dispatchCommand(command);
        }
        this.activeTool = tool;
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
                const methodToType = { spawnSheep: 'sheep', spawnHuman: 'human', spawnCow: 'cow', spawnWolf: 'wolf', spawnHyena: 'hyena', spawnWildDog: 'wild_dog' };
                const type = methodToType[command.payload.method];
                if (type) this.eventBus.emit('SPAWN_ENTITY', { type, x: command.payload.x, y: command.payload.y, isBaby: false });
                break;
            case 'TOGGLE_VIEW':
                this.toggleView(`view_${command.payload.flagName}`);
                break;
            case 'INSPECT':
                this.eventBus.emit('INSPECT_REQUEST', command.payload.worldPos);
                break;
        }
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    stop() { this.isRunning = false; }

    loop(time) {
        if (!this.isRunning) return;
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.monitor.update(time);

        this.update(dt);
        if (this.chunkManager.dirtyChunks.size > 0) this.renderDirtyTiles();
        this.render();
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        const time = performance.now();
        this.particleSystem.update(dt, time); // ParticleSystem은 자체적으로 EventBus를 통해 파티클을 생성/관리
        this.behavior.update(dt);
        this.social.update(dt);
        this.gathering.update(dt, time);
        this.consumption.update(dt);
        this.kinematics.update(dt);
        this.metabolism.update(dt, time);
        this.reproduction.update(dt, time);
        this.environment.update(dt, time);
        this.spawner.update(dt, time);
        this.wind.update(time);
        this.uiSystem.update(dt, time);

        if (this.selectedId && this.onEntitySelect && this.isFollowing) {
            const e = this.entityManager.entities.get(this.selectedId);
            if (e) {
                const t = e.components.get('Transform');
                if (t) {
                    this.camera.x = t.x - (this.width / this.camera.zoom) / 2;
                    this.camera.y = t.y - (this.height / this.camera.zoom) / 2;
                    this.camera.clamp();
                }
            }
        }
    }

    render() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.imageSmoothingEnabled = false; // 🚀 PIXEL PERFECT: No blur!
        this.ctx.translate(0, 0); // No global offset, camera handles it
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        this.ctx.drawImage(this.terrainCanvas, 0, 0);
        this.renderer.render(this.ctx, this.entityManager, this.particleSystem.particles, performance.now(), this.wind);
        this.ctx.restore();
    }
}
