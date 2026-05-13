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
let pixelUpdateQueue = []; // 🚀 [Task 94] Batch IPC Queue

// 로컬 TypedArray 뷰
let terrain, biomes, fertility, waterQuality, mineralDensity, occupancy, territory, packed, altitude, renderBuffer;
let colorLUT; // 🎨 Color Look-Up Table

// 바이옴 ID 상수
const DIRT_ID = 5;
const GRASS_ID = 6;

/** ⚡ [Expert Port] Perlin Noise Table & Utils */
const _p = new Uint8Array(512);
function initNoise() {
    const p = new Uint8Array(256);
    for(let i=0; i<256; i++) p[i] = i;
    for(let i=255; i>0; i--) {
        const r = Math.floor(Math.random() * (i + 1));
        [p[i], p[r]] = [p[r], p[i]];
    }
    for(let i=0; i<512; i++) _p[i] = p[i & 255];
}

function perlin(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = x * x * x * (x * (x * 6 - 15) + 10);
    const v = y * y * y * (y * (y * 6 - 15) + 10);
    const A = _p[X] + Y, AA = _p[A], AB = _p[A + 1];
    const B = _p[X + 1] + Y, BA = _p[B], BB = _p[B + 1];

    const grad2 = (hash, x, y) => {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };

    return (1 + (1 - v) * ((1 - u) * grad2(_p[AA], x, y) + u * grad2(_p[BA], x - 1, y)) +
           v * ((1 - u) * grad2(_p[AB], x, y - 1) + u * grad2(_p[BB], x - 1, y - 1))) * 0.5;
}

/** 🎨 ABGR 색상 추출 유틸 */
function getCachedColor(t, b, f) {
    if (!colorLUT) return 0xFF000000;
    const fIdx = f >> 4; // 0-15
    return colorLUT[(t << 8) | (b << 4) | fIdx];
}

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
        case 'GENERATE_TERRAIN':
            generateTerrainBackground(payload);
            break;
        case 'REBUILD_HPA_GRAPH':
            rebuildHPAGraph(payload);
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
    renderBuffer = new Uint32Array(data.renderBuffer);
    colorLUT = new Uint32Array(data.colorLUT);

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

    // 🚀 [Task 94] Flush queued updates to main thread
    if (pixelUpdateQueue.length > 0) {
        self.postMessage({ type: 'PIXEL_UPDATE_BATCH', payload: pixelUpdateQueue });
        pixelUpdateQueue = [];
    }

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

    // 4. 🏭 인간 활동 영향 (Human Impact)
    processHumanImpact(dt);
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
        const w = Atomics.load(waterQuality, idx);
        
        // 🚀 [Expert Logic] 비옥도가 낮거나 수질 오염이 심하면 바이옴 확산 저하
        if (f < 50 || w > 150) continue;

        let hasGrassNeighbor = false;
        if (x > 0 && Atomics.load(biomes, idx - 1) === GRASS_ID) hasGrassNeighbor = true;
        else if (x < mapWidth - 1 && Atomics.load(biomes, idx + 1) === GRASS_ID) hasGrassNeighbor = true;
        else if (y > 0 && Atomics.load(biomes, idx - mapWidth) === GRASS_ID) hasGrassNeighbor = true;
        else if (y < mapHeight - 1 && Atomics.load(biomes, idx + mapWidth) === GRASS_ID) hasGrassNeighbor = true;

        if (hasGrassNeighbor) {
            // 수질 오염도에 따른 확산 속도 패널티 (w=0 이면 1.0, w=255 이면 0.2)
            const pollutionPenalty = 1.0 - (w / 255) * 0.8;
            const spreadChance = f * 0.0005 * (simParams.spreadSpeed || 1.0) * pollutionPenalty;
            if (Math.random() < spreadChance) {
                Atomics.store(biomes, idx, GRASS_ID);
                syncPackedPixel(idx);
                pixelUpdateQueue.push({ x, y, reason: 'biome_spread' }); // 🚀 [Task 94] Batching
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
                        pixelUpdateQueue.push({ x, y, reason: 'water_flow' }); // 🚀 [Task 94] Batching
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
                    pixelUpdateQueue.push({ x, y, reason: 'biome_change' }); // 🚀 [Task 94] Batching
                }
            } else if (payload.action === 'CHANGE_BIOME_ALL') {
                const biomeId = payload.biome;
                for (let i = 0; i < biomes.length; i++) {
                    const t = Atomics.load(terrain, i);
                    if (t >= 4) {
                        Atomics.store(biomes, i, biomeId);
                        syncPackedPixel(i);
                    }
                }
                pixelUpdateQueue.push({ all: true, reason: 'fill_biome' }); // 🚀 [Task 94] Batching
            }
        } else if (type === 'APPLY_GOD_POWER') {
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
                            pixelUpdateQueue.push({ x: tx, y: ty, reason: 'god_power' }); // 🚀 [Task 94] Batching
                        }
                    }
                }
            }
        }
    }
}

function processHumanImpact(dt) {
    // 🏭 [Expert Logic] 인간/건물 밀집 지역의 환경 부하 시뮬레이션
    const scanCount = 1500;
    for (let i = 0; i < scanCount; i++) {
        const idx = Math.floor(Math.random() * (mapWidth * mapHeight));
        const occ = Atomics.load(occupancy, idx);
        
        if (occ > 0) {
            // 밀집도에 비례하여 비옥도 감소
            const f = Atomics.load(fertility, idx);
            if (f > 0) {
                const reduction = Math.ceil(occ * 0.5);
                Atomics.store(fertility, idx, Math.max(0, f - reduction));
            }
            
            // 건물/인간 밀집 시 수질 오염 증가 (강/호수 인접 시)
            const t = Atomics.load(terrain, idx);
            if (t <= 3) {
                Atomics.add(waterQuality, idx, Math.min(5, occ));
            }
            
            syncPackedPixel(idx);
        }
    }
}

async function generateTerrainBackground(payload) {
    const { 
        width, height, seedAlt, seedHum, seedTemp, 
        landmassScale, steps = [16, 4, 1] 
    } = payload;
    
    initNoise();
    const noiseFreq = 1.0 / (landmassScale / 100);
    const totalFertility = { val: 0 };
    const potentialFertility = { val: 0 };

    for (const step of steps) {
        for (let y = 0; y < height; y += step) {
            const ny = y / height;
            const cy = ny - 0.5;

            for (let x = 0; x < width; x += step) {
                const idx = y * width + x;
                const nx = x / width;
                const cx = nx - 0.5;

                let altitudeVal = perlin(nx * 4 * noiseFreq + seedAlt, ny * 4 * noiseFreq + seedAlt) * 0.5 +
                               perlin(nx * 8 * noiseFreq + seedAlt, ny * 8 * noiseFreq + seedAlt) * 0.25 +
                               perlin(nx * 16 * noiseFreq + seedAlt, ny * 16 * noiseFreq + seedAlt) * 0.125;
                
                const distSq = cx * cx + cy * cy;
                const mask = Math.max(0, 1.0 - Math.pow(distSq * 4.0, 0.75));
                altitudeVal *= mask;

                const humidity = perlin(nx * 3 + seedHum, ny * 3 + seedHum) * 0.5 + 0.5;
                const temperature = perlin(nx * 2 + seedTemp, ny * 2 + seedTemp) * 0.5 + 0.5;

                let terrainId = 5; // SOIL
                if (altitudeVal < 0.25) terrainId = 0;
                else if (altitudeVal < 0.40) terrainId = 1;
                else if (altitudeVal < 0.45) terrainId = 4;
                else if (altitudeVal > 0.80) terrainId = 7;
                else if (altitudeVal > 0.65) terrainId = 6;

                let biomeId = 5;
                if (terrainId === 6) biomeId = 8;
                else if (terrainId === 7) biomeId = 9;
                else if (terrainId === 4) biomeId = 4;
                else if (terrainId <= 1) biomeId = terrainId;
                else {
                    if (humidity > 0.7 && temperature > 0.6) biomeId = 7;
                    else if (humidity > 0.4) biomeId = 6;
                }

                const fert = (terrainId === 4 || terrainId === 5) ? Math.floor(25 + Math.random() * 200) : 0;
                const wq = (terrainId <= 1) ? 200 : 0;
                const md = (terrainId >= 6) ? 230 : 0;

                const writeTile = (targetIdx, tId, bId, f, w, m, alt) => {
                    terrain[targetIdx] = tId;
                    biomes[targetIdx] = bId;
                    fertility[targetIdx] = f;
                    waterQuality[targetIdx] = w;
                    mineralDensity[targetIdx] = m;
                    altitude[targetIdx] = alt;
                    
                    const envValue = w > 0 ? w : m;
                    const packedVal = tId | (bId << 8) | (f << 16) | (envValue << 24);
                    packed[targetIdx] = packedVal;

                    if (renderBuffer) {
                        renderBuffer[targetIdx] = getCachedColor(tId, bId, f);
                    }
                };

                if (step === 1) {
                    writeTile(idx, terrainId, biomeId, fert, wq, md, Math.floor(altitudeVal * 255));
                } else {
                    const altInt = Math.floor(altitudeVal * 255);
                    const envValue = wq > 0 ? wq : md;
                    const packedVal = terrainId | (biomeId << 8) | (fert << 16) | (envValue << 24);
                    const color = renderBuffer ? getCachedColor(terrainId, biomeId, fert) : 0;

                    for (let dy = 0; dy < step && y + dy < height; dy++) {
                        const rOff = (y + dy) * width + x;
                        const len = Math.min(step, width - x);
                        
                        // 🏎️ [Optimization] Use .fill() for contiguous row segments
                        terrain.subarray(rOff, rOff + len).fill(terrainId);
                        biomes.subarray(rOff, rOff + len).fill(biomeId);
                        fertility.subarray(rOff, rOff + len).fill(fert);
                        waterQuality.subarray(rOff, rOff + len).fill(wq);
                        mineralDensity.subarray(rOff, rOff + len).fill(md);
                        altitude.subarray(rOff, rOff + len).fill(altInt);
                        packed.subarray(rOff, rOff + len).fill(packedVal);
                        if (renderBuffer) {
                            renderBuffer.subarray(rOff, rOff + len).fill(color);
                        }
                    }
                }

            }

            if (y % 256 === 0) {
                self.postMessage({ type: 'TERRAIN_GEN_PROGRESS', payload: { progress: y / height, step } });
                await new Promise(r => setTimeout(r, 0)); // Allow IPC to breathe
            }

        }
    }

    self.postMessage({ type: 'TERRAIN_GEN_COMPLETE' });
}

function syncPackedPixel(idx) {
    const t = Atomics.load(terrain, idx);
    const b = Atomics.load(biomes, idx);
    const f = Atomics.load(fertility, idx);
    const w = Math.max(Atomics.load(waterQuality, idx), Atomics.load(mineralDensity, idx));
    
    const packedVal = t | (b << 8) | (f << 16) | (w << 24);
    // 🛡️ [Runtime Sync] 시뮬레이션 중에는 Atomics를 사용하여 안전하게 업데이트
    if (packed.buffer instanceof SharedArrayBuffer) {
        Atomics.store(packed, idx, packedVal);
        if (renderBuffer) {
            Atomics.store(renderBuffer, idx, getCachedColor(t, b, f));
        }
    } else {
        packed[idx] = packedVal;
        if (renderBuffer) renderBuffer[idx] = getCachedColor(t, b, f);
    }
}


/** 🗺️ [Expert AI] HPA* 추상 그래프 재계산 (Offloaded from Main Thread) */
/** 🗺️ [Expert AI] HPA* 추상 그래프 재계산 (Offloaded from Main Thread) */
function rebuildHPAGraph(payload) {
    const { clusterSize, mapWidth, mapHeight, dirtyClusterIds } = payload;
    const isIncremental = Array.isArray(dirtyClusterIds);
    const cols = Math.ceil(mapWidth / clusterSize);
    const rows = Math.ceil(mapHeight / clusterSize);
    
    const abstractNodes = new Map(); // key -> { neighbors: Map }
    const clusterData = new Map();  // id -> { transitions: Map }
    const processedEdges = new Set(); // 중복 스캔 방지

    const isNavigable = (x, y) => {
        if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return false;
        const idx = y * mapWidth + x;
        const tId = Atomics.load(terrain, idx);
        const bId = Atomics.load(biomes, idx);
        // 물(0-3)이 아니고 산(7)이 아니면 통행 가능
        return bId >= 4 && tId !== 7;
    };

    const addEdge = (k1, k2, weight, c1Id, c2Id) => {
        if (!abstractNodes.has(k1)) abstractNodes.set(k1, { neighbors: new Map() });
        if (!abstractNodes.has(k2)) abstractNodes.set(k2, { neighbors: new Map() });
        abstractNodes.get(k1).neighbors.set(k2, weight);
        abstractNodes.get(k2).neighbors.set(k1, weight);

        if (c1Id !== c2Id) {
            if (!clusterData.has(c1Id)) clusterData.set(c1Id, { transitions: new Map() });
            const c1 = clusterData.get(c1Id);
            if (!c1.transitions.has(c2Id)) c1.transitions.set(c2Id, []);
            c1.transitions.get(c2Id).push({ from: k1, to: k2, weight });

            if (!clusterData.has(c2Id)) clusterData.set(c2Id, { transitions: new Map() });
            const c2 = clusterData.get(c2Id);
            if (!c2.transitions.has(c1Id)) c2.transitions.set(c1Id, []);
            c2.transitions.get(c1Id).push({ from: k2, to: k1, weight });
        }
    };

    const scanAndAddGates = (f1, f2, start, end, isVert, c1Id, c2Id) => {
        const edgeKey = [c1Id, c2Id].sort().join(':');
        if (processedEdges.has(edgeKey)) return;
        processedEdges.add(edgeKey);

        let gapStart = -1;
        for (let i = start; i < end; i++) {
            const p1 = isVert ? { x: f1, y: i } : { x: i, y: f1 };
            const p2 = isVert ? { x: f2, y: i } : { x: i, y: f2 };
            if (isNavigable(p1.x, p1.y) && isNavigable(p2.x, p2.y)) {
                if (gapStart === -1) gapStart = i;
            } else if (gapStart !== -1) {
                const mid = Math.floor((gapStart + i - 1) / 2);
                const k1 = isVert ? `${f1},${mid}` : `${mid},${f1}`;
                const k2 = isVert ? `${f2},${mid}` : `${mid},${f2}`;
                addEdge(k1, k2, 1.0, c1Id, c2Id);
                gapStart = -1;
            }
        }
        if (gapStart !== -1) {
            const mid = Math.floor((gapStart + end - 1) / 2);
            const k1 = isVert ? `${f1},${mid}` : `${mid},${f1}`;
            const k2 = isVert ? `${f2},${mid}` : `${mid},${f2}`;
            addEdge(k1, k2, 1.0, c1Id, c2Id);
        }
    };

    const processClusterBoundaries = (cx, cy) => {
        const id = `${cx},${cy}`;
        const x = cx * clusterSize;
        const y = cy * clusterSize;
        const w = Math.min(clusterSize, mapWidth - x);
        const h = Math.min(clusterSize, mapHeight - y);

        // 4방향 경계 스캔
        if (cx < cols - 1) scanAndAddGates(x + w - 1, x + w, y, y + h, true, id, `${cx + 1},${cy}`);
        if (cy < rows - 1) scanAndAddGates(y + h - 1, y + h, x, x + w, false, id, `${cx},${cy + 1}`);
        if (isIncremental && cx > 0) scanAndAddGates(x - 1, x, y, y + h, true, `${cx - 1},${cy}`, id);
        if (isIncremental && cy > 0) scanAndAddGates(y - 1, y, x, x + w, false, `${cx},${cy - 1}`, id);
    };

    // 1. 구역 간 경계점(Gates) 찾기
    const clustersToScan = isIncremental ? dirtyClusterIds : [];
    if (!isIncremental) {
        for (let cy = 0; cy < rows; cy++) {
            for (let cx = 0; cx < cols; cx++) clustersToScan.push(`${cx},${cy}`);
        }
    }

    for (const cId of clustersToScan) {
        const [cx, cy] = cId.split(',').map(Number);
        processClusterBoundaries(cx, cy);
    }

    // 2. 구역 내부 노드 간 가중치 계산 (A* 기반 Intra-Edges)
    const findIntraWeight = (sx, sy, ex, ey) => {
        const startKey = (sx << 16) | sy;
        const endKey = (ex << 16) | ey;
        if (startKey === endKey) return 0;

        const openSet = [{ x: sx, y: sy, g: 0, f: Math.abs(sx - ex) + Math.abs(sy - ey) }];
        const gScore = new Map();
        gScore.set(startKey, 0);
        const closedSet = new Set();
        let attempts = 0;

        while (openSet.length > 0 && attempts < 1000) {
            attempts++;
            // Simple sort instead of MinHeap for small cluster searches
            openSet.sort((a, b) => a.f - b.f);
            const curr = openSet.shift();
            const currKey = (curr.x << 16) | curr.y;

            if (curr.x === ex && curr.y === ey) return curr.g;

            closedSet.add(currKey);

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = curr.x + dx;
                    const ny = curr.y + dy;
                    if (nx < sx - clusterSize || nx > sx + clusterSize || ny < sy - clusterSize || ny > sy + clusterSize) continue;
                    if (!isNavigable(nx, ny) && (nx !== ex || ny !== ey)) continue;

                    const nKey = (nx << 16) | ny;
                    if (closedSet.has(nKey)) continue;

                    const weight = (dx !== 0 && dy !== 0) ? 1.414 : 1.0;
                    const tentativeG = curr.g + weight;

                    if (tentativeG < (gScore.get(nKey) || Infinity)) {
                        gScore.set(nKey, tentativeG);
                        openSet.push({ x: nx, y: ny, g: tentativeG, f: tentativeG + Math.abs(nx - ex) + Math.abs(ny - ey) });
                    }
                }
            }
        }
        return -1; // Unreachable
    };

    for (const cId of clusterData.keys()) {
        const [cx, cy] = cId.split(',').map(Number);
        const cNodes = [];
        for (const k of abstractNodes.keys()) {
            const [nx, ny] = k.split(',').map(Number);
            if (nx >= cx * clusterSize && nx < (cx + 1) * clusterSize &&
                ny >= cy * clusterSize && ny < (cy + 1) * clusterSize) {
                cNodes.push(k);
            }
        }

        for (let i = 0; i < cNodes.length; i++) {
            for (let j = i + 1; j < cNodes.length; j++) {
                const k1 = cNodes[i], k2 = cNodes[j];
                const [x1, y1] = k1.split(',').map(Number), [x2, y2] = k2.split(',').map(Number);
                
                // 🚀 [Expert AI] 단순 Manhattan 거리 대신 실제 A* 가중치 계산 (장벽/바다 무시 방지)
                const weight = findIntraWeight(x1, y1, x2, y2);
                if (weight > 0) {
                    addEdge(k1, k2, weight, cId, cId);
                }
            }
        }
    }

    // 3. 결과 직렬화 및 전송
    const serializedNodes = {};
    for (const [k, v] of abstractNodes) {
        serializedNodes[k] = { neighbors: Array.from(v.neighbors.entries()) };
    }

    const serializedClusters = {};
    for (const [k, v] of clusterData) {
        const transObj = {};
        for (const [nk, nv] of v.transitions) {
            transObj[nk] = nv;
        }
        serializedClusters[k] = { transitions: transObj };
    }

    self.postMessage({
        type: 'HPA_GRAPH_REBUILT',
        payload: { nodes: serializedNodes, clusters: serializedClusters, isIncremental }
    });
}
