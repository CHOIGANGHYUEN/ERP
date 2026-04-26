export class Nation {
  constructor(name, color) {
    this.id = Math.random().toString(36).substr(2, 9)
    this.name = name
    this.color = color
    this.villages = []
    this.inventory = {
      food: 0,
      wood: 0,
      stone: 0,
      iron: 0,
      gold: 0,
      knowledge: 0
    }
    this.diplomacy = {} // { nationId: { status: 'PEACE'|'WAR', score: 0 } }
    this.leaderId = -1
  }

  addVillage(village) {
    if (!this.villages.includes(village)) {
      this.villages.push(village)
      village.nation = this
    }
  }

  update(deltaTime, world) {
    this.updateTimer = (this.updateTimer || 0) + deltaTime
    if (this.updateTimer < 1000) return 
    this.updateTimer = 0

    const newInv = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0, knowledge: 0 }
    this.villages.forEach(v => {
      Object.keys(newInv).forEach(k => {
        newInv[k] += (v.inventory[k] || 0)
      })
    })
    this.inventory = newInv
  }
}
