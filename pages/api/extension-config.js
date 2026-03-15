// Public config endpoint for the Chrome extension.
// Returns the Supabase project URL and anon key — both are safe to expose
// (they're already embedded in the client-side bundle).

const ALLOWED_ORIGINS = [
  'chrome-extension://',
  'https://focus-buddy.app',
  'http://localhost:3000',
]

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || ''
  const allowed = ALLOWED_ORIGINS.some((o) => origin.startsWith(o))
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  return res.status(200).json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
}
