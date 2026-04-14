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
    if (!this.diplomacy.has(otherNation)) {
      this.diplomacy.set(otherNation, { status: 'NEUTRAL', score: 0 })
    }
    return this.diplomacy.get(otherNation)
  }

  setRelation(otherNation, status, score) {
    const rel = this.getRelation(otherNation)
    rel.status = status
    rel.score = score
    otherNation.getRelation(this).status = status
    otherNation.getRelation(this).score = score
  }
}
