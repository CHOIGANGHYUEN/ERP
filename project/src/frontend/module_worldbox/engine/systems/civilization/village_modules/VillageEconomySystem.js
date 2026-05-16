import System from '../../../core/System.js';
import { JobTypes } from '../../../config/JobTypes.js';
import { VillageBonuses, VillageTypes } from '../../../config/VillageTypes.js';
import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * 💰 VillageEconomySystem
 * 마을의 자원 수급, 경제망, 직업 스케줄링 및 국가 정책 반영을 전담합니다.
 * VillageSystem에서 SRP에 따라 분리되었습니다.
 */
export default class VillageEconomySystem extends System {
    constructor(entityManager, eventBus, engine, villageSystem) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.villageSystem = villageSystem;
        this._economyTimer = 0;
        this._scheduleTimer = 0;
        this._SCHEDULE_INTERVAL = 15.0;

        // 📡 Listen for events
        this.eventBus.on('STORAGE_CHANGED', (data) => this._onStorageChanged(data));
    }

    _onStorageChanged(data) {
        const { entityId } = data;
        const ent = this.entityManager.entities.get(entityId);
        const civ = ent?.components.get('Civilization');
        if (civ && civ.villageId !== -1) {
            this.villageSystem.dirtyVillages.add(civ.villageId);
        }
    }

    update(dt) {
        // 1. [Expert Economy] 국가 경제망 업데이트 (5초 주기)
        this._economyTimer -= dt;
        if (this._economyTimer <= 0) {
            if (this.villageSystem.villages.size > 1) {
                this._processNationEconomy();
            }
            // 🚀 [Expert Optimization] 창고가 없는 마을은 주기적으로 dirty 체크하여 초기 자원 감지
            for (const [id, v] of this.villageSystem.villages) {
                if (!v.storageIds || v.storageIds.size === 0) {
                    this.villageSystem.dirtyVillages.add(id);
                }
            }
            this._economyTimer = 5.0;
        }

        // 2. [Task 58] 동적 직업 스케줄링 (15초 주기)
        this._scheduleTimer -= dt;
        if (this._scheduleTimer <= 0) {
            this._scheduleTimer = this._SCHEDULE_INTERVAL;
            for (const village of this.villageSystem.villages.values()) {
                this._dynamicJobSchedule(village);
            }
        }

        // 3. 국가 정책 및 영향력 업데이트
        for (const village of this.villageSystem.villages.values()) {
            this._updateNationalInfluence(village, dt);
        }
    }

    syncResources(village) {
        const total = { wood: 0, food: 0, stone: 0, gold: 0 };
        if (!village.storageIds) village.storageIds = new Set();

        // 1. 창고 자원 집계
        for (const storageId of village.storageIds) {
            const ent = this.entityManager.entities.get(storageId);
            const storage = ent?.components.get('Storage');
            if (storage && storage.items) {
                for (const [type, amount] of Object.entries(storage.items)) {
                    const amt = Number(amount);
                    if (['meat', 'berry', 'wheat', 'food'].includes(type.toLowerCase())) total.food += amt;
                    else if (total[type] !== undefined) total[type] += amt;
                    else total[type] = (total[type] || 0) + amt;
                }
            }
        }

        // 2. 🚀 [Bootstrap Fix] 창고가 없거나 자원이 부족할 경우 주민 인벤토리도 합산
        // 초기 정착지에서 본파이어/창고 청사진이 제안되지 않는 '데드락' 방지
        if (village.storageIds.size === 0 || (total.wood < 5 && total.food < 5)) {
            for (const memberId of village.members) {
                const member = this.entityManager.entities.get(memberId);
                const inventory = member?.components.get('Inventory');
                if (inventory && inventory.items) {
                    for (const [type, amount] of Object.entries(inventory.items)) {
                        const amt = Number(amount);
                        if (['meat', 'berry', 'wheat', 'food'].includes(type.toLowerCase())) total.food += amt;
                        else if (total[type] !== undefined) total[type] += amt;
                    }
                }
            }
        }

        village.resources = total;
        village.buffs = village.buffs || { constructionSpeed: 1.0, morale: 1.0, gatherEfficiency: 1.0 };

        const bonuses = VillageBonuses[village.type] || VillageBonuses[VillageTypes.GENERAL];
        village.buffs.foodGatherRate = bonuses.foodGatherRate || 1.0;
        village.buffs.woodGatherRate = bonuses.woodGatherRate || 1.0;
        village.buffs.stoneGatherRate = bonuses.stoneGatherRate || 1.0;

        this._applyNationBuffs(village);

        if (this.eventBus) {
            this.eventBus.emit('VILLAGE_RESOURCES_UPDATED', {
                villageId: village.id,
                resources: village.resources
            });
        }
    }

    _applyNationBuffs(village) {
        if (village.nationId === -1) return;
        const ns = this.engine.systemManager?.nationSystem;
        const nation = ns?.nations.get(village.nationId);
        if (!nation) return;

        if (nation.kingId) {
            village.buffs.constructionSpeed = 1.2;
            village.buffs.morale = 1.1;
        } else {
            village.buffs.constructionSpeed = 1.0;
            village.buffs.morale = 1.0;
        }

        const techLevel = Math.floor(nation.tech || 0);
        village.buffs.gatherEfficiency = 1.0 + (techLevel * 0.05);
        village.buffs.constructionSpeed *= (1.0 + techLevel * 0.02);
    }

    _updateNationalInfluence(village, dt) {
        if (village.nationId === -1) return;
        const ns = this.engine.systemManager?.nationSystem;
        const nation = ns?.nations.get(village.nationId);
        if (!nation || !nation.policies) return;

        if (nation.policies.expansion > 1.0) {
            village._expansionCooldown -= (dt * (nation.policies.expansion - 1.0));
        }

        switch (nation.policies.focus) {
            case 'military':
                village.buffs.morale = (village.buffs.morale || 1.0) * 1.2;
                break;
            case 'economy':
                village.buffs.gatherEfficiency *= 1.1;
                break;
            case 'culture':
                village.cultureRate = 1.5;
                break;
        }
    }

    _processNationEconomy() {
        const ns = this.engine.systemManager?.nationSystem;
        if (!ns) return;

        for (const nation of ns.nations.values()) {
            if (nation.villages.size < 2) continue;

            const villageList = Array.from(nation.villages).map(id => this.villageSystem.villages.get(id)).filter(v => v);

            for (const provider of villageList) {
                for (const receiver of villageList) {
                    if (provider.id === receiver.id) continue;

                    ['food', 'wood', 'stone'].forEach(resType => {
                        const providerNeed = provider.resourceNeeds[resType] || 20;
                        const receiverNeed = receiver.resourceNeeds[resType] || 20;

                        if (provider.resources[resType] > providerNeed * 3 && receiver.resources[resType] < receiverNeed) {
                            const giftAmount = 20;
                            let remainingToWithdraw = giftAmount;
                            
                            if (provider.storageIds && provider.storageIds.size > 0) {
                                for (const sid of provider.storageIds) {
                                    const sEnt = this.entityManager.entities.get(sid);
                                    const storage = sEnt?.components.get('Storage');
                                    if (storage) {
                                        const taken = storage.withdraw(resType, remainingToWithdraw);
                                        remainingToWithdraw -= taken;
                                        if (remainingToWithdraw <= 0) break;
                                    }
                                }
                            }

                            const actualMoved = giftAmount - remainingToWithdraw;
                            if (actualMoved > 0 && receiver.storageIds && receiver.storageIds.size > 0) {
                                const targetSid = Array.from(receiver.storageIds)[0];
                                const targetEnt = this.entityManager.entities.get(targetSid);
                                const targetStorage = targetEnt?.components.get('Storage');
                                if (targetStorage) {
                                    targetStorage.addItem(resType, actualMoved);
                                    this.eventBus.emit('SHOW_SPEECH_BUBBLE', {
                                        entityId: provider.chiefId, text: `📦 Exporting ${resType}`, duration: 2000
                                    });
                                }
                            }
                        }
                    });
                }
            }
        }
    }

    _dynamicJobSchedule(village) {
        if (!village || village.members.size < 3) return;
        const rf = this.engine.systemManager?.humanBehavior?.roleFactory;
        const JT = JobTypes;
        const res = village.resources || {};
        const pop = village.members.size;

        const foodCritical = (res.food || 0) < pop * 2;
        const woodCritical = (res.wood || 0) < pop * 1.5;
        const stoneCritical = (res.stone || 0) < 10;

        const ns = this.engine.systemManager?.nationSystem;
        const nation = ns?.getNation(village.nationId);
        const isNationalWar = nation && nation.atWarWith && nation.atWarWith.size > 0;
        const nationalFoodScarcity = nation && (nation.resources.food < 50);

        const distribution = {};
        for (const memberId of village.members) {
            const member = this.entityManager.entities.get(memberId);
            const civ = member?.components.get('Civilization');
            if (!civ) continue;
            const jt = civ.jobType || 'unemployed';
            distribution[jt] = (distribution[jt] || 0) + 1;
        }

        const reassignableJobs = [JT.UNEMPLOYED, JT.RANCHER, JT.MERCHANT];
        const candidates = [];

        for (const memberId of village.members) {
            const member = this.entityManager.entities.get(memberId);
            const civ = member?.components.get('Civilization');
            const state = member?.components.get('AIState');
            if (!civ || !state) continue;
            if (civ.jobType === JT.CHIEF) continue;

            const isIdle = state.mode === 'idle' || state.mode === 'wander';
            const isReassignable = reassignableJobs.includes(civ.jobType);
            if (isIdle || isReassignable) candidates.push({ memberId, member, civ });
        }

        if (candidates.length === 0) return;

        let reassigned = 0;
        const MAX_REASSIGN = Math.ceil(candidates.length * 0.5);

        const _reassign = (targetJob) => {
            if (reassigned >= MAX_REASSIGN || candidates.length === 0) return;
            const { memberId, member, civ } = candidates.shift();
            civ.jobType = targetJob;
            if (rf) civ.role = rf.createRole(targetJob);
            const jobCtrl = member.components.get('JobController');
            if (jobCtrl && typeof jobCtrl.assignJob === 'function') {
                jobCtrl.assignJob(targetJob);
            }
            reassigned++;
        };

        if (foodCritical || nationalFoodScarcity) { _reassign(JT.GATHERER); _reassign(JT.FARMER); }
        if (woodCritical) { _reassign(JT.LOGGER); }
        if (stoneCritical) { _reassign(JT.MINER); }

        if (isNationalWar) {
            const currentWarriors = distribution[JT.WARRIOR] || 0;
            const targetWarriors = Math.ceil(pop * 0.25);
            if (currentWarriors < targetWarriors) {
                for (let i = 0; i < (targetWarriors - currentWarriors); i++) {
                    _reassign(JT.WARRIOR);
                }
            }
        }

        while (candidates.length > 0 && reassigned < MAX_REASSIGN) {
            _reassign(JT.GATHERER);
        }
    }
}
