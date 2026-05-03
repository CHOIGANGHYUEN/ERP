import System from '../../core/System.js';
import SocialComponent from '../../components/civilization/SocialComponent.js';

/**
 * 👫 SocialSystem
 * 결혼, 주거지 공유, 인구 번식(출산)을 관리합니다.
 */
export default class SocialSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.birthCooldown = 15000; // 출산 쿨다운 (15초)
    }

    update(dt, time) {
        const em = this.entityManager;
        
        // 🚀 [Optimization] humanIds만 순회
        for (const id of em.humanIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            let social = entity.components.get('Social');
            if (!social) {
                social = new SocialComponent();
                em.addComponent(id, social, 'Social');
            }

            const stats = entity.components.get('BaseStats');
            const civ = entity.components.get('Civilization');
            if (!stats || !civ || stats.health <= 0) continue;

            // 1. 💍 파트너 찾기 (결혼하지 않은 성인인 경우)
            if (!social.isMarried && stats.hunger > 50) {
                this._findPartner(id, entity, social, civ);
            }

            // 2. 👶 번식 로직 (배우자가 있고, 집에 있으며, 배가 부를 때)
            if (social.isMarried && stats.hunger > 80) {
                this._processReproduction(id, entity, social, civ, time);
            }
        }
    }

    _findPartner(id, entity, social, civ) {
        const em = this.entityManager;
        const transform = entity.components.get('Transform');
        if (!transform) return;

        // 같은 마을 내에서 미혼인 사람 찾기
        for (const targetId of em.humanIds) {
            if (id === targetId) continue;
            
            const target = em.entities.get(targetId);
            const targetSocial = target?.components.get('Social');
            const targetCiv = target?.components.get('Civilization');
            
            if (targetSocial && !targetSocial.isMarried && targetCiv?.villageId === civ.villageId) {
                const targetTransform = target.components.get('Transform');
                const distSq = (targetTransform.x - transform.x) ** 2 + (targetTransform.y - transform.y) ** 2;
                
                if (distSq < 10000) { // 적당히 가까운 거리 (100px 이내)
                    // 💍 결혼 성공!
                    social.partnerId = targetId;
                    social.isMarried = true;
                    targetSocial.partnerId = id;
                    targetSocial.isMarried = true;
                    
                    console.log(`💍 Marriage! Entity ${id} and ${targetId} in Village ${civ.villageId}`);
                    this.eventBus.emit('MARRIAGE_CELEBRATED', { personA: id, personB: targetId });
                    break;
                }
            }
        }
    }

    _processReproduction(id, entity, social, civ, time) {
        // 출산은 확률적이며 쿨다운이 있음
        if (time - (social.lastBirth || 0) < this.birthCooldown) return;
        if (Math.random() < 0.005) { // 틱당 낮은 확률
            const village = this.engine.systemManager?.villageSystem?.getVillage(civ.villageId);
            if (!village) return;

            // 마을의 주거 용량 확인
            const currentPop = village.members.size;
            let totalCapacity = 0;
            for (const bId of village.buildings) {
                const b = this.entityManager.entities.get(bId);
                const housing = b?.components.get('Housing');
                if (housing) totalCapacity += housing.capacity;
            }

            if (currentPop < totalCapacity) {
                // 👶 새로운 아기 스폰!
                const transform = entity.components.get('Transform');
                const babyId = this.engine.factoryProvider.spawn('human', 'human', transform.x + (Math.random() - 0.5) * 20, transform.y + (Math.random() - 0.5) * 20, {
                    villageId: civ.villageId
                });

                if (babyId) {
                    social.lastBirth = time;
                    const partner = this.entityManager.entities.get(social.partnerId);
                    if (partner) {
                        const partnerSocial = partner.components.get('Social');
                        if (partnerSocial) partnerSocial.lastBirth = time;
                    }
                    
                    console.log(`👶 A new life! Baby ${babyId} born in Village ${civ.villageId}`);
                }
            }
        }
    }
}
