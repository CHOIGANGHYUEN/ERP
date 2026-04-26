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

        this.particles = [];
        this.isRunning = false;
        this.lastTime = 0;
        this.time = 0;

        this.activeTool = null;
        this.isPainting = false;
        this.brushSize = 15;
        this.viewFlags = { wind: false, fertility: false };
        this.simParams = { spreadSpeed: 0.1, spreadAmount: 3000 }; // 🚀 UI Params Sync

        this.onEntitySelect = null;
        this.selectedId = null;
        this.dirtyTiles = new Set();
        this.isFollowing = false;

        this.stats = {
            fps: 0, frameCount: 0, lastFpsUpdate: 0,
            entityCount: 0, totalFertility: 0, totalMaxFertility: 0
        };

        this.allocatedFertility = 0;
        this.maxPotentialFertility = 0;

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
        
        this.allocatedFertility = total;
        this.maxPotentialFertility = potential;
        this.refreshWaterPixels();
        this.preRenderTerrain();
    }

    updateFertilityStat(oldVal, newVal) { this.allocatedFertility += (newVal - oldVal); }
    updatePotentialStat(oldMax, newMax) { this.maxPotentialFertility += (newMax - oldMax); }

    preRenderTerrain() {
        const tw = this.mapWidth;
        const th = this.mapHeight;
        const buffer = new Uint32Array(tw * th);
        
        for (let i = 0; i < tw * th; i++) {
            const color = this.terrainGen.getTerrainColor(i, this.viewFlags);
            const r = (color >> 16) & 0xff;
            const g = (color >> 8) & 0xff;
            const b = color & 0xff;
            
            // 🚀 LITTLE ENDIAN FIX: Result must be [R, G, B, A] in memory
            // Memory Byte Order: Index 0:R, 1:G, 2:B, 3:A
            // Which means Uint32 should be 0xAABBGGRR
            buffer[i] = (255 << 24) | (b << 16) | (g << 8) | r;
        }

        const imgData = new ImageData(new Uint8ClampedArray(buffer.buffer), tw, th);
        this.terrainCtx.putImageData(imgData, 0, 0);
    }

    renderDirtyTiles() {
        const tw = this.mapWidth;
        const ctx = this.terrainCtx;
        for (const idx of this.dirtyTiles) {
            const x = idx % tw;
            const y = Math.floor(idx / tw);
            const color = this.terrainGen.getTerrainColor(idx, this.viewFlags);
            ctx.fillStyle = `rgb(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff})`;
            ctx.fillRect(x, y, 1, 1);
        }
        this.dirtyTiles.clear();
    }

    updateCachePixel(x, y) {
        const idx = y * this.mapWidth + x;
        this.dirtyTiles.add(idx);
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
        this.dirtyTiles.clear();
    }

    setActiveTool(tool) {
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
            this.dirtyTiles.clear();
        }
    }

    handleSelect(e) {
        const rect = this.canvas.getBoundingClientRect();
        const world = this.camera.screenToWorld(e.clientX, e.clientY, rect);
        
        let nearest = null;
        let minDist = 30;

        for (const [id, entity] of this.entityManager.entities) {
            const t = entity.components.get('Transform');
            if (t) {
                const dist = Math.sqrt((t.x - world.x)**2 + (t.y - world.y)**2);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = id;
                }
            }
        }

        this.selectedId = nearest;
        if (nearest && this.onEntitySelect) {
            const target = this.entityManager.entities.get(nearest);
            const m = target.components.get('Metabolism');
            const a = target.components.get('Animal');
            this.onEntitySelect({ id: target.id, type: a?.type, stomach: m?.stomach, fertility: m?.storedFertility });
        }
    }

    setupInput() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                const toolType = this.activeTool?.type;
                if (toolType === 'inspect') {
                    this.handleSelect(e);
                } else if (this.activeTool && toolType !== 'move') {
                    this.isPainting = true;
                    this.triggerBrushAction(e);
                } else {
                    this.camera.handleMouseDown(e);
                }
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPainting) {
                this.triggerBrushAction(e);
            } else {
                this.camera.handleMouseMove(e);
            }
        });

        window.addEventListener('mouseup', () => {
            this.isPainting = false;
            this.camera.handleMouseUp();
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.handleWheel(e);
        }, { passive: false });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    triggerBrushAction(e) {
        if (!this.activeTool) return;
        const id = this.activeTool.id;
        if (id.startsWith('paint_') || id === 'add_water' || id === 'spawn_grass' || id === 'spawn_flower') {
            this.handleSprinkle(e);
        } else if (['spawn_sheep', 'spawn_human', 'spawn_cow'].includes(id)) {
            this.handleSpawn(e);
        }
    }

    handleSpawn(e) {
        const rect = this.canvas.getBoundingClientRect();
        const world = this.camera.screenToWorld(e.clientX, e.clientY, rect);
        const id = this.activeTool.id;
        if (id === 'spawn_sheep') this.spawner.spawnSheep(world.x, world.y);
        if (id === 'spawn_human') this.spawner.spawnHuman(world.x, world.y);
        if (id === 'spawn_cow') this.spawner.spawnCow(world.x, world.y);
    }

    handleSprinkle(e) {
        const rect = this.canvas.getBoundingClientRect();
        const world = this.camera.screenToWorld(e.clientX, e.clientY, rect);
        const id = this.activeTool.id;
        
        // Determine action and color based on tool
        let action = 'CHANGE_BIOME';
        if (id === 'spawn_grass') action = 'SPAWN_PLANT';
        if (id === 'spawn_flower') action = 'SPAWN_FLOWER';

        const colorMap = { 
            'paint_grass': '#a8e063', 'spawn_grass': '#c5e1a5', 
            'paint_sand': '#f4d03f', 'paint_jungle': '#2d5a27', 
            'paint_dirt': '#8d6e63', 'add_water': '#3498db',
            'spawn_flower': '#ff80ab' 
        };

        const count = (id === 'spawn_grass' || id === 'spawn_flower') ? 12 : 8;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: world.x + (Math.random() - 0.5) * this.brushSize * 3,
                y: world.y + (Math.random() - 0.5) * this.brushSize * 3 - 150,
                targetY: world.y + (Math.random() - 0.5) * this.brushSize * 3,
                type: 'BIOME',
                action: action,
                biome: this.getToolBiome(),
                color: colorMap[id] || '#ffffff',
                speed: 4 + Math.random() * 3
            });
        }
    }

    getToolBiome() {
        const id = this.activeTool?.id;
        if (id === 'add_water') return BIOMES.OCEAN;
        if (['paint_grass', 'spawn_grass'].includes(id)) return BIOMES.GRASS;
        if (id === 'paint_sand') return BIOMES.SAND;
        if (id === 'paint_jungle') return BIOMES.JUNGLE;
        return BIOMES.DIRT;
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

        if (time - this.stats.lastFpsUpdate > 1000) {
            this.stats.fps = Math.round(this.stats.frameCount);
            this.stats.frameCount = 0;
            this.stats.lastFpsUpdate = time;
            this.stats.entityCount = this.entityManager.entities.size;
            this.stats.totalFertility = this.allocatedFertility;
            this.stats.totalMaxFertility = this.maxPotentialFertility;
        }
        this.stats.frameCount++;

        this.update(dt);
        if (this.dirtyTiles.size > 0) this.renderDirtyTiles();
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