const Anthropic = require('@anthropic-ai/sdk');

const MEMORY_KEEPER_SYSTEM_PROMPT = `You are a Memory Keeper agent that extracts and organizes structured information from elderly storytelling conversations.

JSON OUTPUT - You MUST respond with ONLY valid JSON, no other text:
{
  "people": [],
  "dates": [],
  "places": [],
  "relationships": [],
  "events": []
}

RULES:
- Extract all people, places, dates, relationships, and events
- Preserve exact names and details as spoken
- Do not include any explanatory text, only valid JSON
`;

module.exports = {
  name: 'memory_extractor',
  description: 'Extract structured memories (people, dates, places, relationships, events) as strict JSON',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      model: { type: 'string' },
      maxTokens: { type: 'number' }
    },
    required: ['message']
  },
  /**
   * Run the memory extractor tool
   * @param {{message: string, model?: string, maxTokens?: number}} input 
   * @param {{ anthropic?: any, apiKey?: string }} context 
   */
  run: async (input, context = {}) => {
    const { message, model, maxTokens } = input || {};
    if (!message || typeof message !== 'string') {
      throw new Error('memory_extractor: message is required');
    }

    // Prefer provided client; else create transient one from apiKey
    const anthropic = context.anthropic || new Anthropic({ apiKey: context.apiKey || process.env.ANTHROPIC_API_KEY });
    const effectiveModel = model || process.env.MEMORY_MODEL || 'claude-3-5-haiku-latest';
    const max_tokens = typeof maxTokens === 'number' ? maxTokens : 300;

    const promptContent = `Extract information from: ${JSON.stringify(message)}\n\nReturn ONLY the JSON object with keys: people, dates, places, relationships, events.`;

    const response = await anthropic.messages.create({
      model: effectiveModel,
      max_tokens,
      system: MEMORY_KEEPER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: promptContent }]
    });

    let json;
    try {
      json = JSON.parse(response.content?.[0]?.text || '{}');
    } catch (e) {
      json = { people: [], dates: [], places: [], relationships: [], events: [] };
    }
    return json;
  }
};
