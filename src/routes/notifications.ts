import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { requireAuth } from '../middleware/auth'

const router = Router()

// GET /api/notifications - Get user notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/notifications/:id/read - Mark single notification as read
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', user.id)
    res.json({ message: 'Marked as read' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    res.json({ message: 'All notifications marked as read' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
