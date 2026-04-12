import plantService from '../services/plantService.js'

export default {
  async getList(req, res) {
    try {
      res.json(await plantService.getList(req.query))
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },
  async getDetail(req, res) {
    try {
      res.json(await plantService.getDetail(req.params.id))
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },
  async save(req, res) {
    try {
      const user = req.user?.userId || 'system'
      res.json(await plantService.save(req.body, user))
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },
  async remove(req, res) {
    try {
      res.json(await plantService.remove(req.params.id))
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },
}
