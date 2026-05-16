/**
 * 🏷️ JobStateDefinitions
 * 주민의 직업 수행 중 발생하는 세부 행동 상태를 정의합니다.
 * 이를 통해 'IDLE'이나 'WANDER'에 섞여 있던 모호한 상태를 명확히 분리하여 데드락 감지를 가능케 합니다.
 */
export const JobExecutionStates = Object.freeze({
    IDLE: 'IDLE',                       // 할일 없음 (대기)
    SEARCHING_TARGET: 'SEARCHING',      // 작업 대상(나무, 건물 등) 탐색 중
    MOVING_TO_WORK: 'MOVING',           // 작업 위치로 이동 중
    WORKING: 'WORKING',                 // 실제 작업 수행 중 (벌목, 건설 등)
    WAITING_FOR_RESOURCE: 'WAITING_RES', // 자재 부족으로 대기 중 (건축가 등)
    RETURNING_TO_VILLAGE: 'RETURNING',  // 창고에 자원 입고하러 가는 중
    INTERRUPTED_BY_NEEDS: 'INTERRUPTED',// 생존 욕구(허기 등)로 인해 잠시 중단됨
    STUCK: 'STUCK'                      // 경로 막힘 등으로 인해 진행 불가 (감사 대상)
});

/** 
 * 🚀 [DOD Mapping] Buffer 저장을 위한 정수 값 맵
 * SystemManager의 DOD 구조와 연동됩니다.
 */
export const JobStateToIndex = {
    [JobExecutionStates.IDLE]: 0,
    [JobExecutionStates.SEARCHING_TARGET]: 1,
    [JobExecutionStates.MOVING_TO_WORK]: 2,
    [JobExecutionStates.WORKING]: 3,
    [JobExecutionStates.WAITING_FOR_RESOURCE]: 4,
    [JobExecutionStates.RETURNING_TO_VILLAGE]: 5,
    [JobExecutionStates.INTERRUPTED_BY_NEEDS]: 6,
    [JobExecutionStates.STUCK]: 7
};
