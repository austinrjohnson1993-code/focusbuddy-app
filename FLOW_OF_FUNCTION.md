# 20. LANDING PAGE (getcinis.app)

## 20.1 Overview
- **File:** pages/index.js (serves getcinis.app domain via vercel.json)
- **Components:** components/landing/* — LandingNav, LandingHero, LandingFeatureCard, LandingFeatureDemo, LandingPricing, LandingFooter, LandingBackground
- **Styles:** styles/Landing.module.css
- **Spec:** getcinis_landing_spec.md in Core project files

## 20.2 Waitlist Form (Email + Phone)
- **What happens:** User enters email + optional phone → taps "Get early access"
- **What moves:** POST to /api/waitlist — saves email + phone to waitlist table in Supabase
- **Two instances:** Hero section + Pricing section — both submit to same endpoint
- **Fields:** email (required), phone (optional)
- **Side effects:** None — no auth, no session, no redirect. Shows success state inline.

## 20.3 Feature Card Tap
- **What happens:** User taps any of the 5 feature cards
- **What moves:** JS renders an overlay inside the card element (position: absolute, z-index: 20)
- **Two tabs — both immediately interactive:**
  - Tab 0 "Conversation": Chat bubbles animate in sequentially using setTimeout delays
  - Tab 1 "In the app": Renders the feature's appUI() function immediately — no wait
- **After conversation ends:** "In the app" tab pulses orange (tabPing animation, 4 iterations)
- **Close:** X button removes overlay from DOM, timers cleared
- **Side effects:** None — no API calls, no state changes, pure presentation

## 20.4 Mark Animation (Hero)
- **What happens:** On page load, the Cinis mark builds layer by layer then floats
- **Sequence:** Outer stroke traces (2s) → outer fill pops in → 8 inner layers stagger in (280ms each) → float + glow + embers activate at t=5.2s
- **No sessionStorage gate** — this is the marketing page, not the app intro. Plays every load.
- **Side effects:** None — pure CSS/JS animation

## 20.5 Navigation Links
- Nav: "How it works" scrolls to feature section, "Pricing" scrolls to pricing section, "Sign in" links to cinis.app/login
- CTA button: links to cinis.app/signup
- **Side effects:** None

## 20.6 Responsive Behavior
- < 768px: Mobile layout — single column, mark centered in hero
- ≥ 1024px: Desktop layout — hero splits 2-column (copy left, mark right), feature cards 2-col grid
- Card 05 (One Place): Full-width on desktop with app UI pre-rendered on right panel

---

*Added S28 · March 27, 2026*
