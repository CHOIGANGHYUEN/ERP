import { BaseTask } from './BaseTask.js'

export class MoveTask extends BaseTask {
  /**
   * @param {Object} target 이동할 목표 엔티티 (x, y와 size를 가짐)
   * @param {Number} threshold 도달했다고 판단할 거리
   */
  constructor(target, threshold = 10) {
    super('MOVE')
    this.target = target
    this.threshold = threshold
  }

  execute(creature, deltaTime, world) {
    this.status = 'RUNNING'
    creature.state = 'WANDERING' // 이동 중일 때의 렌더링 상태 지정

    // 💡 [프리징 원천 차단 2] 목표가 좌표를 상실(undefined)했을 때 연산이 NaN으로 오염되는 것(NaN Poisoning)을 방지
    if (
      !this.target ||
      this.target.isDead ||
      this.target.x === undefined ||
      this.target.y === undefined
    ) {
      this.status = 'FAILED'
      return this.status
    }

    const dist = creature.distanceTo({ x: this.target.x, y: this.target.y })
    if (dist <= this.threshold + (this.target.size || 0)) {
      this.status = 'COMPLETED'
    } else {
      creature.moveToTarget(this.target.x, this.target.y, deltaTime, world)
    }

    return this.status
  }
}
