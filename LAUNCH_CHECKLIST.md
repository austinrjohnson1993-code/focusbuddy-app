# Cinis — Launch Checklist
*Created: S26 · March 25, 2026 · Launch target: April 14, 2026*
*Every item must be checked before going live. No exceptions.*

## BLOCKING — Cannot launch without these

### Legal & Financial
- [ ] LLC filed — Texas Secretary of State
- [ ] Stripe live mode activated (unlocks after LLC)
- [ ] Stripe live keys swapped into Vercel env vars (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET)
- [ ] Stripe live webhook registered at https://cinis.app/api/stripe/webhook
- [ ] Stripe Pro flip tested end-to-end with real card (payment → webhook → subscription_status = 'pro')

### Email
- [ ] Resend sender domain verified (cinis.app)
- [ ] Signup confirmation email sending + landing in inbox (not spam)
- [ ] Password reset email sending + link works end-to-end

### App — Must Work
- [ ] Signup — email/password — end to end
- [ ] Signup — Google OAuth — end to end
- [ ] Onboarding — all 13 questions + baseline profile generates
- [ ] Dashboard loads after onboarding
- [ ] Check-in AI responds (rate limit: free 5/day, pro 15/day)
- [ ] Task add / complete / star / delete all work
- [ ] Voice FAB — tap, speak, task created
- [ ] Finance Bills tab loads + add bill works
- [ ] Progress tab loads without errors
- [ ] Settings — persona edit saves + affects next AI response
- [ ] Log out → /login · Log in → /dashboard
- [ ] Forgot password flow works end-to-end

### Visual — Must Match Mockup
- [ ] All 11 tabs QC confirmed by Solver 3
- [ ] Zero FocusBuddy references in app or landing page
- [ ] Brand colors correct across all tabs
- [ ] Rounded Cinis mark everywhere (not sharp-polygon)

## IMPORTANT — Should have at launch
- [ ] VAPID_KEY + VAPID_PUBLIC_KEY duplicates removed from Vercel
- [ ] getcinis.com fully rebranded
- [ ] OG meta image updated on cinis.app
- [ ] Favicon is rounded Cinis mark
- [ ] Push notification toggle in Settings wired end-to-end
- [ ] 5–10 beta testers identified and onboarded
- [ ] At least 1 real Pro subscriber confirmed

## Ryan Personal Actions
- [ ] File LLC — CRITICAL
- [ ] Remove LinkedIn "Open to work" badge
- [ ] Identify 5–10 beta testers by name
- [ ] Update Resend sender to cinis.app
- [ ] Re-upload rounded mark to Instagram, X, Reddit, LinkedIn, Google OAuth, Stripe

## POST-LAUNCH — Do not block on these
- A2P 10DLC (Twilio) · SMS check-ins (V1.3) · Google Calendar sync
- Tag Team full build (V1.4) · Nutrition full build (V1.2)
- Finance full build (V1.2) · React Native (V2.0) · DMARC record

## Revenue Gate
628 Pro subscribers = $8,792/month = break-even

*Core reviews at every session close.*
