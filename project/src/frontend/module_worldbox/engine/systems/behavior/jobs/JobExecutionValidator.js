import { JobExecutionStates } from './JobStateDefinitions.js';
import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * 🕵️ JobExecutionValidator
 * 주민의 직업 수행 상태를 감시하고, 비정상적인 상황(데드락, 경로 막힘 등)을 감지합니다.
 */
export default class JobExecutionValidator {
    constructor(entityManager, engine) {
        this.em = entityManager;
        this.engine = engine;
        this._STUCK_THRESHOLD = 15.0; // 15초 이상 진전이 없으면 STUCK으로 판정
    }

    /**
     * 개별 주민의 직무 수행 유효성을 검증합니다.
     */
    validate(id, entity, dt) {
        const jobCtrl = entity.components.get('JobController');
        if (!jobCtrl || jobCtrl.currentJob === 'unemployed') return true;

        // 1. 상태별 타이머 업데이트
        const lastState = jobCtrl.getData('lastValidationState');
        const currentState = jobCtrl.jobState;
        
        if (lastState !== currentState) {
            jobCtrl.setData('stateTimer', 0);
            jobCtrl.setData('lastValidationState', currentState);
        } else {
            jobCtrl.setData('stateTimer', (jobCtrl.getData('stateTimer') || 0) + dt);
        }

        // 2. 데드락 감지 (STUCK 판정)
        const stateTimer = jobCtrl.getData('stateTimer');

        // 이동 중인데 15초 넘게 제자리거나 진전이 없는 경우
        if (currentState === JobExecutionStates.MOVING_TO_WORK && stateTimer > this._STUCK_THRESHOLD) {
            this._handleStuck(id, entity, jobCtrl, 'Movement Timeout');
            return false;
        }

        // 자재 대기 상태가 너무 오래 지속되는 경우 (공급망 병목)
        if (currentState === JobExecutionStates.WAITING_FOR_RESOURCE && stateTimer > 30.0) {
            GlobalLogger.warn(`⚠️ [Validator] Entity ${id} is waiting for resources for too long.`);
            // 이는 에러는 아니지만 시스템에 알릴 필요가 있음
        }

        // 3. 타겟 유효성 검증
        if (jobCtrl.targetId && (currentState === JobExecutionStates.MOVING_TO_WORK || currentState === JobExecutionStates.WORKING)) {
            if (!this.em.entities.has(jobCtrl.targetId)) {
                this._handleStuck(id, entity, jobCtrl, 'Target Lost');
                return false;
            }
        }

        return true;
    }

    _handleStuck(id, entity, jobCtrl, reason) {
        GlobalLogger.warn(`🚫 [Validator] Entity ${id} STUCK: ${reason}`);
        jobCtrl.jobState = JobExecutionStates.STUCK;
        
        // 시각적 피드백
        if (this.engine.eventBus) {
            this.engine.eventBus.emit('SHOW_SPEECH_BUBBLE', { 
                entityId: id, 
                text: '💢', 
                duration: 2000 
            });
        }
    }
}
