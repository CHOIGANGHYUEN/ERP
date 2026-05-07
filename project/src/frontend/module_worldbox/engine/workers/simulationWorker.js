/**
 * ⚙️ SimulationWorker (백그라운드 시뮬레이션 워커)
 * 지형 데이터(비옥도, 바이옴 등)와 엔티티 로직을 메인 스레드와 병렬로 처리합니다.
 * SharedArrayBuffer를 통해 메인 스레드와 메모리를 공유합니다.
 */

let buffers = null;
let simParams = { spreadSpeed: 1.0, spreadAmount: 1000, gameSpeed: 1.0 };
let lastTime = Date.now();
let mapWidth = 0;
let mapHeight = 0;
let commandQueue = [];

// 로컬 TypedArray 뷰
let terrain, biomes, fertility, waterQuality, mineralDensity, occupancy, territory, packed, altitude;

// 바이옴 ID 상수
const DIRT_ID = 5;
const GRASS_ID = 6;

self.onmessage = function(e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT':
            init(payload);
            break;
        case 'UPDATE_PARAMS':
            simParams = { ...simParams, ...payload };
            break;
        case 'APPLY_TOOL':
        case 'APPLY_GOD_POWER':
        case 'DISPATCH_COMMAND':
            commandQueue.push({ type, payload });
            break;
    }
};

function init(data) {
    buffers = data;
    mapWidth = data.mapWidth;
    mapHeight = data.mapHeight;
    if (data.simParams) simParams = { ...simParams, ...data.simParams };

    // SharedArrayBuffer로부터 TypedArray 뷰 생성
    terrain = new Uint8Array(data.terrain);
    biomes = new Uint32Array(data.biomes);
    fertility = new Uint8Array(data.fertility);
    waterQuality = new Uint8Array(data.waterQuality);
    mineralDensity = new Uint8Array(data.mineralDensity);
    occupancy = new Uint8Array(data.occupancy);
    territory = new Uint16Array(data.territory);
    altitude = new Uint8Array(data.altitude);
    packed = new Uint32Array(data.packed);

    console.log('[Worker] Simulation initialized.');
    
    // 시뮬레이션 루프 시작
    tick();
}

function tick() {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    // 배속(gameSpeed) 적용
    const scaledDt = dt * (simParams.gameSpeed || 1.0);
    
    // 큐에 쌓인 명령 처리
    processCommands();
    
    updateSimulation(scaledDt);

    // 시뮬레이션 속도에 따라 틱 간격 조절 (CPU 점유율 제어)
    const interval = Math.max(16, 32 / (simParams.spreadSpeed || 1.0));
    setTimeout(tick, interval); 
}

function updateSimulation(dt) {
    if (!fertility) return;

    // 1. 🌿 바이옴 확산 (Biome Spreading)
    processBiomeSpreading(dt);

    // 2. 🧪 비옥도 자연 회복 (Fertility Recovery)
    processFertilityRecovery(dt);

    // 3. 🌊 수질 및 흐름 시뮬레이션 (Water & Pollution Flow)
    processWaterSimulation(dt);
}

function processBiomeSpreading(dt) {
    const amount = Math.floor((simParams.spreadAmount || 1000) * (dt > 0 ? 1 : 0));
    if (amount <= 0) return;
    
    for (let i = 0; i < amount; i++) {
        const x = Math.floor(Math.random() * mapWidth);
        const y = Math.floor(Math.random() * mapHeight);
        const idx = y * mapWidth + x;

        if (Atomics.load(biomes, idx) !== DIRT_ID) continue;

        const f = Atomics.load(fertility, idx);
        if (f < 50) continue;

        let hasGrassNeighbor = false;
        if (x > 0 && Atomics.load(biomes, idx - 1) === GRASS_ID) hasGrassNeighbor = true;
        else if (x < mapWidth - 1 && Atomics.load(biomes, idx + 1) === GRASS_ID) hasGrassNeighbor = true;
        else if (y > 0 && Atomics.load(biomes, idx - mapWidth) === GRASS_ID) hasGrassNeighbor = true;
        else if (y < mapHeight - 1 && Atomics.load(biomes, idx + mapWidth) === GRASS_ID) hasGrassNeighbor = true;

        if (hasGrassNeighbor) {
            const spreadChance = f * 0.0005 * (simParams.spreadSpeed || 1.0);
            if (Math.random() < spreadChance) {
                Atomics.store(biomes, idx, GRASS_ID);
                syncPackedPixel(idx);
                self.postMessage({ type: 'PIXEL_UPDATE', payload: { x, y, reason: 'biome_spread' } });
            }
        }
    }
}

function processFertilityRecovery(dt) {
    const recoveryCount = Math.floor(2000 * (dt > 0 ? 1 : 0));
    for (let i = 0; i < recoveryCount; i++) {
        const idx = Math.floor(Math.random() * (mapWidth * mapHeight));
        if (Atomics.load(terrain, idx) === 5) {
            const currentF = Atomics.load(fertility, idx);
            if (currentF < 200) {
                const b = Atomics.load(biomes, idx);
                const boost = (b === 6 || b === 7) ? 2 : 1;
                Atomics.store(fertility, idx, Math.min(200, currentF + boost));
                syncPackedPixel(idx);
            }
        }
    }
}

function processWaterSimulation(dt) {
    // 🚀 [Expert Logic] 수질 오염 확산 및 고도 기반 흐름 시뮬레이션
    const updateCount = 3000;
    for (let i = 0; i < updateCount; i++) {
        const x = Math.floor(Math.random() * mapWidth);
        const y = Math.floor(Math.random() * mapHeight);
        const idx = y * mapWidth + x;

        // 물 타일인 경우에만 처리 (0: Deep, 1: Ocean, 2: Lake, 3: River)
        const t = Atomics.load(terrain, idx);
        if (t > 3) continue;

        const currentW = Atomics.load(waterQuality, idx);
        const currentA = Atomics.load(altitude, idx);

        // 주변 타일로 오염 확산
        const nx = x + (Math.random() > 0.5 ? 1 : -1);
        const ny = y + (Math.random() > 0.5 ? 1 : -1);

        if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
            const nIdx = ny * mapWidth + nx;
            const nt = Atomics.load(terrain, nIdx);
            
            // 인접한 타일이 물인 경우
            if (nt <= 3) {
                const nW = Atomics.load(waterQuality, nIdx);
                const nA = Atomics.load(altitude, nIdx);

                // 고도가 낮은 쪽으로 오염이 더 잘 흘러감
                const diff = currentW - nW;
                if (Math.abs(diff) > 5) {
                    const flowRate = (currentA > nA) ? 0.2 : 0.05;
                    const transfer = Math.floor(diff * flowRate);
                    
                    Atomics.sub(waterQuality, idx, transfer);
                    Atomics.add(waterQuality, nIdx, transfer);
                    
                    syncPackedPixel(idx);
                    syncPackedPixel(nIdx);
                    
                    if (Math.random() < 0.1) {
                        self.postMessage({ type: 'PIXEL_UPDATE', payload: { x, y, reason: 'water_flow' } });
                    }
                }
            }
        }
    }
}

function processCommands() {
    if (commandQueue.length === 0) return;

    const commands = commandQueue;
    commandQueue = [];

    for (const cmd of commands) {
        const { type, payload } = cmd;
        if (type === 'APPLY_TOOL' || type === 'DISPATCH_COMMAND') {
            if (payload.actionType === 'CHANGE_BIOME' || payload.action === 'CHANGE_BIOME') {
                const x = Math.floor(payload.x);
                const y = Math.floor(payload.y);
                const idx = y * mapWidth + x;
                if (idx >= 0 && idx < mapWidth * mapHeight) {
                    Atomics.store(biomes, idx, payload.biome);
                    syncPackedPixel(idx);
                    self.postMessage({ type: 'PIXEL_UPDATE', payload: { x, y, reason: 'biome_change' } });
                }
            } else if (payload.action === 'CHANGE_BIOME_ALL') {
                const biomeId = payload.biome;
                for (let i = 0; i < biomes.length; i++) {
                    // 육지만 채우기 (5: DIRT, 6: GRASS, 7: JUNGLE, 4: SAND, 8: LOW_MOUNTAIN, 9: HIGH_MOUNTAIN)
                    const t = Atomics.load(terrain, i);
                    if (t >= 4) {
                        Atomics.store(biomes, i, biomeId);
                        syncPackedPixel(i);
                    }
                }
                self.postMessage({ type: 'PIXEL_UPDATE', payload: { all: true, reason: 'fill_biome' } });
            }
        } else if (type === 'APPLY_GOD_POWER') {
            // ⚡ 신의 권능 처리 (예: 폭탄 투하 시 비옥도 감소 등)
            const { x, y, radius, powerType } = payload;
            const rSq = radius * radius;
            
            const startX = Math.max(0, Math.floor(x - radius));
            const endX = Math.min(mapWidth - 1, Math.floor(x + radius));
            const startY = Math.max(0, Math.floor(y - radius));
            const endY = Math.min(mapHeight - 1, Math.floor(y + radius));

            for (let ty = startY; ty <= endY; ty++) {
                for (let tx = startX; tx <= endX; tx++) {
                    const dx = tx - x;
                    const dy = ty - y;
                    if (dx * dx + dy * dy <= rSq) {
                        const idx = ty * mapWidth + tx;
                        if (powerType === 'meteor' || powerType === 'lightning') {
                            Atomics.store(fertility, idx, 0);
                            Atomics.store(biomes, idx, DIRT_ID);
                        } else if (powerType === 'bless') {
                            const currentF = Atomics.load(fertility, idx);
                            Atomics.store(fertility, idx, Math.min(255, currentF + 50));
                        }
                        syncPackedPixel(idx);
                        if (Math.random() < 0.1) {
                            self.postMessage({ type: 'PIXEL_UPDATE', payload: { x: tx, y: ty, reason: 'god_power' } });
                        }
                    }
                }
            }
        }
    }
}

function syncPackedPixel(idx) {
    const t = Atomics.load(terrain, idx);
    const b = Atomics.load(biomes, idx);
    const f = Atomics.load(fertility, idx);
    const w = Math.max(Atomics.load(waterQuality, idx), Atomics.load(mineralDensity, idx));
    
    const packedVal = t | (b << 8) | (f << 16) | (w << 24);
    Atomics.store(packed, idx, packedVal);
}
