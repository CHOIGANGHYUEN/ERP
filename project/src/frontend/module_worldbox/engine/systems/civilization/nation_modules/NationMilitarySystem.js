import System from '../../../core/System.js';
import { GlobalLogger } from '../../../utils/Logger.js';
import { DIPLOMACY } from './NationDiplomacySystem.js';

/**
 * ⚔️ NationMilitarySystem
 * 전쟁 시뮬레이션, 군사 작전, 영토 점령 및 마을 탈취를 전담합니다.
 */
export default class NationMilitarySystem extends System {
    constructor(entityManager, eventBus, engine, nationSystem) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.nationSystem = nationSystem;
        this._warTimer = 0;
    }

    update(dt) {
        this._warTimer += dt;
        if (this._warTimer >= 4) {
            this._warTimer = 0;
            this._processWars();
        }
    }

    _processWars() {
        const handled = new Set();
        for (const [key, state] of this.nationSystem.diplomaticStates) {
            if (state !== DIPLOMACY.WAR || handled.has(key)) continue;
            
            const [id1, id2] = key.split('_').map(Number);
            const n1 = this.nationSystem.nations.get(id1);
            const n2 = this.nationSystem.nations.get(id2);
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
            return this.nationSystem.captureVillage(attacker.id, best.defenderVillage.id, 'war');
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
}
