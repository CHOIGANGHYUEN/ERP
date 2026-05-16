import System from '../../core/System.js';
import { GlobalLogger } from '../../utils/Logger.js';

// 🚀 [SOLID] Sub-Systems
import NationDiplomacySystem, { DIPLOMACY } from './nation_modules/NationDiplomacySystem.js';
import NationMilitarySystem from './nation_modules/NationMilitarySystem.js';
import NationPoliticsSystem from './nation_modules/NationPoliticsSystem.js';
import NationEconomySystem from './nation_modules/NationEconomySystem.js';
import NationStateSynchronizer from './nation_modules/NationStateSynchronizer.js';

/**
 * 🚩 NationSystem (Facade / Orchestrator)
 * 국가 시스템의 중심이며, 데이터 관리와 하위 전문 시스템들(Diplomacy, Military, Politics, Economy)을 조율합니다.
 * 리팩토링을 통해 SRP(단일 책임 원칙)를 준수하며 유지보수성을 극대화했습니다.
 */
export default class NationSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.nations = new Map();
        this.nextNationId = 1;
        
        // 📊 Shared Data Structures
        this.relationships = new Map();
        this.diplomaticStates = new Map();

        // 🚀 [SOLID] 하위 시스템 참조 (SystemManager에 의해 주입됨)
        this.diplomacySystem = null;
        this.militarySystem = null;
        this.politicsSystem = null;
        this.economySystem = null;
        this.stateSynchronizer = new NationStateSynchronizer(entityManager, eventBus, engine, this);
    }

    /** 🚀 [Expert Dependency Injection] 서브 시스템 주입 */
    setSubSystems(diplomacy, military, politics, economy) {
        this.diplomacySystem = diplomacy;
        this.militarySystem = military;
        this.politicsSystem = politics;
        this.economySystem = economy;
    }

    getNation(id) {
        return this.nations.get(id);
    }

    // 🕊️ [Diplomacy Delegates] External systems depend on these API methods
    isAtWar(id1, id2) {
        if (!this.diplomacySystem) return false;
        const rel = this.diplomacySystem.getRelationship(id1, id2);
        return rel.state === DIPLOMACY.WAR;
    }

    getRelationship(id1, id2) {
        return this.diplomacySystem?.getRelationship(id1, id2) || { opinion: 50, state: DIPLOMACY.NEUTRAL };
    }

    getNationDiplomacy(nationId) {
        const result = [];
        for (const other of this.nations.values()) {
            if (other.id === nationId) continue;
            const rel = this.getRelationship(nationId, other.id);
            result.push({
                nationId: other.id,
                name: other.name,
                color: other.color,
                opinion: Math.round(rel.opinion),
                state: rel.state
            });
        }
        return result.sort((a, b) => a.opinion - b.opinion);
    }

    adjustOpinion(id1, id2, delta) {
        return this.diplomacySystem?.adjustOpinion(id1, id2, delta);
    }

    declareWar(id1, id2, reason) {
        return this.diplomacySystem?.declareWar(id1, id2, reason);
    }

    makePeace(id1, id2, reason) {
        return this.diplomacySystem?.makePeace(id1, id2, reason);
    }

    applyPolicy(nationId, policyType, value) {
        const nation = this.nations.get(nationId);
        if (!nation) return;
        nation.policies[policyType] = value;
        GlobalLogger.info(`Policy Applied: ${nation.name} set ${policyType} to ${value}`);
        this.eventBus?.emit('POLICY_CHANGED', { nationId, policyType, value });
    }

    update(dt, time) {
        // 1. 기초 통계 업데이트 (모든 서브 시스템이 의존함)
        for (const nation of this.nations.values()) {
            this._updateNationStats(nation);
        }

        // 2. 하위 시스템 업데이트 (순서: 정치 -> 경제 -> 외교 -> 군사)
        this.politicsSystem?.update(dt);
        this.economySystem?.update(dt);
        this.diplomacySystem?.update(dt);
        this.militarySystem?.update(dt);
    }

    createNation(name, color) {
        const id = this.nextNationId++;
        const nation = {
            id,
            name: name || `Kingdom of ${id}`,
            color: color || this._generateDiverseColor(),
            villages: new Set(),
            kingId: null,
            prestige: 0,
            culture: 0,
            tech: 0,
            lastTechLevel: 0,
            totalPopulation: 0,
            territorySize: 0,
            averageLoyalty: 70,
            stability: 70,
            resources: {
                wood: 100,
                food: 100,
                stone: 50,
                gold: 0
            },
            taxRate: 0.1,
            policies: {
                expansion: 1.0,
                focus: 'balanced'
            },
            atWarWith: new Set(),
            allies: new Set(),
            hostiles: new Set(),
            tributeLedger: [],
            warScore: 0
        };

        this._updateIntColor(nation);
        this.nations.set(id, nation);
        
        // 외교 관계 초기화 위임
        this.diplomacySystem?._initializeRelationshipsFor(id);
        
        GlobalLogger.success(`Nation Created: ${nation.name} with color ${nation.color}`);
        this.eventBus?.emit('NATION_CREATED', { nationId: id, nation });
        return id;
    }

    addVillageToNation(nationId, villageId) {
        const nation = this.nations.get(nationId);
        const vs = this.engine.systemManager?.villageSystem;
        const village = vs?.getVillage(villageId);
        if (!nation || !village) return false;

        if (village.nationId !== -1 && village.nationId !== nationId) {
            this.removeVillageFromNation(village.nationId, villageId, { destroyIfEmpty: true });
        }

        nation.villages.add(villageId);
        village.nationId = nationId;
        village.color = nation.color;
        village.intColor = nation.intColor;
        village.rgbColor = nation.rgbColor;
        village.loyalty = village.loyalty ?? 70;
        village.unrest = village.unrest ?? 0;

        this.stateSynchronizer.syncVillage(village, nationId, { reason: 'annexation' });
        if (this.engine.terrainGen) {
            this.engine.terrainGen.syncNationColor(villageId, nation.rgbColor);
        }
        this._updateNationStats(nation);
        return true;
    }

    removeVillageFromNation(nationId, villageId, options = {}) {
        const nation = this.nations.get(nationId);
        if (!nation) return false;
        nation.villages.delete(villageId);
        if (nation.villages.size === 0 && options.destroyIfEmpty !== false) {
            this._retireNation(nationId);
        } else {
            this._updateNationStats(nation);
        }
        return true;
    }

    transferVillageToNation(villageId, newNationId, reason = 'transfer') {
        const vs = this.engine.systemManager?.villageSystem;
        const village = vs?.getVillage(villageId);
        const oldNationId = village?.nationId ?? -1;
        if (!village || oldNationId === newNationId) return false;

        this.removeVillageFromNation(oldNationId, villageId, { destroyIfEmpty: true });
        const ok = this.addVillageToNation(newNationId, villageId);
        if (ok) {
            this.stateSynchronizer.syncVillage(village, newNationId, { reason });
            this.eventBus?.emit('VILLAGE_TRANSFERRED', {
                villageId,
                fromNationId: oldNationId,
                toNationId: newNationId,
                reason
            });
        }
        return ok;
    }

    captureVillage(attackerNationId, villageId, reason = 'war') {
        const vs = this.engine.systemManager?.villageSystem;
        const village = vs?.getVillage(villageId);
        const defenderNationId = village?.nationId ?? -1;
        if (!village || attackerNationId === defenderNationId || !this.nations.has(attackerNationId)) return false;

        const ok = this.transferVillageToNation(villageId, attackerNationId, reason);
        if (!ok) return false;

        village.loyalty = Math.min(village.loyalty ?? 45, 45);
        village.unrest = Math.max(village.unrest ?? 0, 18);
        
        // 외교 수치 조정 위임
        this.diplomacySystem?.adjustOpinion(attackerNationId, defenderNationId, -10);
        
            this.stateSynchronizer.syncVillage(village, attackerNationId, { reason: 'capture' });
            this.eventBus?.emit('VILLAGE_CAPTURED', {
            villageId,
            attackerNationId,
            defenderNationId,
            reason
        });
        GlobalLogger.warn(`Village ${village.name} was captured by ${this.nations.get(attackerNationId)?.name}.`);
        return true;
    }

    declareIndependence(villageId) {
        const vs = this.engine.systemManager?.villageSystem;
        const village = vs?.getVillage(villageId);
        if (!village || village.nationId === -1) return false;
        
        const oldNationId = village.nationId;
        const newNationId = this.createNation(`${village.name} Free State`);
        const ok = this.transferVillageToNation(villageId, newNationId, 'independence');
        if (!ok) return false;

        village.loyalty = 65;
        village.unrest = 20;
        
        // 전쟁 선포 위임
        this.diplomacySystem?.declareWar(oldNationId, newNationId, 'rebellion');
        
        this.stateSynchronizer.syncVillage(village, newNationId, { reason: 'independence' });
        this.eventBus?.emit('INDEPENDENCE_DECLARED', {
            villageId,
            oldNationId,
            newNationId
        });
        GlobalLogger.warn(`${village.name} declared independence from ${this.nations.get(oldNationId)?.name || 'former nation'}.`);
        return true;
    }

    _updateNationStats(nation) {
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs) return;

        let totalPop = 0;
        let territorySize = 0;
        let loyaltyTotal = 0;
        let loyaltyCount = 0;

        for (const vid of nation.villages) {
            const village = vs.getVillage(vid);
            if (!village) continue;
            totalPop += village.members?.size || 0;
            territorySize += village.territory?.size || 0;
            loyaltyTotal += village.loyalty ?? 70;
            loyaltyCount++;
        }

        nation.totalPopulation = totalPop;
        nation.territorySize = territorySize;
        nation.averageLoyalty = loyaltyCount > 0 ? loyaltyTotal / loyaltyCount : 70;
        nation.stability = this._clamp(nation.averageLoyalty - (nation.atWarWith?.size || 0) * 8, 0, 100);

        if (territorySize > 0) {
            let sumX = 0, sumY = 0;
            for (const vid of nation.villages) {
                const v = vs.getVillage(vid);
                if (v) {
                    sumX += v.centerX * (v.territory?.size || 1);
                    sumY += v.centerY * (v.territory?.size || 1);
                }
            }
            nation.visualCentroidX = sumX / territorySize;
            nation.visualCentroidY = sumY / territorySize;
        }
    }

    _syncVillageCiv(village, nationId) {
        for (const entityId of village.members || []) {
            const civ = this.entityManager.entities.get(entityId)?.components.get('Civilization');
            if (civ) {
                civ.villageId = village.id;
                civ.nationId = nationId;
            }
        }
        for (const buildingId of village.buildings || []) {
            const civ = this.entityManager.entities.get(buildingId)?.components.get('Civilization');
            if (civ) {
                civ.villageId = village.id;
                civ.nationId = nationId;
            }
        }
    }

    _retireNation(nationId) {
        const nation = this.nations.get(nationId);
        if (!nation) return;
        this.nations.delete(nationId);
        
        for (const key of Array.from(this.relationships.keys())) {
            if (key.split('_').map(Number).includes(nationId)) {
                this.relationships.delete(key);
                this.diplomaticStates.delete(key);
            }
        }
        
        for (const other of this.nations.values()) {
            other.atWarWith?.delete(nationId);
            other.allies?.delete(nationId);
            other.hostiles?.delete(nationId);
        }
        this.eventBus?.emit('NATION_DISSOLVED', { nationId, nation });
    }

    _generateDiverseColor() {
        const hue = (this.nations.size * 137.508) % 360;
        const h = hue / 360;
        const s = 0.7;
        const l = 0.5;
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const toHex = value => Math.round(value * 255).toString(16).padStart(2, '0');
        return `#${toHex(hue2rgb(p, q, h + 1 / 3))}${toHex(hue2rgb(p, q, h))}${toHex(hue2rgb(p, q, h - 1 / 3))}`;
    }

    _updateIntColor(nation) {
        const c = nation.color || '#ffffff';
        const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
        nation.intColor = (255 << 24) | (b << 16) | (g << 8) | r;
        nation.rgbColor = (r << 16) | (g << 8) | b;

        if (this.engine.terrainGen) {
            for (const vid of nation.villages || []) {
                this.engine.terrainGen.syncNationColor(vid, nation.rgbColor);
            }
        }
    }

    _clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
}
