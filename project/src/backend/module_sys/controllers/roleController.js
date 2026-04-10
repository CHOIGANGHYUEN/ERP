import roleService from '../services/roleService.js'

const roleController = {
  async getAllRoles(req, res) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query
      const roles = await roleService.getAllRoles(page, limit, search)
      res.json(roles)
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch roles', error: error.message })
    }
  },

  async getRoleById(req, res) {
    try {
      const { id } = req.params
      const role = await roleService.getRoleById(id)
      res.json(role)
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch role', error: error.message })
    }
  },

  async createRole(req, res) {
    try {
      const userId = req.user?.userId || 'system'
      const role = await roleService.createRole(req.body, userId)
      res.status(201).json(role)
    } catch (error) {
      res.status(500).json({ message: 'Failed to create role', error: error.message })
    }
  },

  async updateRole(req, res) {
    try {
      const { id } = req.params
      const userId = req.user?.userId || 'system'
      const role = await roleService.updateRole(id, req.body, userId)
      res.json(role)
    } catch (error) {
      res.status(500).json({ message: 'Failed to update role', error: error.message })
    }
  },

  async deleteRole(req, res) {
    try {
      const { id } = req.params
      const result = await roleService.deleteRole(id)
      res.json(result)
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete role', error: error.message })
    }
  },

  async getRoleMenus(req, res) {
    try {
      const menus = await roleService.getRoleMenus(req.params.id)
      res.json(menus)
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch role menus', error: error.message })
    }
  },

  async updateRoleMenus(req, res) {
    try {
      const userId = req.user?.userId || 'system'
      const result = await roleService.updateRoleMenus(req.params.id, req.body.menuIds, userId)
      res.json(result)
    } catch (error) {
      res.status(500).json({ message: 'Failed to update role menus', error: error.message })
    }
  },

  async getRoleUsers(req, res) {
    try {
      const users = await roleService.getRoleUsers(req.params.id)
      res.json(users)
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch role users', error: error.message })
    }
  },

  async updateRoleUsers(req, res) {
    try {
      const userId = req.user?.userId || 'system'
      const result = await roleService.updateRoleUsers(req.params.id, req.body.userIds, userId)
      res.json(result)
    } catch (error) {
      res.status(500).json({ message: 'Failed to update role users', error: error.message })
    }
  },
}

export default roleController
