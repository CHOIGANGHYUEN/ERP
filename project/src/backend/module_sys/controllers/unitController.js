import unitService from '../services/unitService.js'

export default {
  async getList(req, res) {
    try {
      res.json(await unitService.getList(req.query))
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },
  async getDetail(req, res) {
    try {
      res.json(await unitService.getDetail(req.params.id))
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },
  async save(req, res) {
    try {
      const user = req.user?.userId || 'system'
      res.json(await unitService.save(req.body, user))
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },
  async remove(req, res) {
    try {
      res.json(await unitService.remove(req.params.id))
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },
}
