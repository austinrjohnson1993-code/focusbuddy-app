// To generate VAPID keys run:
//   npx web-push generate-vapid-keys
// Then add to .env.local and Vercel env vars:
//   NEXT_PUBLIC_VAPID_KEY=...   (public key, exposed to browser)
//   VAPID_PRIVATE_KEY=...       (private key, server only)

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
  'mailto:hello@focusbuddy.app',
  process.env.NEXT_PUBLIC_VAPID_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, title, body, url = '/dashboard' } = req.body;
  if (!userId || !title || !body) {
    return res.status(400).json({ error: 'userId, title, and body are required' });
  }

  const supabaseAdmin = getAdminClient();
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles').select('push_subscription').eq('id', userId).single();

  if (profileErr || !profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  if (!profile.push_subscription) {
    return res.status(400).json({ error: 'No push subscription for this user' });
  }

  try {
    await webpush.sendNotification(
      profile.push_subscription,
      JSON.stringify({ title, body, url })
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[push-notification] send error:', err.message);
    // 410 Gone = subscription expired, clean it up
    if (err.statusCode === 410) {
      await supabaseAdmin.from('profiles').update({ push_subscription: null }).eq('id', userId);
      return res.status(410).json({ error: 'Subscription expired and removed' });
    }
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
