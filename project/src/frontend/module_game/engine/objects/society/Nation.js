export class Nation {
  constructor(name, color) {
    this.name = name
    this.color = color
    this.villages = [] // List of Village instances
    // TODO 2. 외교 상태 (Diplomacy) 변수 추가 (국가 간 평화/적대 기록용)
    this.diplomacy = new Map()
  }

  addVillage(village) {
    this.villages.push(village)
    village.nation = this
  }
}
