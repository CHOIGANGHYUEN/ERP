import codeService from '../services/codeService.js'

const codeController = {
  async getCodeHeads(req, res) {
    try {
      const result = await codeService.getCodeHeads(req.query)
      res.json(result)
    } catch (error) {
      console.error('Error in getCodeHeads:', error)
      res.status(500).json({ message: 'Failed to fetch code heads', error: error.message })
    }
  },

  async getCodeHeadDetail(req, res) {
    try {
      const { categoryCode, groupCode } = req.params
      const result = await codeService.getCodeHeadDetail(categoryCode, groupCode)
      res.json(result)
    } catch (error) {
      console.error('Error in getCodeHeadDetail:', error)
      res.status(500).json({ message: 'Failed to fetch code detail', error: error.message })
    }
  },

  async saveCodeGroup(req, res) {
    try {
      const user = req.user ? req.user.id : 'system'
      const result = await codeService.saveCodeGroup(req.body, user)
      res.json(result)
    } catch (error) {
      console.error('Error in saveCodeGroup:', error)
      res.status(500).json({ message: 'Failed to save code group', error: error.message })
    }
  },

  async deleteCodeGroup(req, res) {
    try {
      const { categoryCode, groupCode } = req.params
      const result = await codeService.deleteCodeGroup(categoryCode, groupCode)
      res.json(result)
    } catch (error) {
      console.error('Error in deleteCodeGroup:', error)
      res.status(500).json({ message: 'Failed to delete code group', error: error.message })
    }
  }
}

export default codeController