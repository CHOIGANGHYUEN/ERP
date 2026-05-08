import System from '../../core/System.js';
import { AnimalStates } from '../../components/behavior/State.js';

export default class CombatSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;

        // 이벤트 버스를 구독하여 타 시스템과의 강결합 방지
        this.eventBus.on('COMBAT_ATTACK', this.handleAttack.bind(this));
    }

    handleAttack({ attacker, defender }) {
        if (!attacker || !defender) return;

        const em = this.entityManager;
        const sBuffer = em.statsBuffer;
        const tBuffer = em.transformBuffer;

        const aIdx = attacker.id * 8;
        const dIdx = defender.id * 8;
        const dtIdx = defender.id * 2;

        // 1. ⚔️ 데미지 산출 (DOD Buffer Read)
        const strength = sBuffer[aIdx + 6] || 10;
        const defense = sBuffer[dIdx + 7] || 0;
        
        const mitigation = Math.min(0.8, defense / 100);
        const damage = Math.max(1, strength * (1 - mitigation));

        // 2. 🤕 데미지 적용 (DOD Buffer Write)
        sBuffer[dIdx] = Math.max(0, sBuffer[dIdx] - Math.round(damage));

        // 🏥 [Visual Feedback] 피격 컴포넌트 타이머 트리거
        const healthComp = defender.components.get('Health');
        if (healthComp) {
            healthComp.isHit = true;
            healthComp.hitTimer = 0.2;
        }

        // 🚀 [Expert Feedback] 플로팅 데미지 텍스트 생성 (Buffer Coordinate 사용)
        this.eventBus.emit('SPAWN_FLOATING_TEXT', {
            x: tBuffer[dtIdx],
            y: tBuffer[dtIdx + 1] - 10,
            text: `-${Math.round(damage)}`,
            color: '#ff5252',
            options: { size: 16, vy: -2 }
        });

        // 🎨 시각적 피드백 트리거 (공격/피격 모션 - 타임스탬프 방식)
        const totalTime = this.engine.time || Date.now();
        const attackerVisual = attacker.components.get('Visual');
        const defenderVisual = defender.components.get('Visual');
        
        if (attackerVisual) {
            attackerVisual.lastAttackTime = totalTime;
        }
        if (defenderVisual) {
            defenderVisual.lastHitTime = totalTime;
        }

        const defenderState = defender.components.get('AIState');
        if (sBuffer[dIdx] <= 0 && defenderState) {
            defenderState.mode = AnimalStates.DIE;
            defenderState.killerId = attacker.id; // 🍖 [Expert Tracking] 사냥꾼 ID를 기록하여 고기 스폰 시 연동

            // 💰 [Looting] 사망 시 재화 약탈 (인간 간의 전투 등)
            const attackerWealth = attacker.components.get('Wealth');
            const defenderWealth = defender.components.get('Wealth');
            if (attackerWealth && defenderWealth) {
                const loot = Math.floor(defenderWealth.gold * 0.5);
                attackerWealth.addGold(loot);
                defenderWealth.gold -= loot;
            }

            // 😰 [Trauma] 주변 인간들에게 스트레스 부여
            this.eventBus.emit('BATTLE_WITNESSED', { 
                x: tBuffer[dtIdx], 
                y: tBuffer[dtIdx + 1],
                intensity: 20 
            });
        }
    }

    findNearestWarEnemy(entity, radius = 240) {
        const transform = entity.components.get('Transform');
        const civ = entity.components.get('Civilization');
        const ns = this.engine.systemManager?.nationSystem;
        const vs = this.engine.systemManager?.villageSystem;
        const spatialHash = this.engine.spatialHash;
        if (!transform || !civ || !ns || !vs || !spatialHash) return null;

        const ownVillage = vs.getVillage(civ.villageId);
        const ownNationId = civ.nationId ?? ownVillage?.nationId ?? -1;
        if (ownNationId === -1) return null;

        let bestId = null;
        let bestDistSq = radius * radius;
        spatialHash.eachInRange(transform.x, transform.y, radius, (otherId) => {
            if (otherId === entity.id) return;
            const other = this.entityManager.entities.get(otherId);
            if (!other || !other.components.has('Animal')) return;
            const otherCiv = other.components.get('Civilization');
            if (!otherCiv) return;

            const otherVillage = vs.getVillage(otherCiv.villageId);
            const otherNationId = otherCiv.nationId ?? otherVillage?.nationId ?? -1;
            if (!ns.isAtWar(ownNationId, otherNationId)) return;

            const otherStats = other.components.get('BaseStats');
            if (otherStats && otherStats.health <= 0) return;

            const otherTransform = other.components.get('Transform');
            if (!otherTransform) return;
            const dx = transform.x - otherTransform.x;
            const dy = transform.y - otherTransform.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                bestId = otherId;
            }
        });

        return bestId;
    }

    update(dt, time) {
        // 상태 이상(독, 화상 등)에 의한 지속 데미지 로직이 필요할 때 활용 가능
    }
}
