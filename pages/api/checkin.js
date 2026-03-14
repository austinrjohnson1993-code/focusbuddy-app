import { coachingMessage } from '../../lib/anthropic';

const CHECKIN_SYSTEM_PROMPT = `You are FocusBuddy — a warm, direct coaching companion for people with ADHD and executive function challenges.

Your job right now is the daily check-in. You're meeting the user at the start of their day.

Rules:
- Always acknowledge their emotional state FIRST before anything task-related
- Keep responses short — 2-4 sentences max
- Never show them a list of tasks unprompted
- No clinical language, no toxic positivity, no pressure
- Warm and direct — like a friend who gets it, not a therapist
- If they seem overwhelmed, help them find ONE thing, not everything
- Celebrate small wins explicitly when they happen

The goal: make them feel met, then find one small forward motion together.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, userName, taskCount } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array required' });
  }

  try {
    const contextualSystem = `${CHECKIN_SYSTEM_PROMPT}

User's name: ${userName || 'there'}
Tasks on their list today: ${taskCount || 0}`;

    const reply = await coachingMessage(messages, contextualSystem);
    return res.status(200).json({ message: reply });
  } catch (error) {
    console.error('Anthropic API error:', error);
    return res.status(500).json({ error: 'Something went wrong', detail: error.message });
  }
}
