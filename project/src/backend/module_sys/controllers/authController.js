import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import userService from '../services/userService.js'
import process from 'node:process'

// process.env.VITE_GOOGLE_CLIENT_ID will be loaded via dotenv in server.js
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret_key_123'

const authController = {
  async googleLogin(req, res) {
    try {
      const { credential } = req.body
      if (!credential) {
        return res.status(400).json({ message: 'Missing credential.' })
      }

      const client = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID)

      // 1. Verify Google Token
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.VITE_GOOGLE_CLIENT_ID,
      })
      const payload = ticket.getPayload()
      const { sub: googleId, email, name, picture } = payload

      // 2. Find or Create User
      const user = await userService.findOrCreateUser({ googleId, email, name, picture })

      // 3. Generate JWT
      const expiresIn = process.env.JWT_EXPIRES_IN || '12h'
      const maxAge = process.env.JWT_COOKIE_MAX_AGE
        ? parseInt(process.env.JWT_COOKIE_MAX_AGE, 10)
        : 12 * 60 * 60 * 1000 // default 12 hours

      const token = jwt.sign({ id: user.id, userId: user.userId, email: email }, JWT_SECRET, {
        expiresIn,
      })

      // 4. Set Cookie and Respond
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge,
      })

      console.log(`User ${user.userId} logged in successfully via Google OAuth.`)
      res.json({
        message: 'Login successful',
        user: { userId: user.userId, email, name, picture },
        token,
      })
    } catch (error) {
      console.error('Google login error: ' + error.message)
      res.status(401).json({ message: 'Authentication failed', error: error.message })
    }
  },

  async logout(req, res) {
    res.clearCookie('token')
    res.json({ message: 'Logged out successfully' })
  },
}

export default authController
