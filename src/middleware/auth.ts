import { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabase'

// Middleware: Verify Supabase JWT and attach user to request
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' })
  }

  const token = authHeader.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' })
  }

  ;(req as any).user = data.user
  next()
}

// Middleware: Verify the user is an admin
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: profile } = await supabaseAdmin.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) {
    return res.status(403).json({ error: 'Forbidden: Admins only' })
  }
  next()
}
