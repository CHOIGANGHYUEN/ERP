import configService from '../services/configService.js'

const configController = {
  async getAllConfigs(req, res) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query
      const configs = await configService.getAllConfigs(page, limit, search)
      res.json(configs)
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch configs', error: error.message })
    }
  },

  async getConfigById(req, res) {
    try {
      const { id } = req.params
      const config = await configService.getConfigById(id)
      res.json(config)
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch config', error: error.message })
    }
  },

  async createConfig(req, res) {
    try {
      const userId = req.user?.userId || 'system'
      const config = await configService.createConfig(req.body, userId)
      res.status(201).json(config)
    } catch (error) {
      res.status(500).json({ message: 'Failed to create config', error: error.message })
    }
  },

  async updateConfig(req, res) {
    try {
      const { id } = req.params
      const userId = req.user?.userId || 'system'
      const config = await configService.updateConfig(id, req.body, userId)
      res.json(config)
    } catch (error) {
      res.status(500).json({ message: 'Failed to update config', error: error.message })
    }
  },

  async deleteConfig(req, res) {
    try {
      const { id } = req.params
      const result = await configService.deleteConfig(id)
      res.json(result)
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete config', error: error.message })
    }
  },
}

export default configController
