import System from '../../../core/System.js';
import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * 💰 NationEconomySystem
 * 국가의 세금 징수, 마을 투자, 공물 처리 및 기술/문화 발전을 전담합니다.
 */
export default class NationEconomySystem extends System {
    constructor(entityManager, eventBus, engine, nationSystem) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.nationSystem = nationSystem;
        this._tributeTimer = 0;
    }

    update(dt) {
        for (const nation of this.nationSystem.nations.values()) {
            this._collectTaxes(nation);
            this._investInVillages(nation);
            this._updatePrestige(nation, dt);
            this._updateNationalProgress(nation, dt);
        }

        this._tributeTimer += dt;
        if (this._tributeTimer >= 6) {
            this._tributeTimer = 0;
            this._processNationalTribute();
        }
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

    _processNationalTribute() {
        const economy = this.engine.systemManager?.economyManager;
        const vs = this.engine.systemManager?.villageSystem;
        if (!economy?.processNationalTributeAndDistribution || !vs) return;
        economy.processNationalTributeAndDistribution(this.nationSystem, vs);
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

    _updatePrestige(nation, dt) {
        nation.prestige = (nation.prestige || 0) + ((nation.totalPopulation || 0) / 10) * 0.1 * dt;
    }
}
