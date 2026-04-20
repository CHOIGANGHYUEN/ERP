import { GROWING } from './plant/Growing.js'

const safePlant =
  (fn) =>
  (plant, ...args) => {
    try {
      return fn(plant, ...args)
    } catch (error) {
      console.error(`[Plant Action Error] ID ${plant?.id}:`, error)
    }
  }

export const PlantActions = {
  GROWING: { execute: safePlant(GROWING) },
}
