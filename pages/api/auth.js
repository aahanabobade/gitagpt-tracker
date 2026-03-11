import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

// Server-side supabase client (uses service role key to bypass RLS for auth)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // ← add this in Vercel env vars
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action, username, password, color } = req.body

  if (!username?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Username and password required' })
  }

  // ── REGISTER ──────────────────────────────────────────────────────────────
  if (action === 'register') {
    // Check username taken
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.trim())
      .single()

    if (existing) return res.status(409).json({ error: 'Username already taken' })

    const hash = await bcrypt.hash(password, 10)

    const { data: user, error } = await supabase
      .from('users')
      .insert({ username: username.trim(), password: hash, color: color || '#c9a84c' })
      .select('id, username, color')
      .single()

    if (error) return res.status(500).json({ error: 'Could not create account' })

    // Also upsert into members table for real-time display
    await supabase
      .from('members')
      .upsert({ name: user.username, color: user.color }, { onConflict: 'name' })

    return res.status(200).json({ user: { id: user.id, username: user.username, color: user.color } })
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (action === 'login') {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password, color')
      .eq('username', username.trim())
      .single()

    if (!user || error) return res.status(401).json({ error: 'Invalid username or password' })

    const match = await bcrypt.compare(password, user.password)
    if (!match)   return res.status(401).json({ error: 'Invalid username or password' })

    // Sync color to members table on login
    await supabase
      .from('members')
      .upsert({ name: user.username, color: user.color }, { onConflict: 'name' })

    return res.status(200).json({ user: { id: user.id, username: user.username, color: user.color } })
  }

  // ── UPDATE COLOR ──────────────────────────────────────────────────────────
  if (action === 'update_color') {
    const { userId } = req.body
    await supabase.from('users').update({ color }).eq('id', userId)
    await supabase.from('members').update({ color }).eq('name', username.trim())
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: 'Unknown action' })
}