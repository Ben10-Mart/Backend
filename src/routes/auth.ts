import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase'

const router = Router()

// POST /api/auth/register - Register with Bennett email + send OTP
router.post('/register', async (req, res) => {
  try {
    const { email, fullName, phone } = req.body

    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and full name are required' })
    }

    // Strict Bennett University domain check
    if (!email.endsWith('@bennett.edu.in')) {
      return res.status(400).json({ error: 'Only @bennett.edu.in email addresses are allowed' })
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists. Please login instead.' })
    }

    // Store registration intent temporarily in metadata
    const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: {
        data: { full_name: fullName, phone }
      }
    })

    if (otpError) {
      return res.status(500).json({ error: otpError.message })
    }

    res.json({ message: 'OTP sent to your Bennett email. Please check your inbox.' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/verify - Verify OTP and create user profile
router.post('/verify', async (req, res) => {
  try {
    const { email, token, fullName, phone } = req.body

    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      email,
      token,
      type: 'email'
    })

    if (error || !data.user) {
      return res.status(400).json({ error: error?.message || 'Invalid OTP' })
    }

    // Create user profile if not exists
    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', data.user.id)
      .single()

    if (!existingProfile) {
      await supabaseAdmin.from('users').insert({
        id: data.user.id,
        email,
        full_name: fullName || data.user.user_metadata?.full_name || 'Bennett Student',
        phone: phone || null,
      })
    }

    res.json({
      message: 'Verified successfully',
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/login - Send OTP to existing user
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body

    if (!email?.endsWith('@bennett.edu.in')) {
      return res.status(400).json({ error: 'Only @bennett.edu.in emails are allowed' })
    }

    const { error } = await supabaseAdmin.auth.signInWithOtp({ email })
    if (error) return res.status(500).json({ error: error.message })

    res.json({ message: 'OTP sent to your email' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
