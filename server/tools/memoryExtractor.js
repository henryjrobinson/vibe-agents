const Anthropic = require('@anthropic-ai/sdk');

const MEMORY_KEEPER_SYSTEM_PROMPT = `You are a Memory Keeper agent that extracts structured information from storytelling conversations.

EXTRACT:
- People: All names mentioned (clean names only, no extra words)
- Dates: Years, time periods, ages
- Places: Locations, addresses, cities
- Relationships: Family/friend connections between people
- Events: Significant happenings
- Narrator: The person telling the story (when they introduce themselves)

NAME EXTRACTION RULES:
1. Extract ONLY the actual name - remove connecting words like "and", "from", "who", etc.
2. When someone says "My name is [Name]" or "I am [Name]", put that name in the "narrator" field
3. Clean names: "Henry Robinson and I" → extract "Henry Robinson" as narrator
4. For other people mentioned, put clean names in "people" array

RELATIONSHIP RULES:
1. Create bidirectional relationships (if A is B's father, also extract B is A's child)
2. Include narrator relationships (person telling story)
3. Infer family connections (if someone is narrator's cousin, their parent is narrator's aunt/uncle)
4. Use format: {"from": "PersonA", "to": "PersonB", "relation": "relation_type"}

RELATION TYPES: parent, child, father, mother, son, daughter, spouse, husband, wife, sibling, brother, sister, grandparent, grandchild, aunt, uncle, niece, nephew, cousin, friend, neighbor

JSON OUTPUT - You MUST respond with ONLY valid JSON, no other text:
{
  "narrator": "",
  "people": [],
  "dates": [],
  "places": [],
  "relationships": [],
  "events": []
}`;

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

    const promptContent = `Extract information from: ${JSON.stringify(message)}

NAME EXTRACTION EXAMPLES:
- "My name is Henry Robinson and I am from New York" → narrator: "Henry Robinson", places: ["New York"]
- "I am Sarah" → narrator: "Sarah"
- "My friend John visited" → people: ["John"]

For relationships, create bidirectional connections and include narrator relationships.
Example: "My aunt Debra took my cousin Marcus" should extract:
- Debra → narrator (aunt), narrator → Debra (niece/nephew)
- Marcus → narrator (cousin), narrator → Marcus (cousin)

Return ONLY valid JSON with keys: narrator, people, dates, places, relationships, events.`;

    console.log('🧠 Memory Extractor Input:', {
      message: message.substring(0, 200) + (message.length > 200 ? '...' : ''),
      model: effectiveModel,
      max_tokens
    });

    const response = await anthropic.messages.create({
      model: effectiveModel,
      max_tokens,
      system: MEMORY_KEEPER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: promptContent }]
    });

    const rawResponse = response.content?.[0]?.text || '{}';
    console.log('🧠 Memory Extractor Raw Response:', rawResponse);

    let json;
    try {
      json = JSON.parse(rawResponse);
      console.log('🧠 Memory Extractor Parsed:', json);
    } catch (e) {
      console.error('🧠 Memory Extractor Parse Error:', e.message);
      json = { people: [], dates: [], places: [], relationships: [], events: [] };
    }
    return json;
  }
};
