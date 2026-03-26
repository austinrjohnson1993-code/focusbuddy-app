import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=')
      return [k.trim(), v.join('=')]
    }).filter(([k]) => k)
  )
}

function extractTokenFromCookies(cookieHeader) {
  if (!cookieHeader) return null
  const cookies = parseCookies(cookieHeader)
  const sessionKey = Object.keys(cookies).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  if (!sessionKey) return null
  try {
    const decoded = decodeURIComponent(cookies[sessionKey])
    const parsed = JSON.parse(decoded)
    const session = Array.isArray(parsed) ? parsed[0] : parsed
    return session?.access_token ?? null
  } catch {
    return null
  }
}

function withAuth(handler) {
  return async (req, res) => {
    let token = req.headers.authorization?.replace('Bearer ', '').trim() || null
    if (!token) {
      token = extractTokenFromCookies(req.headers.cookie)
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const supabaseAdmin = getAdminClient()
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    return handler(req, res, user.id)
  }
}

export { withAuth as withAuthGuard }
export default withAuth
