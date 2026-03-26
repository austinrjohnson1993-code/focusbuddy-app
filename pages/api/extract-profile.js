import { lightweightMessage } from '../../lib/anthropic';
import { withAuthGuard } from '../../lib/authGuard';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  const extractionPrompt = `Based on this onboarding conversation, extract the following information as JSON. If something wasn't mentioned, use null.

Return ONLY valid JSON, no other text:

{
  "full_name": "string or null",
  "communication_style": "string or null",
  "work_schedule": "string or null",
  "sleep_habits": "string or null",
  "exercise_habits": "string or null",
  "food_habits": "string or null",
  "family_context": "string or null",
  "biggest_friction": "starting | staying_on_track | finishing | other",
  "accountability_style": "push | pull | mixed",
  "past_failures": "string or null",
  "current_priorities": "string or null",
  "ai_context": "any other important context as a summary string",
  "coaching_blend": {
    "primary": "drill_sergeant | coach | thinking_partner | hype_person | strategist",
    "secondary": "same options or null",
    "tertiary": "same options or null",
    "weights": {
      "primary_weight": 60,
      "secondary_weight": 25,
      "tertiary_weight": 15
    }
  }
}`;

  try {
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Cinis'}: ${m.content}`)
      .join('\n');

    const result = await lightweightMessage(
      [{ role: 'user', content: `${extractionPrompt}\n\nConversation:\n${conversationText}` }],
      'You extract structured data from conversations and return only valid JSON.'
    );

    const parsed = JSON.parse(result);
    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Profile extraction error:', error);
    return res.status(500).json({ error: 'Extraction failed' });
  }
}

export default withAuthGuard(handler);
