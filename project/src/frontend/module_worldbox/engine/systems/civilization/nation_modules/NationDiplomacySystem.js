import System from '../../../core/System.js';
import { GlobalLogger } from '../../../utils/Logger.js';

export const DIPLOMACY = Object.freeze({
    ALLY: 'ally',
    NEUTRAL: 'neutral',
    HOSTILE: 'hostile',
    WAR: 'war'
});

/**
 * 🤝 NationDiplomacySystem
 * 국가 간의 외교 관계, 여론 수치, 전쟁 선포 및 평화 협정을 전담합니다.
 */
export default class NationDiplomacySystem extends System {
    constructor(entityManager, eventBus, engine, nationSystem) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.nationSystem = nationSystem;
        
        // Relationships are stored in the parent NationSystem to maintain state consistency
    }

    update(dt) {
        this._updateDiplomacy(dt);
    }

    getRelationship(id1, id2) {
        if (!this.nationSystem.nations.has(id1) || !this.nationSystem.nations.has(id2)) {
            return { opinion: 50, state: DIPLOMACY.NEUTRAL };
        }
        if (id1 === id2) return { opinion: 100, state: DIPLOMACY.ALLY };
        
        const key = this._relationshipKey(id1, id2);
        this._ensureRelationship(id1, id2);
        
        return {
            opinion: this.nationSystem.relationships.get(key) ?? 50,
            state: this.nationSystem.diplomaticStates.get(key) || DIPLOMACY.NEUTRAL
        };
    }

    adjustOpinion(id1, id2, delta) {
        if (id1 === id2 || id1 === -1 || id2 === -1) return 0;
        if (!this.nationSystem.nations.has(id1) || !this.nationSystem.nations.has(id2)) return 0;
        
        const key = this._relationshipKey(id1, id2);
        this._ensureRelationship(id1, id2);
        
        const next = Math.max(0, Math.min(100, (this.nationSystem.relationships.get(key) ?? 50) + delta));
        this.nationSystem.relationships.set(key, next);
        return next;
    }

    declareWar(id1, id2, reason = 'tension') {
        if (!this.nationSystem.nations.has(id1) || !this.nationSystem.nations.has(id2) || id1 === id2) return false;
        
        const key = this._relationshipKey(id1, id2);
        this._ensureRelationship(id1, id2);
        
        this.nationSystem.relationships.set(key, Math.min(this.nationSystem.relationships.get(key) ?? 50, 12));
        this.nationSystem.diplomaticStates.set(key, DIPLOMACY.WAR);
        this._syncDiplomaticSets(id1, id2, DIPLOMACY.WAR);
        
        this.eventBus?.emit('WAR_DECLARED', { nation1: id1, nation2: id2, reason });
        this.eventBus?.emit('DIPLOMACY_CHANGED', { nation1: id1, nation2: id2, status: DIPLOMACY.WAR });
        
        const n1 = this.nationSystem.nations.get(id1);
        const n2 = this.nationSystem.nations.get(id2);
        GlobalLogger.warn(`War declared: ${n1?.name} vs ${n2?.name} (${reason})`);
        return true;
    }

    makePeace(id1, id2, reason = 'settlement') {
        if (!this.nationSystem.nations.has(id1) || !this.nationSystem.nations.has(id2) || id1 === id2) return false;
        
        const key = this._relationshipKey(id1, id2);
        this.nationSystem.relationships.set(key, Math.max(this.nationSystem.relationships.get(key) ?? 35, 35));
        
        const state = this._stateFromOpinion(this.nationSystem.relationships.get(key));
        this.nationSystem.diplomaticStates.set(key, state);
        this._syncDiplomaticSets(id1, id2, state);
        
        this.eventBus?.emit('PEACE_MADE', { nation1: id1, nation2: id2, reason });
        this.eventBus?.emit('DIPLOMACY_CHANGED', { nation1: id1, nation2: id2, status: state });
        return true;
    }

    _updateDiplomacy(dt) {
        const ids = Array.from(this.nationSystem.nations.keys());
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const id1 = ids[i];
                const id2 = ids[j];
                const key = this._relationshipKey(id1, id2);
                this._ensureRelationship(id1, id2);

                const opinion = this.nationSystem.relationships.get(key) ?? 50;
                const state = this.nationSystem.diplomaticStates.get(key) || DIPLOMACY.NEUTRAL;
                let delta = (50 - opinion) * 0.006 * dt;

                if (state === DIPLOMACY.WAR) delta -= 0.08 * dt;
                else if (state === DIPLOMACY.ALLY) delta += 0.03 * dt;
                else if (this._hasBorderTension(id1, id2)) delta -= 0.04 * dt;

                const nextOpinion = Math.max(0, Math.min(100, opinion + delta));
                this.nationSystem.relationships.set(key, nextOpinion);

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
                    this.nationSystem.diplomaticStates.set(key, nextState);
                    this._syncDiplomaticSets(id1, id2, nextState);
                    this.eventBus?.emit('DIPLOMACY_CHANGED', { nation1: id1, nation2: id2, status: nextState });
                }
            }
        }
    }

    _initializeRelationshipsFor(nationId) {
        for (const otherId of this.nationSystem.nations.keys()) {
            if (otherId !== nationId) this._ensureRelationship(nationId, otherId);
        }
    }

    _ensureRelationship(id1, id2) {
        if (id1 === id2 || id1 === -1 || id2 === -1) return;
        if (!this.nationSystem.nations.has(id1) || !this.nationSystem.nations.has(id2)) return;
        const key = this._relationshipKey(id1, id2);
        if (!this.nationSystem.relationships.has(key)) this.nationSystem.relationships.set(key, 50);
        if (!this.nationSystem.diplomaticStates.has(key)) this.nationSystem.diplomaticStates.set(key, DIPLOMACY.NEUTRAL);
    }

    _relationshipKey(id1, id2) {
        return [id1, id2].sort((a, b) => a - b).join('_');
    }

    _stateFromOpinion(opinion) {
        if (opinion >= 75) return DIPLOMACY.ALLY;
        if (opinion <= 28) return DIPLOMACY.HOSTILE;
        return DIPLOMACY.NEUTRAL;
    }

    _syncDiplomaticSets(id1, id2, state) {
        const n1 = this.nationSystem.nations.get(id1);
        const n2 = this.nationSystem.nations.get(id2);
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

    _hasBorderTension(id1, id2) {
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs) return false;
        const n1 = this.nationSystem.nations.get(id1);
        const n2 = this.nationSystem.nations.get(id2);
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

    _distance(v1, v2) {
        return Math.hypot((v1.centerX || 0) - (v2.centerX || 0), (v1.centerY || 0) - (v2.centerY || 0));
    }
}
