import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { requireAuth } from '../middleware/auth'

const router = Router()

// GET /api/listings - Public listing feed (requires login - validated via token)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { category, condition, sort, search, free } = req.query
    let query = supabaseAdmin.from('listings').select('*').eq('status', 'active')

    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    if (category) query = query.eq('category', category as string)
    if (condition) query = query.eq('condition', condition as string)
    if (free === 'true') query = query.eq('price', 0)

    if (sort === 'price_low') query = query.order('price', { ascending: true })
    else if (sort === 'price_high') query = query.order('price', { ascending: false })
    else query = query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/listings/:id - Single listing detail
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error || !listing) return res.status(404).json({ error: 'Listing not found' })

    // Increment view count
    await supabaseAdmin.from('listings').update({ view_count: (listing.view_count || 0) + 1 }).eq('id', req.params.id)

    // Fetch seller trust score without exposing identity
    const { data: seller } = await supabaseAdmin
      .from('users')
      .select('trust_score')
      .eq('id', listing.seller_id)
      .single()

    res.json({ ...listing, seller_trust_score: seller?.trust_score || 5.0 })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/listings - Create a new listing (auth required)
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    const { title, category, condition, price, description, images } = req.body

    if (!title || !category || !condition || price === undefined || !description) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    const { data, error } = await supabaseAdmin
      .from('listings')
      .insert({ seller_id: user.id, title, category, condition, price: Number(price), description, images: images || [] })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/listings/:id/status - Update listing status
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    const { status } = req.body

    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('seller_id')
      .eq('id', req.params.id)
      .single()

    if (!listing || listing.seller_id !== user.id) {
      return res.status(403).json({ error: 'You can only update your own listings' })
    }

    const { data, error } = await supabaseAdmin
      .from('listings')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
