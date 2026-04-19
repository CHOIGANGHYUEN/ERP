export class Nation {
  constructor(name, color) {
    this.id = Math.random().toString(36).substr(2, 9)
    this.name = name
    this.color = color
    this.villages = [] // List of Village instances
    this.diplomacy = new Map() // Map<Nation, { status: 'PEACE'|'WAR'|'NEUTRAL', score: number }>
  }

  addVillage(village) {
    this.villages.push(village)
    village.nation = this
  }

  getRelation(otherNation) {
    const nationId = typeof otherNation === 'string' ? otherNation : otherNation.id
    if (!this.diplomacy.has(nationId)) {
      this.diplomacy.set(nationId, { status: 'NEUTRAL', score: 0 })
    }
    return this.diplomacy.get(nationId)
  }

  setRelation(otherNation, status, score) {
    const rel = this.getRelation(otherNation)
    rel.status = status
    rel.score = score
    
    // 상대 국가에서도 동일하게 설정 (상호 관계)
    if (typeof otherNation !== 'string') {
      const otherRel = otherNation.getRelation(this.id)
      otherRel.status = status
      otherRel.score = score
    }
  }
}
