import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const FROM_ADDRESS = 'Cinis <noreply@getcinis.app>'

const CONFIRMATION_HTML = `
<div style="background:#211A14;color:#F5F0E3;padding:32px;font-family:sans-serif;border-radius:12px;max-width:480px">
  <div style="font-size:24px;font-weight:700;margin-bottom:8px">You're in.</div>
  <div style="font-size:14px;color:#F5F0E390;margin-bottom:24px">We launch April 14. You'll get another email that morning.</div>
  <div style="font-size:13px;color:#F5F0E360">Cinis · Where start meets finished.</div>
</div>
`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, phone } = req.body

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const cleanPhone = phone ? String(phone).trim().slice(0, 20) : null

  const supabaseAdmin = getAdminClient()

  const { error: insertErr } = await supabaseAdmin
    .from('waitlist')
    .insert({ email: cleanEmail, phone: cleanPhone })

  if (insertErr) {
    // Unique violation — email already on waitlist
    if (insertErr.code === '23505') {
      return res.status(200).json({ success: true, duplicate: true })
    }
    console.error('[waitlist] insert error:', insertErr.message)
    return res.status(500).json({ error: 'Failed to save signup' })
  }


  // Send confirmation email — non-blocking, don't fail signup on email error
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      cleanEmail,
      subject: "You're on the Cinis waitlist 🔥",
      html:    CONFIRMATION_HTML,
    })
  } catch (emailErr) {
    console.error('[waitlist] resend error:', emailErr.message)
  }

  return res.status(200).json({ success: true })
}
