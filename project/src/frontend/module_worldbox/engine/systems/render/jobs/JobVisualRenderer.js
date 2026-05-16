import { JobExecutionStates } from '../../behavior/jobs/JobStateDefinitions.js';
import { JobTypes } from '../../../config/JobTypes.js';

/**
 * 🎨 JobVisualRenderer
 * 주민의 직업 상태(JobState)를 시각적인 애니메이션과 도구 렌더링으로 변환합니다.
 */
export default class JobVisualRenderer {
    constructor(engine) {
        this.engine = engine;
    }

    /**
     * 인간 엔티티의 현재 직업 상태에 따른 추가 데코레이션을 그립니다.
     */
    draw(ctx, entity, state, transform, jobCtrl, viewScale) {
        if (!jobCtrl || jobCtrl.currentJob === JobTypes.UNEMPLOYED) return;

        const jobState = jobCtrl.jobState;
        const jobType = jobCtrl.currentJob;

        // 1. 작업 도구(Tool) 렌더링
        this._drawTool(ctx, jobType, jobState, transform, viewScale);

        // 2. 상태별 이모지/말풍선 (자원 부족 등)
        if (jobState === JobExecutionStates.WAITING_FOR_RESOURCE) {
            this._drawStatusIcon(ctx, '📦?', transform, viewScale);
        } else if (jobState === JobExecutionStates.STUCK) {
            this._drawStatusIcon(ctx, '💢', transform, viewScale);
        }
    }

    /** 🛠️ 직업에 맞는 도구를 손 위치에 렌더링 */
    _drawTool(ctx, jobType, jobState, transform, viewScale) {
        if (jobState !== JobExecutionStates.WORKING && jobState !== JobExecutionStates.MOVING_TO_WORK) return;

        ctx.save();
        
        // 애니메이션 기반 위치 계산 (HumanRenderer의 Squash & Stretch와 동기화)
        const time = performance.now() / 1000;
        const swing = jobState === JobExecutionStates.WORKING ? Math.sin(time * 10) * 0.5 : 0;
        
        ctx.translate(8, 0); // 오른손 위치 대략 이동
        ctx.rotate(swing);

        let toolEmoji = '';
        switch (jobType) {
            case JobTypes.LOGGER: toolEmoji = '🪓'; break;
            case JobTypes.MINER: toolEmoji = '⛏️'; break;
            case JobTypes.FARMER: toolEmoji = '🌾'; break;
            case JobTypes.ARCHITECT: toolEmoji = '🔨'; break;
            case JobTypes.GATHERER: toolEmoji = '🧺'; break;
        }

        if (toolEmoji) {
            ctx.font = `${8 / viewScale}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(toolEmoji, 0, 0);
        }

        ctx.restore();
    }

    _drawStatusIcon(ctx, icon, transform, viewScale) {
        const time = performance.now() / 1000;
        const bounce = Math.sin(time * 5) * 2;
        
        ctx.save();
        ctx.font = `${10 / viewScale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(icon, 0, -25 + bounce);
        ctx.restore();
    }
}
