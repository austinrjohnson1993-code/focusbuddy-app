import { coachingMessage } from '../../lib/anthropic';

const BASE_SYSTEM_PROMPT = `You are FocusBuddy — a warm, direct coaching companion for people with ADHD and executive function challenges.

Your job right now is the daily check-in. You're meeting the user at the start of their day.

Rules:
- Always acknowledge their emotional state FIRST before anything task-related
- Keep responses short — 2-4 sentences max
- Never show them a list of tasks unprompted
- No clinical language, no toxic positivity, no pressure
- Warm and direct — like a friend who gets it, not a therapist
- If they seem overwhelmed, help them find ONE thing, not everything
- Celebrate small wins explicitly when they happen
- Do not use markdown formatting — no bullet points, no bold, no headers

The goal: make them feel met, then find one small forward motion together.`;

const STYLE_DESCRIPTIONS = {
  supportive: 'Lead with warmth and validation. Be a safe landing space first.',
  direct: 'Be concise and action-oriented. Skip pleasantries, get to the point.',
  motivational: 'Light energy, forward momentum. Remind them of their own capacity.',
  structured: 'Offer gentle structure. Help them think in ordered steps.',
  curious: 'Ask good questions. Help them discover their own answers.',
};

function buildPersonaVoice(coachingBlend) {
  if (!coachingBlend) return '';

  const lines = [];

  if (typeof coachingBlend === 'string') {
    const desc = STYLE_DESCRIPTIONS[coachingBlend.toLowerCase()];
    if (desc) lines.push(desc);
    else lines.push(`Coaching style: ${coachingBlend}`);
  } else if (typeof coachingBlend === 'object') {
    Object.entries(coachingBlend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .forEach(([style, weight]) => {
        if (weight > 10 && STYLE_DESCRIPTIONS[style]) {
          lines.push(STYLE_DESCRIPTIONS[style]);
        }
      });
  }

  return lines.length > 0 ? `\nPersona guidance:\n${lines.join('\n')}\n` : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, userName, taskCount, taskTitles, coachingBlend, aiContext } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array required' });
  }

  try {
    const personaVoice = buildPersonaVoice(coachingBlend);

    const taskContext = taskTitles && taskTitles.length > 0
      ? `\nTheir tasks today:\n${taskTitles.map(t => `- ${t}`).join('\n')}`
      : '';

    const userContext = aiContext ? `\nAbout this user: ${aiContext}` : '';

    const contextualSystem = `${BASE_SYSTEM_PROMPT}
${personaVoice}
User's name: ${userName || 'there'}
Tasks on their list today: ${taskCount || 0}${taskContext}${userContext}`;

    const reply = await coachingMessage(messages, contextualSystem);
    return res.status(200).json({ message: reply });
  } catch (error) {
    console.error('Anthropic API error:', error);
    return res.status(500).json({ error: 'Something went wrong', detail: error.message });
  }
}
