import AStarSearch from './AStarSearch.js';

/**
 * 🚶 PathFollower
 * 엔티티의 실제 이동 및 경로 추적 물리 제어를 담당합니다.
 * Pathfinder.js에서 SRP에 따라 분리되었습니다.
 */
export default class PathFollower {
    constructor(pathfinderFacade) {
        this.pf = pathfinderFacade;
    }

    followPath(transform, state, targetPos, speed, engine, targetRadius = 12, recalcIntervalOverride = null, targetIdOverride = null, velocity = null) {
        const now = Date.now();
        const currentTargetId = targetIdOverride || state.targetId;
        
        const isEmergency = ['flee', 'eat', 'forage', 'sleep', 'hunt', 'attack'].includes(state.mode);
        const defaultInterval = isEmergency ? 500 : 30000;
        const recalcInterval = recalcIntervalOverride || defaultInterval;

        let needsRecalc = !state.path || 
                          state.pathTargetId !== currentTargetId || 
                          (now - (state.lastPathCalcTime || 0) > recalcInterval);

        if (needsRecalc) {
            const distSq = Math.pow(targetPos.x - transform.x, 2) + Math.pow(targetPos.y - transform.y, 2);
            
            if (distSq > 90000) {
                const hPath = this.pf.findHierarchicalPath(transform.x, transform.y, targetPos.x, targetPos.y, engine);
                if (hPath === null) return false;

                if (hPath.fullAbstractPath) {
                    state.abstractPath = hPath.fullAbstractPath;
                    state.abstractIndex = 0;
                    state.path = hPath.localPath;
                } else {
                    state.path = hPath;
                    state.abstractPath = null;
                }
            } else {
                const path = AStarSearch.findPath(transform.x, transform.y, targetPos.x, targetPos.y, engine, 10, false, this.pf);
                if (path === null) return false;
                
                state.path = path;
                state.abstractPath = null;
            }
            
            state.pathTargetId = currentTargetId;
            state.pathIndex = 0;
            state.lastPathCalcTime = now;
        }

        if (state.path) {
            if (state.path.length === 0) {
                if (state.abstractPath && state.abstractIndex < state.abstractPath.length - 1) {
                    state.abstractIndex++;
                    const [nextX, nextY] = state.abstractPath[state.abstractIndex].split(',').map(Number);
                    const nextPath = AStarSearch.findPath(transform.x, transform.y, nextX, nextY, engine, 10, false, this.pf);
                    if (nextPath === null) return false;

                    state.path = nextPath;
                    state.pathIndex = 0;
                    if (!state.path || state.path.length === 0) return -1;
                } else {
                    if (velocity) { velocity.vx = 0; velocity.vy = 0; }
                    else { transform.vx = 0; transform.vy = 0; }
                    return -1;
                }
            }

            const dxEnd = targetPos.x - transform.x;
            const dyEnd = targetPos.y - transform.y;
            if (dxEnd * dxEnd + dyEnd * dyEnd <= targetRadius * targetRadius) {
                if (velocity) { velocity.vx = 0; velocity.vy = 0; }
                else { transform.vx = 0; transform.vy = 0; }
                state.path = null;
                state.abstractPath = null;
                return true;
            }

            if (state.pathIndex < state.path.length) {
                const wp = state.path[state.pathIndex];
                const dx = wp.x - transform.x;
                const dy = wp.y - transform.y;

                if (dx * dx + dy * dy < 144) {
                    state.pathIndex++;
                    
                    if (state.pathIndex >= state.path.length && state.abstractPath) {
                        if (state.abstractIndex < state.abstractPath.length - 1) {
                            state.abstractIndex++;
                            const [nextX, nextY] = state.abstractPath[state.abstractIndex].split(',').map(Number);
                            const nextPath = AStarSearch.findPath(transform.x, transform.y, nextX, nextY, engine, 10, false, this.pf);
                            if (nextPath === null) return false;

                            state.path = nextPath;
                            state.pathIndex = 0;
                        } else {
                            const finalPath = AStarSearch.findPath(transform.x, transform.y, targetPos.x, targetPos.y, engine, 10, false, this.pf);
                            if (finalPath === null) return false;

                            state.path = finalPath;
                            state.pathIndex = 0;
                            state.abstractPath = null;
                        }
                    }
                }

                if (state.path && state.pathIndex < state.path.length) {
                    const targetWp = state.path[state.pathIndex];
                    const nx = targetWp.x - transform.x;
                    const ny = targetWp.y - transform.y;
                    const d = Math.hypot(nx, ny);
                    if (d > 0.1) {
                        if (velocity) {
                            velocity.vx = (nx / d) * speed;
                            velocity.vy = (ny / d) * speed;
                        } else {
                            transform.vx = (nx / d) * speed;
                            transform.vy = (ny / d) * speed;
                        }
                    }
                    return false;
                }
            }
        }
        return false;
    }
}
