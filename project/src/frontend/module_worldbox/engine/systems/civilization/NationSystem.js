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
            this._collectTaxes(nation); // 💰 세금 징수
            this._investInVillages(nation); // 🎁 왕실 지원금 하사
            this._updatePrestige(nation, dt); // 🏆 위신 업데이트
        }
    }

    /**
     * 🎁 [Royal Support] 자원이 부족한 마을에 국고를 개방하여 지원합니다.
     */
    _investInVillages(nation) {
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs || nation.villages.size === 0) return;

        for (const vid of nation.villages) {
            const v = vs.getVillage(vid);
            if (!v) continue;

            ['wood', 'food', 'stone'].forEach(resType => {
                // 마을 자원이 바닥났고(10 미만), 국고는 넉넉할 때(200 이상) 지원
                if (v.resources[resType] < 10 && nation.resources[resType] > 200) {
                    const gift = 50;
                    
                    // 📦 실제 마을 창고 중 하나에 자원 주입
                    if (v.storageIds && v.storageIds.size > 0) {
                        const storageId = Array.from(v.storageIds)[0];
                        const storageEnt = this.entityManager.entities.get(storageId);
                        const storage = storageEnt?.components.get('Storage');
                        
                        if (storage) {
                            storage.addItem(resType, gift);
                            nation.resources[resType] -= gift;
                            
                            GlobalLogger.info(`👑 [Royal Support] ${nation.name} sent ${gift} ${resType} to ${v.name}`);
                            this.eventBus.emit('SHOW_SPEECH_BUBBLE', { 
                                entityId: v.founderId, // 촌장에게 알림
                                text: `🎁 Royal Gift: ${gift} ${resType}`,
                                duration: 3000
                            });
                        }
                    }
                }
            });
        }
    }

    /** 🏆 국가 위신 업데이트 */
    _updatePrestige(nation, dt) {
        // 인구 10명당 초당 0.1 위신 획득
        const popBonus = (nation.totalPopulation / 10) * 0.1 * dt;
        nation.prestige = (nation.prestige || 0) + popBonus;
    }

    /**
     * 💰 [Economy] 마을로부터 세금을 징수하여 국가 창고에 쌓습니다.
     */
    _collectTaxes(nation) {
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs) return;

        for (const vid of nation.villages) {
            const v = vs.getVillage(vid);
            if (!v) continue;

            // 마을 자원의 일정 비율을 국가 창고로 이전
            const taxRate = nation.taxRate || 0.1;
            
            ['wood', 'food', 'stone'].forEach(res => {
                if (v.resources[res] > 20) { // 마을 최소 운영 자원(20)은 보호
                    const amount = v.resources[res] * (taxRate * 0.005); // 소량씩 징수
                    
                    // 실제 저장소(Storage)에서 자원 차감
                    let remainingToTake = amount;
                    if (v.storageIds) {
                        for (const storageId of v.storageIds) {
                            const storageEnt = this.entityManager.entities.get(storageId);
                            const storage = storageEnt?.components.get('Storage');
                            if (storage) {
                                const taken = storage.withdraw(res, remainingToTake);
                                remainingToTake -= taken;
                                if (remainingToTake <= 0) break;
                            }
                        }
                    }

                    const actualTaken = amount - remainingToTake;
                    nation.resources[res] += actualTaken;
                }
            });
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
            totalPopulation: 0,
            resources: {
                wood: 100,
                food: 100,
                stone: 50,
                gold: 0
            },
            taxRate: 0.1 // 💰 10% 세율
        };
        this.nations.set(id, nation);
        GlobalLogger.success(`🚩 Nation Created: ${nation.name} with color ${nation.color}`);
        return id;
    }

    /**
     * 🎨 [Diversity] 국가마다 겹치지 않는 선명한 고유 색상을 생성합니다. (HSL 활용)
     */
    _generateDiverseColor() {
        const count = this.nations.size;
        // 황금각(Golden Angle)을 활용하여 색상을 골고루 분산
        const hue = (count * 137.508) % 360; 
        
        // HSL to RGB to HEX 변환
        const h = hue / 360;
        const s = 0.7;
        const l = 0.5;
        
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        const toHex = x => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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
