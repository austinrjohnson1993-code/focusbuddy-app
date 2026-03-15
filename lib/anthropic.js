// Anthropic SDK client — requires ANTHROPIC_API_KEY env var
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function coachingMessage(messages, systemPrompt) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages,
  });
  return response.content[0].text;
}

export async function lightweightMessage(messages, systemPrompt) {
  const response = await client.messages.create({
    model: 'claude-haiku-20240307',
    max_tokens: 512,
    system: systemPrompt,
    messages: messages,
  });
  return response.content[0].text;
}
