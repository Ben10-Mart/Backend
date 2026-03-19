import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { requireAuth } from '../middleware/auth'

const router = Router()

// POST /api/chat/init - Create a new chat room between buyer and seller
router.post('/init', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    const { listing_id, seller_id } = req.body

    if (!listing_id || !seller_id) {
      return res.status(400).json({ error: 'listing_id and seller_id are required' })
    }

    if (user.id === seller_id) {
      return res.status(400).json({ error: 'You cannot chat with yourself' })
    }

    // Check for existing room
    const { data: existingRoom } = await supabaseAdmin
      .from('chat_rooms')
      .select('id')
      .eq('listing_id', listing_id)
      .eq('buyer_id', user.id)
      .single()

    if (existingRoom) {
      return res.json({ room_id: existingRoom.id, existing: true })
    }

    // Create new room
    const { data: newRoom, error } = await supabaseAdmin
      .from('chat_rooms')
      .insert({ listing_id, buyer_id: user.id, seller_id })
      .select()
      .single()

    if (error) throw error

    // Notify seller
    await supabaseAdmin.from('notifications').insert({
      user_id: seller_id,
      type: 'CHAT_REQUEST',
      message: 'Someone is interested in your item! Tap to chat.',
      link: `/listing/${listing_id}/chat`
    })

    res.json({ room_id: newRoom.id, existing: false })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/chat/rooms - Get all chat rooms for the logged-in user
router.get('/rooms', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    const { data, error } = await supabaseAdmin
      .from('chat_rooms')
      .select('*, listings(title, price, images)')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/chat/:room_id/messages
router.get('/:room_id/messages', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    const { room_id } = req.params

    // Verify user is part of this room
    const { data: room } = await supabaseAdmin
      .from('chat_rooms')
      .select('buyer_id, seller_id')
      .eq('id', room_id)
      .single()

    if (!room || (room.buyer_id !== user.id && room.seller_id !== user.id)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('room_id', room_id)
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/chat/:room_id/messages - Send a message
router.post('/:room_id/messages', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    const { room_id } = req.params
    const { content } = req.body

    if (!content?.trim()) return res.status(400).json({ error: 'Message cannot be empty' })

    const { data: room } = await supabaseAdmin
      .from('chat_rooms')
      .select('buyer_id, seller_id, status')
      .eq('id', room_id)
      .single()

    if (!room || (room.buyer_id !== user.id && room.seller_id !== user.id)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (room.status === 'deal_done') {
      return res.status(400).json({ error: 'This chat is closed — the deal is already done.' })
    }

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({ room_id, sender_id: user.id, content: content.trim() })
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/chat/:room_id/deal-done - Mark deal as done
router.patch('/:room_id/deal-done', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    const { room_id } = req.params

    const { data: room } = await supabaseAdmin
      .from('chat_rooms')
      .select('buyer_id, seller_id, listing_id')
      .eq('id', room_id)
      .single()

    if (!room || (room.buyer_id !== user.id && room.seller_id !== user.id)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await supabaseAdmin.from('chat_rooms').update({ status: 'deal_done' }).eq('id', room_id)
    await supabaseAdmin.from('listings').update({ status: 'sold' }).eq('id', room.listing_id)

    res.json({ message: 'Deal marked as done' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
