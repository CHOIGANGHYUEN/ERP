import userService from '../services/userService.js'

const userController = {
  async getUsers(req, res) {
    try {
      const result = await userService.getUsers(req.query)
      res.json(result)
    } catch (error) {
      console.error('Error in getUsers:', error)
      res.status(500).json({ message: 'Failed to fetch users', error: error.message })
    }
  },

  async getUserDetail(req, res) {
    try {
      const { id } = req.params
      const result = await userService.getUserDetail(id)
      res.json(result)
    } catch (error) {
      console.error('Error in getUserDetail:', error)
      res.status(500).json({ message: 'Failed to fetch user detail', error: error.message })
    }
  },

  async saveUser(req, res) {
    try {
      const actor = req.user ? req.user.id : 'system'
      const result = await userService.saveUser(req.body, actor)
      res.json(result)
    } catch (error) {
      console.error('Error in saveUser:', error)
      res.status(500).json({ message: 'Failed to save user', error: error.message })
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.params
      const result = await userService.deleteUser(id)
      res.json(result)
    } catch (error) {
      console.error('Error in deleteUser:', error)
      res.status(500).json({ message: 'Failed to delete user', error: error.message })
    }
  }
}

export default userController