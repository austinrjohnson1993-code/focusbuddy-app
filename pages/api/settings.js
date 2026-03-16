import { createClient } from '@supabase/supabase-js'

const ALLOWED_FIELDS = ['full_name', 'accent_color', 'persona_blend', 'persona_voice', 'checkin_times']

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Parse all cookies from the Cookie header into a key→value map
function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=')
      return [k.trim(), v.join('=')]
    }).filter(([k]) => k)
  )
}

// Try to extract a Supabase access_token from cookies
// Supabase v2 stores auth as sb-<ref>-auth-token = JSON { access_token, ... }
function extractTokenFromCookies(cookieHeader) {
  if (!cookieHeader) return null
  const cookies = parseCookies(cookieHeader)
  const sessionKey = Object.keys(cookies).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  if (!sessionKey) return null
  try {
    const decoded = decodeURIComponent(cookies[sessionKey])
    const parsed = JSON.parse(decoded)
    // handle both direct object and array-wrapped formats
    const session = Array.isArray(parsed) ? parsed[0] : parsed
    return session?.access_token ?? null
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (!['POST', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })

  console.log('[settings] received:', req.method, JSON.stringify(req.body))

  // Extract token from Authorization header first, fall back to cookie
  let token = req.headers.authorization?.replace('Bearer ', '').trim() || null
  if (!token) {
    token = extractTokenFromCookies(req.headers.cookie)
    if (token) console.log('[settings] auth: token extracted from cookie')
  }

  if (!token) {
    console.error('[settings] no token in Authorization header or cookies')
    return res.status(401).json({ error: 'No auth token provided' })
  }

  // Use service role client to verify the token — more reliable than anon client
  const supabaseAdmin = getAdminClient()
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    console.error('[settings] auth.getUser failed:', JSON.stringify(authError))
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Build update object from only allowed fields present in req.body
  const updateObject = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in req.body) updateObject[key] = req.body[key]
  }

  if (Object.keys(updateObject).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updateObject)
    .eq('id', user.id)

  if (error) {
    console.error('[settings] update failed:', JSON.stringify(error))
    return res.status(500).json({ error: 'Failed to update profile' })
  }

  console.log('[settings] updated profile for', user.id, '— fields:', Object.keys(updateObject).join(', '))
  return res.status(200).json({ success: true, updated: updateObject })
}
