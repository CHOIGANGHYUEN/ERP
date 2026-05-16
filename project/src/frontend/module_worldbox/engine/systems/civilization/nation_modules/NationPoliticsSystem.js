import System from '../../../core/System.js';
import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * 🏛️ NationPoliticsSystem
 * 국가 내부의 결속력, 마을 충성도, 반란 체크 및 국왕 선출을 전담합니다.
 */
export default class NationPoliticsSystem extends System {
    constructor(entityManager, eventBus, engine, nationSystem) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.nationSystem = nationSystem;
        this._rebellionTimer = 0;
    }

    update(dt) {
        for (const nation of this.nationSystem.nations.values()) {
            this._checkKingStatus(nation);
        }

        this._rebellionTimer += dt;
        if (this._rebellionTimer >= 3) {
            this._rebellionTimer = 0;
            this._checkRebellions(3);
        }
    }

    _checkRebellions(dt) {
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs) return;
        
        for (const nation of this.nationSystem.nations.values()) {
            for (const villageId of Array.from(nation.villages)) {
                const village = vs.getVillage(villageId);
                if (!village) continue;
                
                this._updateVillageLoyalty(village, nation, dt);
                
                if ((village.loyalty ?? 70) < 18 && village.members.size >= 3) {
                    const chance = Math.min(0.35, (22 - village.loyalty) * 0.015 + (village.unrest || 0) * 0.002);
                    if ((village.unrest || 0) > 80 || Math.random() < chance) {
                        this.nationSystem.declareIndependence(village.id);
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

        village.loyalty = Math.max(0, Math.min(100, (village.loyalty ?? 70) + delta));
        village.unrest = Math.max(0, Math.min(100, (village.unrest || 0) + (45 - village.loyalty) * 0.08 * dt));
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
}
