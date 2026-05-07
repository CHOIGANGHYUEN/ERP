import System from '../../core/System.js';
import { GlobalLogger } from '../../utils/Logger.js';
import SocialComponent from '../../components/civilization/SocialComponent.js';

/**
 * 👫 SocialSystem
 * 결혼, 주거지 공유, 인구 번식(출산)을 관리합니다.
 */
export default class SocialSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.birthCooldown = 15000; 
        this._updateIndex = 0; // 분할 처리를 위한 인덱스
        this._processPerFrame = 20; // 프레임당 처리할 최대 인원
    }

    update(dt, time) {
        const em = this.entityManager;

        // 🚀 [Optimization] 분할 처리 (인원이 많아도 프레임 드랍 방지)
        const ids = Array.from(em.humanIds);
        const count = ids.length;
        if (count === 0) return;

        const processCount = Math.min(count, this._processPerFrame);
        for (let i = 0; i < processCount; i++) {
            this._updateIndex = (this._updateIndex + 1) % count;
            const id = ids[this._updateIndex];
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

            // 1. 💍 파트너 찾기 (미혼 성인)
            if (!social.isMarried && stats.hunger > 50) {
                this._findPartner(id, entity, social, civ);
            }

            // 2. 👶 번식 로직
            if (social.isMarried && stats.hunger > 60) {
                this._processReproduction(id, entity, social, civ, time, dt);
            }
        }
    }

    _findPartner(id, entity, social, civ) {
        const em = this.entityManager;
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        const spatialHash = this.engine.spatialHash;
        if (!transform || !spatialHash || !animal) return;

        // 🔍 공간 해시 쿼리 사용 (반경 150px - 가비지 프리)
        spatialHash.eachInRange(transform.x, transform.y, 150, (targetId) => {
            if (id === targetId || social.isMarried) return;

            const target = em.entities.get(targetId);
            if (!target) return;

            const targetCiv = target.components.get('Civilization');
            const targetAnimal = target.components.get('Animal');
            const targetSocial = target.components.get('Social');
            
            // 1. 마을 소속 확인 (동일 마을 내 연애 선호)
            if (targetCiv?.villageId !== civ.villageId) {
                // 마을이 다르더라도 같은 국가라면 일정 확률로 허용 (향후 이민/유동성 확장)
                const vs = this.engine.systemManager?.villageSystem;
                const v1 = vs?.getVillage(civ.villageId);
                const v2 = vs?.getVillage(targetCiv?.villageId);
                
                if (!v1 || !v2 || v1.nationId !== v2.nationId) {
                    // 국가가 다르다면 외교 상태 확인
                    const ns = this.engine.systemManager?.nationSystem;
                    const rel = ns?.getRelationship(v1?.nationId, v2?.nationId);
                    if (!rel || rel.state === 'war' || rel.opinion < 30) return; // 전쟁 중이거나 관계가 매우 나쁘면 불가
                } else {
                    // 같은 국가 내 다른 마을이면 50% 확률로만 진행 (마을 결속력)
                    if (Math.random() < 0.5) return;
                }
            }

            // 2. 성별 확인 (이성끼리만 결혼)
            if (targetAnimal?.gender === animal.gender) return;

            // 3. 미혼 여부 확인
            if (targetSocial && !targetSocial.isMarried) {
                // 💍 결혼 성공!
                social.partnerId = targetId;
                social.isMarried = true;
                targetSocial.partnerId = id;
                targetSocial.isMarried = true;

                GlobalLogger.success(`💍 Marriage! ${animal.gender === 'male' ? '🤵' : '👰'} Entity ${id} and ${targetId} between Villages ${civ.villageId} and ${targetCiv?.villageId}`);
                this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: transform.x, y: transform.y, count: 15, type: 'EFFECT', color: '#ff4081', speed: 3
                });
            }
        });
    }

    _processReproduction(id, entity, social, civ, time, dt) {
        // 번식 중인 경우 타이머 업데이트
        if (social.isBreeding) {
            // 🚀 [Bug Fix] dt를 기반으로 밀리초 단위 타이머 감소 (프레임 독립적)
            social.breedingTimer -= (dt * 1000); 
            
            const transform = entity.components.get('Transform');
            if (transform && Math.random() < 0.2) {
                // ❤️ 하트 파티클 효과 (시각적 연출)
                this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: transform.x, y: transform.y - 10, count: 1, type: 'EFFECT', color: '#ff4081', speed: 1.5
                });
            }

            if (social.breedingTimer <= 0) {
                this.finishReproduction(id, entity, social, civ, time);
            }
            return;
        }

        // 출산 쿨다운 및 확률 체크
        if (time - (social.lastBirth || 0) < this.birthCooldown) return;
        
        // 부모 중 한 명만 번식을 주도 (중복 방지: 수컷이 주도)
        const animal = entity.components.get('Animal');
        if (animal?.gender !== 'male') return;

        // 📈 [Balance] 번식 확률 소폭 상향 및 인구 밀도 고려
        if (Math.random() < 0.03) { 
            const partner = this.entityManager.entities.get(social.partnerId);
            const partnerSocial = partner?.components.get('Social');
            if (!partnerSocial || partnerSocial.isBreeding) return;

            // 마을의 주거 용량 확인
            const village = this.engine.systemManager?.villageSystem?.getVillage(civ.villageId);
            if (!village) return;

            const currentPop = village.members.size;
            let totalCapacity = 0;
            for (const bId of village.buildings) {
                const b = this.entityManager.entities.get(bId);
                const housing = b?.components.get('Housing');
                const structure = b?.components.get('Structure');
                // 🏘️ 완공된 집만 용량으로 인정
                if (housing && structure?.isComplete) totalCapacity += housing.capacity;
            }

            // 🏠 여유 공간이 있을 때만 번식 시도
            if (currentPop < totalCapacity) {
                // 💋 번식 시작! (3초간 모션)
                social.isBreeding = true;
                social.breedingTimer = 3000;
                partnerSocial.isBreeding = true;
                partnerSocial.breedingTimer = 3000;
                
                GlobalLogger.info(`💕 Entities ${id} & ${social.partnerId} are breeding...`);
            }
        }
    }

    finishReproduction(id, entity, social, civ, time) {
        social.isBreeding = false;
        social.lastBirth = time;

        const partnerId = social.partnerId;
        const partner = this.entityManager.entities.get(partnerId);
        const partnerSocial = partner?.components.get('Social');
        if (partnerSocial) {
            partnerSocial.isBreeding = false;
            partnerSocial.lastBirth = time;
        }

        // 👶 새로운 아기 스폰!
        const transform = entity.components.get('Transform');
        const babyId = this.engine.factoryProvider.spawn('human', 'human', 
            transform.x + (Math.random() - 0.5) * 10, 
            transform.y + (Math.random() - 0.5) * 10, 
            { villageId: civ.villageId, isBaby: true }
        );

        if (babyId) {
            GlobalLogger.success(`👶 A new life! Baby ${babyId} born in Village ${civ.villageId}`);
            this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                x: transform.x, y: transform.y, count: 20, type: 'EFFECT', color: '#ffffff', speed: 5
            });
        }
    }
}
