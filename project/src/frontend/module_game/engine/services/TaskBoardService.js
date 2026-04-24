export class TaskBoardService {
  constructor() {
    this.tasks = new Map() // villageId -> Array of tasks
  }

  /**
   * 새로운 작업 게시
   * @param {string|number} villageId 
   * @param {object} task { id, type, targetId, priority, position }
   */
  publishTask(villageId, task) {
    if (!this.tasks.has(villageId)) {
      this.tasks.set(villageId, [])
    }
    
    // 중복 작업 체크
    const list = this.tasks.get(villageId)
    if (list.some(t => t.id === task.id || (t.targetId && t.targetId === task.targetId))) {
      return false
    }

    list.push({
      ...task,
      createdAt: Date.now(),
      status: 'AVAILABLE'
    })
    
    // 우선순위 정렬
    list.sort((a, b) => (b.priority || 0) - (a.priority || 0))
    return true
  }

  /**
   * 마을의 모든 가용 작업 조회
   * @param {string|number} villageId 
   */
  getAvailableTasks(villageId) {
    const list = this.tasks.get(villageId) || []
    return list.filter(t => t.status === 'AVAILABLE')
  }

  /**
   * 작업 수주 (Claim)
   * @param {string|number} villageId 
   * @param {string|number} taskId 
   * @param {string|number} workerId 
   */
  claimTask(villageId, taskId, workerId) {
    const list = this.tasks.get(villageId)
    if (!list) return null

    const task = list.find(t => t.id === taskId)
    if (task && task.status === 'AVAILABLE') {
      task.status = 'CLAIMED'
      task.workerId = workerId
      return task
    }
    return null
  }

  /**
   * 작업 취소 또는 실패 처리 (다시 게시판으로 복귀)
   */
  releaseTask(villageId, taskId) {
    const list = this.tasks.get(villageId)
    if (!list) return

    const task = list.find(t => t.id === taskId)
    if (task) {
      task.status = 'AVAILABLE'
      delete task.workerId
    }
  }

  /**
   * 작업 완료 및 제거
   */
  completeTask(villageId, taskId) {
    const list = this.tasks.get(villageId)
    if (!list) return

    const idx = list.findIndex(t => t.id === taskId)
    if (idx !== -1) {
      list.splice(idx, 1)
    }
  }
}
