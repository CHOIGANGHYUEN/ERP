import System from '../../core/System.js';
import { GlobalLogger } from '../../utils/Logger.js';

const DIPLOMACY = Object.freeze({
    ALLY: 'ally',
    NEUTRAL: 'neutral',
    HOSTILE: 'hostile',
    WAR: 'war'
});

export default class NationSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.nations = new Map();
        this.nextNationId = 1;
        this.relationships = new Map();
        this.diplomaticStates = new Map();
        this._warTimer = 0;
        this._tributeTimer = 0;
        this._rebellionTimer = 0;
    }

    getNation(id) {
        return this.nations.get(id);
    }

    update(dt, time) {
        for (const nation of this.nations.values()) {
            this._updateNationStats(nation);
            this._checkKingStatus(nation);
            this._collectTaxes(nation);
            this._investInVillages(nation);
            this._updatePrestige(nation, dt);
            this._updateNationalProgress(nation, dt);
        }

        this._updateDiplomacy(dt);

        this._warTimer += dt;
        if (this._warTimer >= 4) {
            this._warTimer = 0;
            this._processWars();
        }

        this._tributeTimer += dt;
        if (this._tributeTimer >= 6) {
            this._tributeTimer = 0;
            this._processNationalTribute();
        }

        this._rebellionTimer += dt;
        if (this._rebellionTimer >= 3) {
            this._rebellionTimer = 0;
            this._checkRebellions(3);
        }
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
        this._initializeRelationshipsFor(id);
        GlobalLogger.success(`Nation Created: ${nation.name} with color ${nation.color}`);
        this.eventBus?.emit('NATION_CREATED', { nationId: id, nation });
        return id;
    }

    addVillageToNation(nationId, villageId) {
        const nation = this.nations.get(nationId);
        const village = this.engine.systemManager?.villageSystem?.getVillage(villageId);
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

        this._syncVillageCiv(village, nationId);
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
        const village = this.engine.systemManager?.villageSystem?.getVillage(villageId);
        const oldNationId = village?.nationId ?? -1;
        if (!village || oldNationId === newNationId) return false;

        this.removeVillageFromNation(oldNationId, villageId, { destroyIfEmpty: true });
        const ok = this.addVillageToNation(newNationId, villageId);
        if (ok) {
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
        const village = this.engine.systemManager?.villageSystem?.getVillage(villageId);
        const defenderNationId = village?.nationId ?? -1;
        if (!village || attackerNationId === defenderNationId || !this.nations.has(attackerNationId)) return false;

        const ok = this.transferVillageToNation(villageId, attackerNationId, reason);
        if (!ok) return false;

        village.loyalty = Math.min(village.loyalty ?? 45, 45);
        village.unrest = Math.max(village.unrest ?? 0, 18);
        this.adjustOpinion(attackerNationId, defenderNationId, -10);
        this.eventBus?.emit('VILLAGE_CAPTURED', {
            villageId,
            attackerNationId,
            defenderNationId,
            reason
        });
        GlobalLogger.warn(`Village ${village.name} was captured by ${this.nations.get(attackerNationId)?.name}.`);
        return true;
    }

    getRelationship(id1, id2) {
        if (!this.nations.has(id1) || !this.nations.has(id2)) {
            return { opinion: 50, state: DIPLOMACY.NEUTRAL };
        }
        if (id1 === id2) return { opinion: 100, state: DIPLOMACY.ALLY };
        const key = this._relationshipKey(id1, id2);
        this._ensureRelationship(id1, id2);
        return {
            opinion: this.relationships.get(key) ?? 50,
            state: this.diplomaticStates.get(key) || DIPLOMACY.NEUTRAL
        };
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

    isAtWar(id1, id2) {
        if (id1 === id2 || id1 === -1 || id2 === -1) return false;
        return this.diplomaticStates.get(this._relationshipKey(id1, id2)) === DIPLOMACY.WAR;
    }

    setRelationship(id1, id2, status, opinionDelta = 0) {
        if (!this.nations.has(id1) || !this.nations.has(id2) || id1 === id2) return;
        const key = this._relationshipKey(id1, id2);
        this._ensureRelationship(id1, id2);

        if (opinionDelta !== 0) {
            this.relationships.set(key, this._clamp((this.relationships.get(key) ?? 50) + opinionDelta, 0, 100));
        }

        if (status) {
            const state = this._normalizeDiplomaticState(status);
            if (state === DIPLOMACY.WAR) this.declareWar(id1, id2, 'manual');
            else {
                this.diplomaticStates.set(key, state);
                this._syncDiplomaticSets(id1, id2, state);
                this.eventBus?.emit('DIPLOMACY_CHANGED', { nation1: id1, nation2: id2, status: state });
            }
        }
    }

    adjustOpinion(id1, id2, delta) {
        if (id1 === id2 || id1 === -1 || id2 === -1) return 0;
        if (!this.nations.has(id1) || !this.nations.has(id2)) return 0;
        const key = this._relationshipKey(id1, id2);
        this._ensureRelationship(id1, id2);
        const next = this._clamp((this.relationships.get(key) ?? 50) + delta, 0, 100);
        this.relationships.set(key, next);
        return next;
    }

    declareWar(id1, id2, reason = 'tension') {
        if (!this.nations.has(id1) || !this.nations.has(id2) || id1 === id2) return false;
        const key = this._relationshipKey(id1, id2);
        this._ensureRelationship(id1, id2);
        this.relationships.set(key, Math.min(this.relationships.get(key) ?? 50, 12));
        this.diplomaticStates.set(key, DIPLOMACY.WAR);
        this._syncDiplomaticSets(id1, id2, DIPLOMACY.WAR);
        this.eventBus?.emit('WAR_DECLARED', { nation1: id1, nation2: id2, reason });
        this.eventBus?.emit('DIPLOMACY_CHANGED', { nation1: id1, nation2: id2, status: DIPLOMACY.WAR });
        GlobalLogger.warn(`War declared: ${this.nations.get(id1)?.name} vs ${this.nations.get(id2)?.name} (${reason})`);
        return true;
    }

    makePeace(id1, id2, reason = 'settlement') {
        if (!this.nations.has(id1) || !this.nations.has(id2) || id1 === id2) return false;
        const key = this._relationshipKey(id1, id2);
        this.relationships.set(key, Math.max(this.relationships.get(key) ?? 35, 35));
        const state = this._stateFromOpinion(this.relationships.get(key));
        this.diplomaticStates.set(key, state);
        this._syncDiplomaticSets(id1, id2, state);
        this.eventBus?.emit('PEACE_MADE', { nation1: id1, nation2: id2, reason });
        this.eventBus?.emit('DIPLOMACY_CHANGED', { nation1: id1, nation2: id2, status: state });
        return true;
    }

    applyPolicy(nationId, policyType, value) {
        const nation = this.nations.get(nationId);
        if (!nation) return;
        nation.policies[policyType] = value;
        GlobalLogger.info(`Policy Applied: ${nation.name} set ${policyType} to ${value}`);
        this.eventBus?.emit('POLICY_CHANGED', { nationId, policyType, value });
    }

    declareIndependence(villageId) {
        const village = this.engine.systemManager?.villageSystem?.getVillage(villageId);
        if (!village || village.nationId === -1) return false;
        const oldNationId = village.nationId;
        const newNationId = this.createNation(`${village.name} Free State`);
        const ok = this.transferVillageToNation(villageId, newNationId, 'independence');
        if (!ok) return false;

        village.loyalty = 65;
        village.unrest = 20;
        this.declareWar(oldNationId, newNationId, 'rebellion');
        this.eventBus?.emit('INDEPENDENCE_DECLARED', {
            villageId,
            oldNationId,
            newNationId
        });
        GlobalLogger.warn(`${village.name} declared independence from ${this.nations.get(oldNationId)?.name || 'former nation'}.`);
        return true;
    }

    _updateDiplomacy(dt) {
        const ids = Array.from(this.nations.keys());
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const id1 = ids[i];
                const id2 = ids[j];
                const key = this._relationshipKey(id1, id2);
                this._ensureRelationship(id1, id2);

                const opinion = this.relationships.get(key) ?? 50;
                const state = this.diplomaticStates.get(key) || DIPLOMACY.NEUTRAL;
                let delta = (50 - opinion) * 0.006 * dt;

                if (state === DIPLOMACY.WAR) delta -= 0.08 * dt;
                else if (state === DIPLOMACY.ALLY) delta += 0.03 * dt;
                else if (this._hasBorderTension(id1, id2)) delta -= 0.04 * dt;

                const nextOpinion = this._clamp(opinion + delta, 0, 100);
                this.relationships.set(key, nextOpinion);

                if (state === DIPLOMACY.WAR) {
                    if (nextOpinion > 45) this.makePeace(id1, id2, 'war_weariness');
                    continue;
                }

                if (nextOpinion <= 12) {
                    this.declareWar(id1, id2, 'low_opinion');
                    continue;
                }

                const nextState = this._stateFromOpinion(nextOpinion);
                if (nextState !== state) {
                    this.diplomaticStates.set(key, nextState);
                    this._syncDiplomaticSets(id1, id2, nextState);
                    this.eventBus?.emit('DIPLOMACY_CHANGED', { nation1: id1, nation2: id2, status: nextState });
                }
            }
        }
    }

    _processWars() {
        const handled = new Set();
        for (const [key, state] of this.diplomaticStates) {
            if (state !== DIPLOMACY.WAR || handled.has(key)) continue;
            const [id1, id2] = key.split('_').map(Number);
            const n1 = this.nations.get(id1);
            const n2 = this.nations.get(id2);
            if (!n1 || !n2) continue;
            this._tryWarAdvance(n1, n2);
            this._tryWarAdvance(n2, n1);
            handled.add(key);
        }
    }

    _tryWarAdvance(attacker, defender) {
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs || attacker.villages.size === 0 || defender.villages.size === 0) return false;

        let best = null;
        for (const attackerVillageId of attacker.villages) {
            const attackerVillage = vs.getVillage(attackerVillageId);
            if (!attackerVillage) continue;
            for (const defenderVillageId of defender.villages) {
                const defenderVillage = vs.getVillage(defenderVillageId);
                if (!defenderVillage) continue;
                const dist = this._distance(attackerVillage, defenderVillage);
                if (dist > 480) continue;
                const attackPower = this._estimateVillagePower(attackerVillage, attacker, false);
                const defensePower = this._estimateVillagePower(defenderVillage, defender, true);
                const score = attackPower - defensePower - dist * 0.015 + Math.random() * 5;
                if (!best || score > best.score) {
                    best = { attackerVillage, defenderVillage, attackPower, defensePower, score };
                }
            }
        }

        if (!best || best.score < 6) return false;

        if ((best.defenderVillage.territory?.size || 0) <= 18 || best.attackPower > best.defensePower * 1.55) {
            return this.captureVillage(attacker.id, best.defenderVillage.id, 'war');
        }

        return this._captureBorderTile(best.attackerVillage, best.defenderVillage);
    }

    _captureBorderTile(attackerVillage, defenderVillage) {
        const zm = this.engine.systemManager?.zoneManager;
        if (!zm || !defenderVillage.territory || defenderVillage.territory.size === 0) return false;

        let bestKey = null;
        let bestScore = Infinity;
        const defenderTx = Math.floor(defenderVillage.centerX / 16);
        const defenderTy = Math.floor(defenderVillage.centerY / 16);

        for (const key of defenderVillage.territory) {
            const tx = typeof key === 'number' ? key & 0xFFFF : Number(String(key).split(',')[0]);
            const ty = typeof key === 'number' ? key >> 16 : Number(String(key).split(',')[1]);
            if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
            const centerDist = (tx - defenderTx) ** 2 + (ty - defenderTy) ** 2;
            if (centerDist <= 4 && defenderVillage.territory.size > 28) continue;
            const wx = tx * 16 + 8;
            const wy = ty * 16 + 8;
            const score = (wx - attackerVillage.centerX) ** 2 + (wy - attackerVillage.centerY) ** 2;
            if (score < bestScore) {
                bestScore = score;
                bestKey = typeof key === 'number' ? key : (ty << 16) | tx;
            }
        }

        if (bestKey === null) return false;
        return zm.transferTileToVillage(bestKey, defenderVillage.id, attackerVillage.id);
    }

    _processNationalTribute() {
        const economy = this.engine.systemManager?.economyManager;
        const vs = this.engine.systemManager?.villageSystem;
        if (!economy?.processNationalTributeAndDistribution || !vs) return;
        economy.processNationalTributeAndDistribution(this, vs);
    }

    _checkRebellions(dt) {
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs) return;
        for (const nation of this.nations.values()) {
            for (const villageId of Array.from(nation.villages)) {
                const village = vs.getVillage(villageId);
                if (!village) continue;
                this._updateVillageLoyalty(village, nation, dt);
                if ((village.loyalty ?? 70) < 18 && village.members.size >= 3) {
                    const chance = Math.min(0.35, (22 - village.loyalty) * 0.015 + (village.unrest || 0) * 0.002);
                    if ((village.unrest || 0) > 80 || Math.random() < chance) {
                        this.declareIndependence(village.id);
                    }
                }
            }
        }
    }

    _updateVillageLoyalty(village, nation, dt) {
        const needs = village.resourceNeeds || {};
        const resources = village.resources || {};
        let delta = 0.1 * dt;

        if ((resources.food || 0) < (needs.food || 0)) delta -= 1.2 * dt;
        else delta += 0.25 * dt;

        if ((nation.taxRate || 0) > 0.15) delta -= ((nation.taxRate || 0) - 0.15) * 8 * dt;
        if (!nation.kingId) delta -= 0.15 * dt;
        if (nation.atWarWith?.size > 0) delta -= 0.35 * nation.atWarWith.size * dt;
        delta += Math.min(0.35, (nation.prestige || 0) / 800) * dt;
        delta += Math.min(0.25, (nation.culture || 0) / 500) * dt;

        village.loyalty = this._clamp((village.loyalty ?? 70) + delta, 0, 100);
        village.unrest = this._clamp((village.unrest || 0) + (45 - village.loyalty) * 0.08 * dt, 0, 100);
    }

    _updateNationalProgress(nation, dt) {
        const baseRate = 0.05 * dt;
        const popBonus = Math.log10(Math.max(10, nation.totalPopulation || 0)) * 0.1;
        const prestigeBonus = ((nation.prestige || 0) / 1000) * 0.2;
        const progress = baseRate * (1 + popBonus + prestigeBonus);

        nation.culture += progress;
        nation.tech += progress * 0.5;

        if (Math.floor(nation.tech) > (nation.lastTechLevel || 0)) {
            nation.lastTechLevel = Math.floor(nation.tech);
            this.eventBus?.emit('TECH_LEVEL_UP', { nationId: nation.id, level: nation.lastTechLevel });
            GlobalLogger.success(`${nation.name} reached Tech Level ${nation.lastTechLevel}.`);
        }
    }

    _investInVillages(nation) {
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs || nation.villages.size === 0) return;

        for (const vid of nation.villages) {
            const village = vs.getVillage(vid);
            if (!village) continue;
            for (const resType of ['wood', 'food', 'stone']) {
                if ((village.resources?.[resType] || 0) >= 10 || (nation.resources?.[resType] || 0) <= 200) continue;
                const gift = Math.min(50, nation.resources[resType]);
                const storageId = village.storageIds?.values().next().value;
                const storage = this.entityManager.entities.get(storageId)?.components.get('Storage');
                if (!storage) continue;
                const added = storage.addItem(resType, gift);
                if (added <= 0) continue;
                nation.resources[resType] -= added;
                village.resources[resType] = (village.resources[resType] || 0) + added;
                this.eventBus?.emit('SHOW_SPEECH_BUBBLE', {
                    entityId: village.founderId,
                    text: `Royal Gift: ${added} ${resType}`,
                    duration: 3000
                });
            }
        }
    }

    _updatePrestige(nation, dt) {
        nation.prestige = (nation.prestige || 0) + ((nation.totalPopulation || 0) / 10) * 0.1 * dt;
    }

    _collectTaxes(nation) {
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs) return;

        for (const vid of nation.villages) {
            const village = vs.getVillage(vid);
            if (!village) continue;
            const taxRate = nation.taxRate || 0.1;

            for (const res of ['wood', 'food', 'stone']) {
                if ((village.resources?.[res] || 0) <= 20) continue;
                const amount = Math.min((village.resources[res] || 0) * (taxRate * 0.005), 2);
                let remaining = amount;
                for (const storageId of village.storageIds || []) {
                    const storage = this.entityManager.entities.get(storageId)?.components.get('Storage');
                    if (!storage) continue;
                    remaining -= storage.withdraw(res, remaining);
                    if (remaining <= 0) break;
                }
                const actualTaken = amount - remaining;
                if (actualTaken > 0) {
                    nation.resources[res] = (nation.resources[res] || 0) + actualTaken;
                    village.resources[res] = Math.max(0, (village.resources[res] || 0) - actualTaken);
                }
            }
        }
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

        // 🚀 [Visual Optimization] Pre-calculate centroid for labels
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
        } else {
            nation.visualCentroidX = 0;
            nation.visualCentroidY = 0;
        }
    }

    _checkKingStatus(nation) {
        if (nation.kingId) {
            const king = this.entityManager.entities.get(nation.kingId);
            const state = king?.components.get('AIState');
            if (!king || (state && state.mode === 'die')) {
                nation.kingId = null;
            }
        }
        if (!nation.kingId && nation.villages.size > 0) this._electKing(nation);
    }

    _electKing(nation) {
        const vs = this.engine.systemManager?.villageSystem;
        let candidateId = null;
        let maxAge = -1;

        for (const vid of nation.villages) {
            const village = vs?.getVillage(vid);
            if (!village?.founderId) continue;
            const founder = this.entityManager.entities.get(village.founderId);
            const age = founder?.components.get('Age')?.currentAge || 0;
            if (age > maxAge) {
                maxAge = age;
                candidateId = village.founderId;
            }
        }

        if (!candidateId) return;
        nation.kingId = candidateId;
        const civ = this.entityManager.entities.get(candidateId)?.components.get('Civilization');
        if (civ) {
            civ.isKing = true;
            civ.title = 'King';
            civ.nationId = nation.id;
        }
        this.eventBus?.emit('KING_ELECTED', { nationId: nation.id, kingId: candidateId });
    }

    _syncVillageCiv(village, nationId) {
        for (const entityId of village.members || []) {
            const civ = this.entityManager.entities.get(entityId)?.components.get('Civilization');
            if (!civ) continue;
            civ.villageId = village.id;
            civ.nationId = nationId;
        }
        for (const buildingId of village.buildings || []) {
            const civ = this.entityManager.entities.get(buildingId)?.components.get('Civilization');
            if (!civ) continue;
            civ.villageId = village.id;
            civ.nationId = nationId;
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

    _estimateVillagePower(village, nation, defending) {
        let warriorBonus = 0;
        for (const memberId of village.members || []) {
            const civ = this.entityManager.entities.get(memberId)?.components.get('Civilization');
            if (civ?.jobType === 'warrior') warriorBonus += 3;
        }
        const popPower = (village.members?.size || 0) * (defending ? 4.5 : 4);
        const morale = (village.buffs?.morale || 1) * 6;
        const resources = ((village.resources?.stone || 0) + (village.resources?.food || 0) * 0.35) / 35;
        const buildingDefense = defending ? (village.totalDefense || 0) * 5 : 0;
        const nationBonus = (nation.tech || 0) * 2 + (nation.prestige || 0) / 120;
        return popPower + warriorBonus + morale + resources + buildingDefense + nationBonus;
    }

    _distance(v1, v2) {
        return Math.hypot((v1.centerX || 0) - (v2.centerX || 0), (v1.centerY || 0) - (v2.centerY || 0));
    }

    _hasBorderTension(id1, id2) {
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs) return false;
        const n1 = this.nations.get(id1);
        const n2 = this.nations.get(id2);
        if (!n1 || !n2) return false;
        for (const v1Id of n1.villages) {
            const v1 = vs.getVillage(v1Id);
            if (!v1) continue;
            for (const v2Id of n2.villages) {
                const v2 = vs.getVillage(v2Id);
                if (v2 && this._distance(v1, v2) < 260) return true;
            }
        }
        return false;
    }

    _initializeRelationshipsFor(nationId) {
        for (const otherId of this.nations.keys()) {
            if (otherId !== nationId) this._ensureRelationship(nationId, otherId);
        }
    }

    _ensureRelationship(id1, id2) {
        if (id1 === id2 || id1 === -1 || id2 === -1) return;
        if (!this.nations.has(id1) || !this.nations.has(id2)) return;
        const key = this._relationshipKey(id1, id2);
        if (!this.relationships.has(key)) this.relationships.set(key, 50);
        if (!this.diplomaticStates.has(key)) this.diplomaticStates.set(key, DIPLOMACY.NEUTRAL);
    }

    _relationshipKey(id1, id2) {
        return [id1, id2].sort((a, b) => a - b).join('_');
    }

    _stateFromOpinion(opinion) {
        if (opinion >= 75) return DIPLOMACY.ALLY;
        if (opinion <= 28) return DIPLOMACY.HOSTILE;
        return DIPLOMACY.NEUTRAL;
    }

    _normalizeDiplomaticState(state) {
        if (state === 'peace') return DIPLOMACY.NEUTRAL;
        if (state === 'enemy') return DIPLOMACY.HOSTILE;
        if (Object.values(DIPLOMACY).includes(state)) return state;
        return DIPLOMACY.NEUTRAL;
    }

    _syncDiplomaticSets(id1, id2, state) {
        const n1 = this.nations.get(id1);
        const n2 = this.nations.get(id2);
        if (!n1 || !n2) return;
        for (const nation of [n1, n2]) {
            nation.atWarWith = nation.atWarWith || new Set();
            nation.allies = nation.allies || new Set();
            nation.hostiles = nation.hostiles || new Set();
        }
        n1.atWarWith.delete(id2);
        n2.atWarWith.delete(id1);
        n1.allies.delete(id2);
        n2.allies.delete(id1);
        n1.hostiles.delete(id2);
        n2.hostiles.delete(id1);

        if (state === DIPLOMACY.WAR) {
            n1.atWarWith.add(id2);
            n2.atWarWith.add(id1);
            n1.hostiles.add(id2);
            n2.hostiles.add(id1);
        } else if (state === DIPLOMACY.ALLY) {
            n1.allies.add(id2);
            n2.allies.add(id1);
        } else if (state === DIPLOMACY.HOSTILE) {
            n1.hostiles.add(id2);
            n2.hostiles.add(id1);
        }
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
        const r = parseInt(c.slice(1, 3), 16);
        const g = parseInt(c.slice(3, 5), 16);
        const b = parseInt(c.slice(5, 7), 16);
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
