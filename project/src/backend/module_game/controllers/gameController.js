import GameState from '../models/gameState.js'

let mockWorlds = []
let nextId = 1

export const saveWorld = async (req, res) => {
  try {
    const { worldName, population, worldData } = req.body
    const userId = req.user ? req.user.userId : 'anonymous'

    // DB에 연결하여 실제 저장
    await GameState.create({
      worldName,
      population,
      worldData,
      createdBy: userId,
    })

    // 하지만 읽을 때는 목업 데이터를 사용하기 위해 배열에도 저장
    const newWorld = {
      id: nextId++,
      worldName,
      population,
      worldData,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    }
    mockWorlds.push(newWorld)

    res.status(201).json({ success: true, message: 'World saved successfully', data: newWorld })
  } catch (error) {
    console.error('Save World Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export const loadWorlds = async (req, res) => {
  try {
    // DB의 데이터를 가져오지 않고, 요구사항에 맞춰 목업 데이터를 반환
    const worlds = [...mockWorlds].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    res.status(200).json({ success: true, data: worlds })
  } catch (error) {
    console.error('Load Worlds Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}
