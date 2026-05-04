import System from '../../core/System.js';
import { GlobalLogger } from '../../utils/Logger.js';

/**
 * 👑 NationSystem
 * 여러 마을을 하나의 국가로 통합하고 왕을 선출합니다.
 */
export default class NationSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.nations = new Map();
        this.nextNationId = 1;
    }

    update(dt, time) {
        // 국가 단위의 통계 및 정책 업데이트 (향후 전쟁/외교 로직 확장 가능)
        for (const nation of this.nations.values()) {
            this._updateNationStats(nation);
            this._checkKingStatus(nation);
        }
    }

    createNation(name, color) {
        const id = this.nextNationId++;
        const nation = {
            id,
            name: name || `Kingdom of ${id}`,
            color: color || '#f44336',
            villages: new Set(),
            kingId: null,
            prestige: 0,
            totalPopulation: 0
        };
        this.nations.set(id, nation);
        GlobalLogger.success(`🚩 Nation Created: ${nation.name}`);
        return id;
    }

    addVillageToNation(nationId, villageId) {
        const nation = this.nations.get(nationId);
        if (nation) {
            nation.villages.add(villageId);
            const village = this.engine.systemManager?.villageSystem?.getVillage(villageId);
            if (village) {
                village.nationId = nationId;
            }
        }
    }

    _updateNationStats(nation) {
        let totalPop = 0;
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs) return;

        for (const vid of nation.villages) {
            const v = vs.getVillage(vid);
            if (v) totalPop += v.members.size;
        }
        nation.totalPopulation = totalPop;
    }

    _checkKingStatus(nation) {
        // 왕이 없거나 죽었으면 새로운 왕 선출 (가장 권위 있는 촌장 중 한 명)
        if (nation.kingId) {
            const king = this.entityManager.entities.get(nation.kingId);
            const state = king?.components.get('AIState');
            if (!king || (state && state.mode === 'die')) {
                GlobalLogger.info(`👑 King ${nation.kingId} has died in ${nation.name}.`);
                nation.kingId = null;
            }
        }

        if (!nation.kingId && nation.villages.size > 0) {
            this._electKing(nation);
        }
    }

    _electKing(nation) {
        const vs = this.engine.systemManager?.villageSystem;
        let candidateId = null;
        let maxAge = -1;

        // 마을 촌장들 중에서 가장 나이가 많거나 경험이 많은 사람을 왕으로 추대
        for (const vid of nation.villages) {
            const v = vs.getVillage(vid);
            if (v && v.founderId) {
                const founder = this.entityManager.entities.get(v.founderId);
                const age = founder?.components.get('Age')?.currentAge || 0;
                if (age > maxAge) {
                    maxAge = age;
                    candidateId = v.founderId;
                }
            }
        }

        if (candidateId) {
            nation.kingId = candidateId;
            const kingEntity = this.entityManager.entities.get(candidateId);
            const civ = kingEntity?.components.get('Civilization');
            if (civ) {
                civ.isKing = true;
                civ.title = 'King';
                GlobalLogger.success(`👑 ${nation.name} has a new KING: Entity ${candidateId}`);
                this.eventBus.emit('KING_ELECTED', { nationId: nation.id, kingId: candidateId });
            }
        }
    }
}
