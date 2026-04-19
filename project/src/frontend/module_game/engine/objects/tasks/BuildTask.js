import { BaseTask } from './BaseTask.js'

export class BuildTask extends BaseTask {
  constructor(targetBuilding) {
    super('BUILD')
    this.target = targetBuilding
  }

  execute(creature, deltaTime, world) {
    this.status = 'RUNNING'

    if (!this.target || this.target.isConstructed) {
      this.status = 'COMPLETED'
      return this.status
    }

    const dist = creature.distanceTo(this.target)
    if (dist <= creature.size + (this.target.size || 0)) {
      creature.state = 'BUILDING'
      
      // 💡 핵심 수정: 1틱당 1회 연산만 수행하도록 제어. 
      // 자원이 필요한 경우 여기서 체크 로직을 넣을 수 있음.
      // 현재는 시간 기반 진행도를 적용하되, 루프 없이 if로만 처리.
      this.target.progress += deltaTime * 0.05
      
      if (this.target.progress >= (this.target.maxProgress || 100)) {
        this.target.isConstructed = true
        this.status = 'COMPLETED'
      }
    } else {
      // 거리가 멀면 이동만 처리하고 이번 틱 종료
      creature.moveToTarget(this.target.x, this.target.y, deltaTime, world)
      this.status = 'RUNNING'
    }

    return this.status
  }
}
