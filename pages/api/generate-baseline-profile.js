import { createClient } from '@supabase/supabase-js'
import { checkDailyRateLimit, rateLimitErrorResponse } from '../../lib/rateLimit'
import withAuth from '../../lib/authGuard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function handler(req, res, userId) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const rateCheck = await checkDailyRateLimit(userId)
  if (!rateCheck.allowed) {
    return res.status(429).json(rateLimitErrorResponse(rateCheck))
  }

  const supabaseAdmin = getAdminClient()

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('full_name, mental_health_context, persona_blend, persona_voice, checkin_times, ranked_priorities, main_struggle, diagnosis')
    .eq('id', userId)
    .single()

  if (profileErr || !profile) {
    return res.status(500).json({ error: 'Failed to fetch profile' })
  }

  const {
    full_name,
    mental_health_context,
    persona_blend,
    persona_voice,
    checkin_times,
    ranked_priorities,
    main_struggle,
    diagnosis
  } = profile

  const name = full_name || 'this user'
  const userPrompt = `Generate a coaching profile for ${name}. Mental health context: ${mental_health_context || 'not specified'}. Persona blend: ${Array.isArray(persona_blend) ? persona_blend.join(', ') : persona_blend || 'not specified'}. Voice preference: ${persona_voice || 'not specified'}. Check-in times: ${Array.isArray(checkin_times) ? checkin_times.join(', ') : checkin_times || 'not specified'}. Ranked priorities: ${Array.isArray(ranked_priorities) ? ranked_priorities.join(', ') : ranked_priorities || 'not specified'}. Main struggle: ${main_struggle || 'not specified'}. Diagnosis: ${diagnosis || 'not specified'}. Based on this, describe: who this person is, how they like to be coached, what their biggest friction points likely are, and what kind of support will move them most.`

  let generatedText = null
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: 'You are generating a private coaching profile for a Cinis AI coach. This profile will be injected into every future AI interaction to make coaching personal. Write in second person about the user. Be specific, warm, and actionable. 200 words maximum.',
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('[generate-baseline-profile] Claude API error:', errBody)
      return res.status(500).json({ error: 'Claude API call failed' })
    }

    const data = await response.json()
    generatedText = data?.content?.[0]?.text?.trim() ?? null
  } catch (err) {
    console.error('[generate-baseline-profile] fetch error:', err)
    return res.status(500).json({ error: 'Claude API call failed' })
  }

  if (!generatedText) {
    return res.status(500).json({ error: 'No profile text generated' })
  }

  const { error: updateErr } = await supabaseAdmin
    .from('profiles')
    .update({ baseline_profile: generatedText })
    .eq('id', userId)

  if (updateErr) {
    console.error('[generate-baseline-profile] update error:', JSON.stringify(updateErr))
    return res.status(500).json({ error: 'Failed to save baseline profile' })
  }


  return res.status(200).json({ success: true, profile: generatedText })
}

export default withAuth(handler)
