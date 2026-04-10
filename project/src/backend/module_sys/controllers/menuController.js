import menuService from '../services/menuService.js'

const menuController = {
  async getUserMenus(req, res) {
    try {
      const userId = req.user.userId
      const menus = await menuService.getUserMenus(userId)
      res.json(menus)
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch menus', error: error.message })
    }
  },

  async getAllMenus(req, res) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query
      const menus = await menuService.getAllMenus(page, limit, search)
      res.json(menus)
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch menus', error: error.message })
    }
  },

  async getMenuById(req, res) {
    try {
      const { id } = req.params
      const menu = await menuService.getMenuById(id)
      res.json(menu)
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch menu', error: error.message })
    }
  },

  async createMenu(req, res) {
    try {
      const userId = req.user.userId
      const menu = await menuService.createMenu(req.body, userId)
      res.status(201).json(menu)
    } catch (error) {
      res.status(500).json({ message: 'Failed to create menu', error: error.message })
    }
  },

  async updateMenu(req, res) {
    try {
      const { id } = req.params
      const userId = req.user.userId
      const menu = await menuService.updateMenu(id, req.body, userId)
      res.json(menu)
    } catch (error) {
      res.status(500).json({ message: 'Failed to update menu', error: error.message })
    }
  },

  async deleteMenu(req, res) {
    try {
      const { id } = req.params
      const result = await menuService.deleteMenu(id)
      res.json(result)
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete menu', error: error.message })
    }
  },
}

export default menuController
