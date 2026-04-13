export class PlantEmotion {
  static init(plant) {
    plant.needs = { moisture: 0 }
    plant.emotions = { vitality: 100 }
  }

  static update(plant, deltaTime, world) {
    if (world.weather.weatherType === 'rain') {
      plant.needs.moisture = 0
      plant.emotions.vitality = Math.min(100, plant.emotions.vitality + deltaTime * 0.05)
    } else plant.needs.moisture = Math.min(100, plant.needs.moisture + deltaTime * 0.001)

    if (plant.needs.moisture >= 80) plant.emotions.vitality -= deltaTime * 0.01
  }
}
