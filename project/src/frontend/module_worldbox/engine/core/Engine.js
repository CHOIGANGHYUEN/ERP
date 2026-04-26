import EntityManager from './EntityManager.js';
import TerrainGen, { BIOMES } from '../world/TerrainGen.js';
import speciesConfig from '../config/species.json';

// Systems
import EntityRenderer from '../systems/render/EntityRenderer.js';
import EnvironmentSystem from '../systems/lifecycle/EnvironmentSystem.js';
import SpawnerSystem from '../systems/economy/SpawnerSystem.js';
import ConsumptionSystem from '../systems/economy/ConsumptionSystem.js';
import WindSystem from '../systems/lifecycle/WindSystem.js';
import MetabolismSystem from '../systems/lifecycle/MetabolismSystem.js';
import ReproductionSystem from '../systems/lifecycle/ReproductionSystem.js';
import SocialSystem from '../systems/motion/SocialSystem.js';
import KinematicSystem from '../systems/motion/KinematicSystem.js';
import BehaviorSystem from '../systems/behavior/BehaviorSystem.js';

export default class Engine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.entityManager = new EntityManager();
        this.terrainGen = new TerrainGen(this.entityManager);

        this.viewFlags = { wind: false, fertility: false };
        this.speciesConfig = speciesConfig;

        this.renderer = new EntityRenderer(this);
        this.environment = new EnvironmentSystem(this);
        this.spawner = new SpawnerSystem(this);
        this.wind = new WindSystem();
        this.metabolism = new MetabolismSystem(this);
        this.consumption = new ConsumptionSystem(this);
        this.reproduction = new ReproductionSystem(this);
        this.social = new SocialSystem(this);
        this.kinematics = new KinematicSystem(this);
        this.behavior = new BehaviorSystem(this);

        this.width = canvas.width;
        this.height = canvas.height;
        this.isRunning = false;
        this.lastTime = 0;
        this.time = 0;

        this.mapWidth = 1000;
        this.mapHeight = 1000;
        
        this.terrainCanvas = document.createElement('canvas');
        this.terrainCanvas.width = this.mapWidth;
        this.terrainCanvas.height = this.mapHeight;
        this.terrainCtx = this.terrainCanvas.getContext('2d');

        this.camera = { x: 0, y: 0, zoom: 1.0, isDragging: false, lastMouseX: 0, lastMouseY: 0 };
        this.activeTool = null;
        this.brushSize = 15;
        this.isPainting = false;

        this.onEntitySelect = null;
        this.selectedId = null;
        this.lastSelectedTime = 0;
        this.isFollowing = false;

        this.simParams = { spreadSpeed: 0.1, spreadAmount: 3000 };
        this.maxFertilityPool = 1000000;
        this.allocatedFertility = 0;
        
        // Performance Stats
        this.stats = {
            fps: 0,
            entityCount: 0,
            particleCount: 0,
            totalFertility: 0,
            lastFrameTime: performance.now(),
            frameCount: 0,
            lastFpsUpdate: performance.now()
        };

        this.particles = [];
        this.waterPixels = [];

        this.init();
        this.setupInput();
    }

    setActiveTool(tool) {
        this.activeTool = tool;
    }

    setBrushSize(size) {
        this.brushSize = size;
    }

    handleResize(w, h) {
        this.width = w;
        this.height = h;
    }

    init() {
        this.terrainGen.generate(this.mapWidth, this.mapHeight);
        
        // Calculate Initial Total Fertility
        let total = 0;
        const fb = this.terrainGen.fertilityBuffer;
        for (let i = 0; i < fb.length; i++) {
            total += fb[i];
        }
        this.allocatedFertility = total;

        this.refreshWaterPixels();
        this.preRenderTerrain();
    }

    updateFertilityStat(oldVal, newVal) {
        this.allocatedFertility += (newVal - oldVal);
    }

    preRenderTerrain() {
        const tw = this.mapWidth;
        const th = this.mapHeight;
        this.terrainCtx.clearRect(0, 0, tw, th);
        const imgData = this.terrainCtx.createImageData(tw, th);
        const data = imgData.data;

        for (let i = 0; i < tw * th; i++) {
            const p = i * 4;
            const color = this.terrainGen.getTerrainColor(i, this.viewFlags);
            data[p] = (color >> 16) & 0xff;
            data[p + 1] = (color >> 8) & 0xff;
            data[p + 2] = color & 0xff;
            data[p + 3] = 255;
        }
        this.terrainCtx.putImageData(imgData, 0, 0);
    }

    refreshWaterPixels() {
        this.waterPixels = [];
        const buffer = this.terrainGen.biomeBuffer;
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === BIOMES.OCEAN) this.waterPixels.push(i);
        }
    }

    toggleView(id) {
        if (id === 'view_wind') this.viewFlags.wind = !this.viewFlags.wind;
        if (id === 'view_fertility') {
            this.viewFlags.fertility = !this.viewFlags.fertility;
            this.preRenderTerrain();
        }
    }

    handleSelect(e) {
        const rect = this.canvas.getBoundingClientRect();
        const wx = (e.clientX - rect.left - this.width/2)/this.camera.zoom - this.camera.x + this.mapWidth/2;
        const wy = (e.clientY - rect.top - this.height/2)/this.camera.zoom - this.camera.y + this.mapHeight/2;

        console.log(`[Inspect] Screen(${e.clientX}, ${e.clientY}) -> World(${Math.round(wx)}, ${Math.round(wy)})`);

        let nearest = null;
        let minDist = 30; // Increased selection radius

        for (const [id, entity] of this.entityManager.entities) {
            const t = entity.components.get('Transform');
            if (t) {
                const dist = Math.sqrt((t.x - wx)**2 + (t.y - wy)**2);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = id;
                }
            }
        }

        if (nearest) {
            console.log(`[Inspect] Selected Entity: ${nearest}`);
        } else {
            console.log(`[Inspect] No entity found nearby.`);
        }

        this.selectedId = nearest;
        if (nearest && this.onEntitySelect) {
            this.onEntitySelect(this.entityManager.entities.get(nearest));
        }
    }

    setupInput() {
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            if (e.button === 0) {
                const toolType = this.activeTool?.type;
                
                if (toolType === 'inspect') {
                    this.handleSelect(e);
                } else if (this.activeTool && toolType !== 'move') {
                    this.isPainting = true;
                    this.triggerBrushAction(e);
                } else {
                    this.camera.isDragging = true;
                    this.camera.lastMouseX = e.clientX;
                    this.camera.lastMouseY = e.clientY;
                }
            } else if (e.button === 2) {
                this.camera.isDragging = true;
                this.camera.lastMouseX = e.clientX;
                this.camera.lastMouseY = e.clientY;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPainting) {
                this.triggerBrushAction(e);
            } else if (this.camera.isDragging) {
                const dx = (e.clientX - this.camera.lastMouseX) / this.camera.zoom;
                const dy = (e.clientY - this.camera.lastMouseY) / this.camera.zoom;
                this.camera.x += dx;
                this.camera.y += dy;
                this.camera.lastMouseX = e.clientX;
                this.camera.lastMouseY = e.clientY;
            }
        });

        window.addEventListener('mouseup', () => {
            this.isPainting = false;
            this.camera.isDragging = false;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.001;
            const delta = -e.deltaY;
            const factor = Math.pow(1.1, delta / 100);
            this.camera.zoom = Math.min(10.0, Math.max(0.1, this.camera.zoom * factor));
        }, { passive: false });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Gravity fall effect
            if (p.y < p.targetY) {
                p.y += p.speed;
            } else {
                // Landed!
                if (p.type === 'BIOME') {
                    const px = Math.floor(p.x);
                    const py = Math.floor(p.y);
                    if (px >= 0 && px < this.mapWidth && py >= 0 && py < this.mapHeight) {
                        const idx = py * this.mapWidth + px;
                        if (this.terrainGen.biomeBuffer[idx] === BIOMES.DIRT || this.terrainGen.biomeBuffer[idx] === BIOMES.BEACH) {
                            this.environment.changePixelBiome(idx, p.biome);
                        }
                    }
                }
                this.particles.splice(i, 1); // Remove after landing
            }
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    stop() {
        this.isRunning = false;
    }

    loop(time) {
        if (!this.isRunning) return;
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        // Update Stats
        this.stats.frameCount++;
        if (time - this.stats.lastFpsUpdate > 1000) {
            this.stats.fps = Math.round((this.stats.frameCount * 1000) / (time - this.stats.lastFpsUpdate));
            this.stats.frameCount = 0;
            this.stats.lastFpsUpdate = time;
            this.stats.entityCount = this.entityManager.entities.size;
            this.stats.particleCount = this.particles.length;
            this.stats.totalFertility = this.allocatedFertility;
        }

        this.update(dt);
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    triggerBrushAction(e) {
        if (!this.activeTool) return;
        const id = this.activeTool.id;
        
        // ---------------------------------------------------------
        // BLUEPRINT 8.1: SPRINKLE TYPE (Particle Based)
        // ---------------------------------------------------------
        if (id.startsWith('paint_') || id.startsWith('add_') || id.startsWith('remove_') || id === 'spawn_grass') {
            this.handleSprinkle(e);
        } 
        // ---------------------------------------------------------
        // BLUEPRINT 8.1: INSTANT TYPE (Point Based)
        // ---------------------------------------------------------
        else if (id === 'spawn_sheep' || id === 'spawn_human' || id === 'spawn_cow') {
            this.handleSpawn(e);
        }
    }

    handleSpawn(e) {
        const rect = this.canvas.getBoundingClientRect();
        const wx = (e.clientX - rect.left - this.width/2)/this.camera.zoom - this.camera.x + this.mapWidth/2;
        const wy = (e.clientY - rect.top - this.height/2)/this.camera.zoom - this.camera.y + this.mapHeight/2;
        
        const id = this.activeTool.id;
        if (id === 'spawn_sheep') this.spawner.spawnSheep(wx, wy);
        if (id === 'spawn_human') this.spawner.spawnHuman(wx, wy);
        if (id === 'spawn_cow') this.spawner.spawnSheep(wx, wy, false); // Assuming same spawner
    }

    handleSprinkle(e) {
        const rect = this.canvas.getBoundingClientRect();
        const wx = (e.clientX - rect.left - this.width/2)/this.camera.zoom - this.camera.x + this.mapWidth/2;
        const wy = (e.clientY - rect.top - this.height/2)/this.camera.zoom - this.camera.y + this.mapHeight/2;
        
        const id = this.activeTool.id;
        const colorMap = { 
            'paint_grass': '#a8e063', 'spawn_grass': '#c5e1a5', 
            'paint_sand': '#f4d03f', 'paint_jungle': '#2d5a27', 
            'paint_dirt': '#8d6e63', 'add_water': '#3498db' 
        };
        
        // BLUEPRINT RULE: Biomes ONLY biomes, Plants ONLY plants.
        const action = id === 'spawn_grass' ? 'SPAWN_PLANT' : 'CHANGE_BIOME';
        const count = id === 'spawn_grass' ? 12 : 8;

        for(let i=0; i<count; i++){
            this.particles.push({
                x: wx + (Math.random()-0.5)*this.brushSize * 3,
                y: wy + (Math.random()-0.5)*this.brushSize * 3 - 150, 
                targetY: wy + (Math.random()-0.5)*this.brushSize * 3,
                type: 'BIOME',
                action: action, // STRICT ACTION SEPARATION
                biome: this.getToolBiome(),
                color: colorMap[id] || '#ffffff',
                speed: 4 + Math.random()*3
            });
        }
    }

    getToolBiome() {
        const id = this.activeTool?.id;
        if (id === 'add_water') return BIOMES.OCEAN;
        if (id === 'paint_grass' || id === 'spawn_grass') return BIOMES.GRASS;
        if (id === 'paint_sand') return BIOMES.SAND;
        if (id === 'paint_jungle') return BIOMES.JUNGLE;
        return BIOMES.DIRT;
    }

    updateCachePixel(x, y) {
        const idx = y * this.mapWidth + x;
        const color = this.terrainGen.getTerrainColor(idx, this.viewFlags);
        this.terrainCtx.fillStyle = `rgb(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff})`;
        this.terrainCtx.fillRect(x, y, 1, 1);
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (p.vx) { p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--; if(p.life<=0) this.particles.splice(i,1); continue; }

            if (p.y < p.targetY) {
                p.y += p.speed;
            } else {
                if (p.type === 'BIOME') {
                    const idx = Math.floor(p.y) * this.mapWidth + Math.floor(p.x);
                    if (idx >= 0 && idx < this.terrainGen.biomeBuffer.length) {
                        const fertile = this.terrainGen.fertilityBuffer[idx] || 0;
                        
                        // 1. ONLY CHANGE BIOME (Meadow, Desert, etc.)
                        if (p.action === 'CHANGE_BIOME') {
                            this.environment.changePixelBiome(idx, p.biome);
                        }
                        // 2. ONLY SPAWN PLANTS (Sprinkle Grass tool)
                        else if (p.action === 'SPAWN_PLANT' && fertile > 0.1) {
                            this.spawner.spawnGrass(p.x, p.y, fertile);
                        }
                    }
                }
                this.particles.splice(i, 1);
            }
        }
    }

    update(dt) {
        if (!this.isRunning) return;
        const time = performance.now();
        this.time = time;

        this.updateParticles(dt);
        this.behavior.update(dt);    // 1. Think
        this.social.update(dt);      // 2. Adjust Social Forces
        this.consumption.update(dt); // 3. Target Food
        this.kinematics.update(dt);  // 4. Move!
        
        this.metabolism.update(dt, time);
        this.reproduction.update(dt);
        this.environment.update(dt, time);
        this.spawner.update(dt, time);
        this.wind.update(time);

        if (this.selectedId && this.onEntitySelect) {
            const e = this.entityManager.entities.get(this.selectedId);
            if (e) {
                const m = e.components.get('Metabolism');
                const a = e.components.get('Animal');
                this.onEntitySelect({ id: e.id, type: a?.type, stomach: m?.stomach, fertility: m?.storedFertility });
                if (this.isFollowing) {
                    const t = e.components.get('Transform');
                    if (t) {
                        this.camera.x += (-(t.x - this.mapWidth/2) - this.camera.x) * 0.1;
                        this.camera.y += (-(t.y - this.mapHeight/2) - this.camera.y) * 0.1;
                    }
                }
            }
        }
    }

    render() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.translate(this.width/2, this.height/2);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(this.camera.x - this.mapWidth/2, this.camera.y - this.mapHeight/2);
        this.ctx.drawImage(this.terrainCanvas, 0, 0);
        this.renderer.render(this.ctx, this.entityManager, this.particles, this.time, this.wind);
        this.ctx.restore();
    }
}