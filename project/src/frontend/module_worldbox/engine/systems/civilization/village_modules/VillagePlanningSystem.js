import System from '../../../core/System.js';
import { JobTypes } from '../../../config/JobTypes.js';
import { VillageBonuses, VillageTypes } from '../../../config/VillageTypes.js';
import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * 🏗️ VillagePlanningSystem
 * 마을의 건설 계획, 청사진 배치, 구역 확장 및 발전 전략을 전담합니다.
 * VillageSystem에서 SRP에 따라 분리되었습니다.
 */
export default class VillagePlanningSystem extends System {
    constructor(entityManager, eventBus, engine, villageSystem) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.villageSystem = villageSystem;

        // 📡 Listen for events
        this.eventBus.on('BUILDING_SPAWNED', (data) => this._onBuildingSpawned(data));
        this.eventBus.on('BUILDING_COMPLETE', (data) => this._onBuildingComplete(data));
    }

    _onBuildingSpawned(data) {
        const { id, villageId } = data;
        if (villageId === undefined || villageId === -1) return;

        const village = this.villageSystem.villages.get(villageId);
        if (village) {
            if (!village.buildings) village.buildings = new Set();
            village.buildings.add(id);
        }
    }

    _onBuildingComplete(data) {
        const { id, villageId } = data;
        if (villageId === undefined || villageId === -1) return;

        const village = this.villageSystem.villages.get(villageId);
        if (!village) return;

        const entity = this.entityManager.entities.get(id);
        if (entity && entity.components.has('Storage')) {
            if (!village.storageIds) village.storageIds = new Set();
            village.storageIds.add(id);
            this.villageSystem.economySystem?.syncResources(village);
        }
    }

    update(dt) {
        for (const village of this.villageSystem.villages.values()) {
            // [Expert Fix] 마을 관리는 촌장 유무와 상관없이 시스템 레벨에서 지속되어야 함 (SRP)
            // if (!village.chiefId || !this.entityManager.entities.has(village.chiefId)) continue;

            if (village.lastPopulation !== village.members.size) {
                this._recalculateNeeds(village);
            }

            this._updateVillagePlanning(village);

            // 🗺️ 영토 지능적 확장 (ChiefRole에서 이관됨)
            village._territoryTimer = (village._territoryTimer || 0) - dt;
            if (village._territoryTimer <= 0) {
                this._processTerritoryExpansion(village);
                village._territoryTimer = 5.0; // 5초 주기
            }

            // 🚀 개척 체크
            village._expansionCooldown -= dt;
            if (village._expansionCooldown <= 0 && village.members.size >= 10 && village.resources.wood >= 50) {
                this._checkExpansion(village);
                village._expansionCooldown = 120.0;
            }

            // 🛡️ 울타리 보수
            village._fenceTimer -= dt;
            if (village._fenceTimer <= 0) {
                this._manageFences(village);
                village._fenceTimer = 30.0;
            }
        }
    }

    /** 🗺️ 영토 확장 지능 (ChiefRole에서 이관됨) */
    _processTerritoryExpansion(village) {
        const TILE_SIZE = 16;
        const targetTiles = 60 + village.members.size * 12 + village.buildings.size * 24;

        if (!village.territory || village.territory.size >= targetTiles) return;

        const candidates = this._getAdjacentTiles(village.territory);
        if (candidates.length === 0) return;

        const scoredCandidates = candidates.map(tile => ({
            tile,
            score: this._evaluateTile(tile.tx, tile.ty, TILE_SIZE, village) + (Math.random() * 5)
        })).filter(c => c.score >= 0);

        if (scoredCandidates.length === 0) return;

        scoredCandidates.sort((a, b) => b.score - a.score);
        const poolSize = Math.min(3, scoredCandidates.length);
        const choice = scoredCandidates[Math.floor(Math.random() * poolSize)];
        const bestTile = choice.tile;

        if (bestTile) {
            const key = (bestTile.ty << 16) | bestTile.tx;
            let overlap = false;
            for (const other of this.villageSystem.villages.values()) {
                if (other.id !== village.id && other.territory && other.territory.has(key)) {
                    overlap = true;
                    break;
                }
            }

                if (!overlap) {
                    this.villageSystem.territoryManager?.claimTile(village.id, bestTile.tx, bestTile.ty);
                }
        }
    }

    _getAdjacentTiles(territory) {
        const adjacent = new Map();
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const key of territory) {
            const tx = key & 0xFFFF, ty = key >> 16;
            for (const [dx, dy] of dirs) {
                const nx = tx + dx, ny = ty + dy;
                const nKey = (ny << 16) | nx;
                if (!territory.has(nKey)) adjacent.set(nKey, { tx: nx, ty: ny });
            }
        }
        return Array.from(adjacent.values());
    }

    _evaluateTile(tx, ty, tileSize, village) {
        let score = 10;
        const worldX = tx * tileSize + 8, worldY = ty * tileSize + 8;
        if (worldX < 0 || worldX >= this.engine.mapWidth || worldY < 0 || worldY >= this.engine.mapHeight) return -1;

        const tg = this.engine.terrainGen;
        if (tg) {
            if (!tg.isLandAt(worldX, worldY)) return -1;
            const idx = tg.getIndex(worldX, worldY);
            if (tg.isMountain(idx)) return -1;
            if (tg.fertilityBuffer && tg.fertilityBuffer[idx] > 150) score += 5;
        }

        if (this.engine.spatialHash) {
            const nearbyIds = this.engine.spatialHash.query(worldX, worldY, 32);
            for (const resId of nearbyIds) {
                const ent = this.entityManager.entities.get(resId);
                const res = ent?.components.get('Resource');
                if (res) {
                    if (res.type === 'tree') score += 5;
                    else if (['iron_ore', 'stone', 'gold_ore'].includes(res.type)) score += 10;
                }
            }
        }
        return score;
    }

    _recalculateNeeds(village) {
        const pop = village.members.size;
        village.lastPopulation = pop;

        village.resourceNeeds.wood = pop * 15;
        village.resourceNeeds.food = pop * 20;
        village.resourceNeeds.stone = Math.floor(pop * 5);

        const bonuses = VillageBonuses[village.type] || VillageBonuses[VillageTypes.GENERAL];

        village.resourceMax.wood = (200 + pop * 30) + (bonuses.maxWoodBonus || 0);
        village.resourceMax.food = (200 + pop * 50) + (bonuses.maxFoodBonus || 0);
        village.resourceMax.stone = (200 + pop * 20) + (bonuses.maxStoneBonus || 0);

        if (village.type === VillageTypes.GENERAL) {
            const b = bonuses.maxAllBonus || 0;
            village.resourceMax.wood += b;
            village.resourceMax.food += b;
            village.resourceMax.stone += b;
        }

        this.villageSystem.economySystem?.syncResources(village);
    }

    _updateVillagePlanning(village) {
        if (village._planningCooldown > 0) {
            village._planningCooldown -= 0.1;
            return;
        }

        if (village.currentTask && village.currentTask.type === 'build') {
            const taskTarget = this.entityManager.entities.get(village.currentTask.targetId);
            const structure = taskTarget?.components.get('Structure');

            if (!taskTarget) {
                village.currentTask = null;
            } else if (structure && structure.isComplete) {
                village.currentTask = null;
                village._planningCooldown = 3.0;
            }
        }

        if (!village.currentTask) {
            // 미완공 청사진 탐색
            for (const bId of village.buildings) {
                const b = this.entityManager.entities.get(bId);
                const struc = b?.components.get('Structure');
                if (struc && !struc.isComplete) {
                    village.currentTask = {
                        type: 'build',
                        buildingType: b.components.get('Building')?.type || 'unknown',
                        targetId: bId
                    };
                    break;
                }
            }
        }

        // 과업이 여전히 없으면 새로운 건물 배치 계획
        if (!village.currentTask && village.resources.wood >= 10) {
            const nextType = this._analyzeVillageNeeds(village);
            if (nextType) {
                const spot = this._findConstructionSpot(village, nextType);
                if (spot) {
                    this.createBlueprint(nextType, spot.x, spot.y, village.id);
                }
            }
        }
    }

    createBlueprint(type, x, y, villageId) {
        const village = this.villageSystem.villages.get(villageId);
        if (!village) return false;

        const blueprintId = Number(this.engine.factoryProvider.spawn('building', type, x, y, {
            isBlueprint: true,
            villageId: village.id
        }));

        if (!isNaN(blueprintId)) {
            village.buildings.add(blueprintId);
            village.currentTask = {
                type: 'build',
                buildingType: type,
                targetId: blueprintId
            };
            village._planningCooldown = 10.0;
            return true;
        }
        return false;
    }

    _manageFences(village) {
        if (village.resources.wood < 30 || village.members.size < 5) return;

        const territory = village.territory;
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        const blueprintsToPlace = [];

        for (const key of territory) {
            const tx = key & 0xFFFF;
            const ty = key >> 16;

            for (const [dx, dy] of dirs) {
                const nx = tx + dx, ny = ty + dy;
                const nKey = (ny << 16) | nx;

                if (!territory.has(nKey)) {
                    const bx = tx * 16 + 8;
                    const by = ty * 16 + 8;

                    const nearby = this.engine.spatialHash.query(bx, by, 12);
                    let hasFence = false;
                    for (const nid of nearby) {
                        const ent = this.entityManager.entities.get(nid);
                        if (ent && (ent.components.has('Fence') || ent.components.has('Building'))) {
                            hasFence = true;
                            break;
                        }
                    }

                    if (!hasFence) {
                        blueprintsToPlace.push({ x: bx, y: by });
                    }
                }
            }
            if (blueprintsToPlace.length > 5) break;
        }

        for (const pos of blueprintsToPlace) {
            this.engine.factoryProvider.spawn('fence', 'normal', pos.x, pos.y, {
                villageId: village.id,
                isBlueprint: true,
                material: village.members.size > 20 ? 'stone' : 'wood'
            });
        }
    }

    _findConstructionSpot(village, type) {
        let spawnX = 0, spawnY = 0;
        let foundSpot = false;
        let attempts = 0;
        const maxAttempts = 25;

        const zm = this.engine.systemManager?.zoneManager;
        let targetZone = zm ? zm.getZone(village.residentialZoneId) : null;

        while (!foundSpot && attempts < maxAttempts) {
            attempts++;

            if (targetZone && targetZone.villageId !== undefined && village.territory?.size > 0) {
                const b = targetZone.bounds;
                const validTiles = [];
                for (const key of village.territory) {
                    const tx = key & 0xFFFF, ty = key >> 16;
                    const cx = tx * 16 + 8, cy = ty * 16 + 8;
                    if (cx >= b.minX && cx <= b.minX + b.width && cy >= b.minY && cy <= b.minY + b.height) {
                        validTiles.push(key);
                    }
                }

                if (validTiles.length > 0) {
                    const rTile = validTiles[Math.floor(Math.random() * validTiles.length)];
                    const tx = rTile & 0xFFFF, ty = rTile >> 16;
                    spawnX = tx * 16 + 4 + Math.random() * 8;
                    spawnY = ty * 16 + 4 + Math.random() * 8;
                } else {
                    spawnX = b.minX + 10 + Math.random() * (b.width - 20);
                    spawnY = b.minY + 10 + Math.random() * (b.height - 20);
                }
            } else {
                const angle = Math.random() * Math.PI * 2;
                const radius = 50 + (attempts / maxAttempts) * 150;
                spawnX = village.centerX + Math.cos(angle) * radius;
                spawnY = village.centerY + Math.sin(angle) * radius;
            }

            if (spawnX < 50 || spawnX > this.engine.mapWidth - 50 || spawnY < 50 || spawnY > this.engine.mapHeight - 50) continue;

            if (this.engine.terrainGen?.isSoilAt(spawnX, spawnY)) {
                let isTooClose = false;
                for (const bId of village.buildings) {
                    const b = this.entityManager.entities.get(bId);
                    const bPos = b?.components.get('Transform');
                    if (!bPos) continue;

                    const dx = bPos.x - spawnX;
                    const dy = bPos.y - spawnY;
                    if (dx * dx + dy * dy < 3600) {
                        isTooClose = true;
                        break;
                    }
                }
                if (!isTooClose) foundSpot = true;
            }
        }
        return foundSpot ? { x: spawnX, y: spawnY } : null;
    }

    _analyzeVillageNeeds(village) {
        let hasBonfire = false;
        let hasStorage = false;
        let totalCapacity = 0;
        let farmCount = 0;
        let hasWell = false;
        let hasBlacksmith = false;
        let hasTemple = false;
        let towerCount = 0;

        for (const bId of village.buildings) {
            const b = this.entityManager.entities.get(bId);
            if (!b) continue;
            const bType = b.components.get('Building')?.type;
            const struc = b.components.get('Structure');
            const housing = b.components.get('Housing');

            if (bType === 'bonfire') hasBonfire = true;
            if (bType === 'storage' || bType === 'warehouse') hasStorage = true;
            if (struc?.isComplete && housing) totalCapacity += housing.capacity;
            if (bType === 'farm') farmCount++;
            if (bType === 'well') hasWell = true;
            if (bType === 'blacksmith') hasBlacksmith = true;
            if (bType === 'temple') hasTemple = true;
            if (bType === 'watchtower') towerCount++;
        }

        if (!hasBonfire) return 'bonfire';
        if (!hasStorage) return 'storage';
        if (totalCapacity < village.members.size + 2) return 'house';
        if (farmCount < Math.ceil(village.members.size / 4)) return 'farm';
        if (!hasWell && village.members.size >= 6) return 'well';
        if (!hasBlacksmith && village.members.size >= 10 && village.resources.stone >= 30) return 'blacksmith';
        if (!hasTemple && village.members.size >= 15) return 'temple';
        if (towerCount < Math.ceil(village.members.size / 8)) return 'watchtower';

        return null;
    }

    _checkExpansion(village) {
        let explorerId = null;
        for (const id of village.members) {
            const ent = this.entityManager.entities.get(id);
            const civ = ent?.components.get('Civilization');
            if (civ && (civ.jobType === JobTypes.UNEMPLOYED || !civ.jobType)) {
                explorerId = id;
                break;
            }
        }

        if (explorerId) {
            const explorer = this.entityManager.entities.get(explorerId);
            const transform = explorer?.components.get('Transform');
            if (!transform) return;

            const angle = Math.random() * Math.PI * 2;
            const dist = 600 + Math.random() * 400;
            const newX = village.centerX + Math.cos(angle) * dist;
            const newY = village.centerY + Math.sin(angle) * dist;

            if (newX < 50 || newX > this.engine.mapWidth - 50 || newY < 50 || newY > this.engine.mapHeight - 50) return;

            village.resources.wood -= 50;
            village.members.delete(explorerId);
            const civ = explorer.components.get('Civilization');
            if (civ) civ.villageId = -1;

            this.villageSystem.createVillage({
                founderId: explorerId,
                x: newX,
                y: newY,
                nationIdOverride: village.nationId
            });
        }
    }
}
