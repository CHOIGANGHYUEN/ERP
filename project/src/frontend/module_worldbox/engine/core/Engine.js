import TerrainGen, { BIOMES } from '../world/TerrainGen.js';
import Camera from './Camera.js';
import EntityRenderer from '../systems/render/EntityRenderer.js';
import EntityManager from './EntityManager.js';
import BehaviorSystem from '../systems/behavior/BehaviorSystem.js';
import SocialSystem from '../systems/motion/SocialSystem.js';
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

export default class Engine {
    constructor(canvas) {
        this.canvas = canvas;
        this.speciesConfig = speciesConfig;

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
        this.entityManager = new EntityManager();
        this.renderer = new EntityRenderer(this);

        this.behavior = new BehaviorSystem(this);
        this.social = new SocialSystem(this);
        this.consumption = new ConsumptionSystem(this);
        this.kinematics = new KinematicSystem(this);
        this.metabolism = new MetabolismSystem(this);
        this.reproduction = new ReproductionSystem(this);
        this.environment = new EnvironmentSystem(this);
        this.spawner = new SpawnerSystem(this);
        this.wind = new WindSystem(this);
        this.entityFactory = new EntityFactory(this);

        this.particles = [];
        this.isRunning = false;
        this.lastTime = 0;
        this.time = 0;

        this.activeTool = null;
        this.isPainting = false;
        this.brushSize = 15;
        this.viewFlags = { wind: false, fertility: false, xray: false };
        this.simParams = { spreadSpeed: 0.1, spreadAmount: 3000 }; // 🚀 UI Params Sync

        this.onEntitySelect = null;
        this.selectedId = null;
        this.chunkManager = new ChunkManager(this, 50);
        this.isFollowing = false;

        this.monitor = new StatsMonitor(this);

        this.init();
        this.setupInput();
    }

    init() {
        this.terrainGen.generate(this.mapWidth, this.mapHeight);
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
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === BIOMES.OCEAN) this.waterPixels.push(i);
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
            this.activeTool.onMouseUp({ camera: this.camera });
        }
        this.activeTool = tool;
        // Reset painting state when switching tools
        this.isPainting = false;
        if (this.camera) this.camera.isDragging = false;
    }

    toggleView(id) {
        if (id === 'view_wind') this.viewFlags.wind = !this.viewFlags.wind;
        if (id === 'view_fertility') {
            this.viewFlags.fertility = !this.viewFlags.fertility;
            this.preRenderTerrain();
            this.chunkManager.dirtyChunks.clear();
        }
        if (id === 'view_xray') this.viewFlags.xray = !this.viewFlags.xray;
    }

    handleSelect(e) {
        const rect = this.canvas.getBoundingClientRect();
        const world = this.camera.screenToWorld(e.clientX, e.clientY, rect);

        let nearest = null;
        let minDist = 30;

        for (const [id, entity] of this.entityManager.entities) {
            const t = entity.components.get('Transform');
            if (t) {
                const dist = Math.sqrt((t.x - world.x) ** 2 + (t.y - world.y) ** 2);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = id;
                }
            }
        }

        this.selectedId = nearest;
        if (nearest && this.onEntitySelect) {
            this.onEntitySelect(this.getEntityData(nearest));
        } else if (!nearest && this.onEntitySelect) {
            this.onEntitySelect(null);
        }
    }

    getEntityData(id) {
        const target = this.entityManager.entities.get(id);
        if (!target) return null;

        const m = target.components.get('Metabolism');
        const a = target.components.get('Animal');
        const v = target.components.get('Visual');
        const r = target.components.get('Resource');
        const stateComp = target.components.get('AIState');

        let name = 'Unknown';
        let type = v?.type || a?.type || 'unknown';
        let subType = v?.treeType || v?.role || null;
        let state = 'Normal';
        let fertility = m?.storedFertility || r?.storedFertility || 0;
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

        return {
            id: target.id, type: type, subType: subType, name: name, state: state,
            stomach: m?.stomach, maxStomach: m?.maxStomach, fertility: fertility,
            quality: v?.quality, inhabitants: inhabitants, resourceValue: r?.value || r?.amount || 0,
            animalYield: animalYield,
            rank: a?.rank
        };
    }

    setupInput() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                if (this.activeTool && this.activeTool.onMouseDown) {
                    const rect = this.canvas.getBoundingClientRect();
                    const world = this.camera.screenToWorld(e.clientX, e.clientY, rect);
                    this.activeTool.onMouseDown({
                        e, engine: this, camera: this.camera, world,
                        brushSize: this.brushSize, particles: this.particles
                    });
                } else {
                    this.camera.handleMouseDown(e); // 기본 동작은 화면 이동
                }
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.activeTool && this.activeTool.onMouseMove) {
                const rect = this.canvas.getBoundingClientRect();
                const world = this.camera.screenToWorld(e.clientX, e.clientY, rect);
                this.activeTool.onMouseMove({
                    e, engine: this, camera: this.camera, world,
                    brushSize: this.brushSize, particles: this.particles
                });
            } else {
                this.camera.handleMouseMove(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.activeTool && this.activeTool.onMouseUp) {
                this.activeTool.onMouseUp({ e, engine: this, camera: this.camera });
            } else {
                this.camera.handleMouseUp();
            }
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.handleWheel(e);
        }, { passive: false });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'x') {
                this.toggleView('view_xray');
            }
        });
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (p.y < p.targetY) { p.y += p.speed; } else {
                if (p.type === 'BIOME') {
                    const idx = Math.floor(p.y) * this.mapWidth + Math.floor(p.x);
                    if (idx >= 0 && idx < this.terrainGen.biomeBuffer.length) {
                        if (p.action === 'CHANGE_BIOME') this.environment.changePixelBiome(idx, p.biome);
                        else if (p.action === 'SPAWN_PLANT') {
                            const fertile = this.terrainGen.fertilityBuffer[idx] || 0;
                            if (fertile > 0.1) this.spawner.spawnGrass(p.x, p.y, fertile);
                        }
                        else if (p.action === 'SPAWN_FLOWER') {
                            const fertile = this.terrainGen.fertilityBuffer[idx] || 0;
                            if (fertile > 0.1) this.spawner.spawnFlower(p.x, p.y, fertile);
                        }
                        else if (p.action === 'SPAWN_TREE') {
                            const fertile = this.terrainGen.fertilityBuffer[idx] || 0;
                            if (fertile > 0.15) this.spawner.spawnTree(p.x, p.y, p.treeType, fertile);
                        }
                    }
                }
                this.particles.splice(i, 1);
            }
        }
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
        this.updateParticles(dt);
        this.behavior.update(dt);
        this.social.update(dt);
        this.consumption.update(dt);
        this.kinematics.update(dt);
        this.metabolism.update(dt, time);
        this.reproduction.update(dt);
        this.environment.update(dt, time);
        this.spawner.update(dt, time);
        this.wind.update(time);

        // 선택된 객체가 있다면 매 프레임 UI로 최신 데이터를 동기화
        if (this.selectedId && this.onEntitySelect) {
            const data = this.getEntityData(this.selectedId);
            if (data) {
                this.onEntitySelect(data);
            } else {
                // 동물이 굶어 죽거나 풀이 먹혀서 사라진 경우 상태창 닫기
                this.selectedId = null;
                this.onEntitySelect(null);
            }
        }

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
        this.renderer.render(this.ctx, this.entityManager, this.particles, performance.now(), this.wind);
        this.ctx.restore();
    }
}