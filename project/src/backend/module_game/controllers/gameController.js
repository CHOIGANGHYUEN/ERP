import GameState from '../models/gameState.js'

export const saveWorld = async (req, res) => {
  try {
    const { worldName, population, worldData } = req.body
    const userId = req.user ? req.user.userId : 'anonymous'

    const newWorld = await GameState.create({
      worldName,
      population,
      worldData,
      createdBy: userId,
    })

    res.status(201).json({ success: true, message: 'World saved successfully', data: newWorld })
  } catch (error) {
    console.error('Save World Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export const loadWorlds = async (req, res) => {
  try {
    const worlds = await GameState.findAll({
      order: [['createdAt', 'DESC']],
    })
    res.status(200).json({ success: true, data: worlds })
  } catch (error) {
    console.error('Load Worlds Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}
