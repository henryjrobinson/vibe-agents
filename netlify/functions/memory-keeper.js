const Anthropic = require('@anthropic-ai/sdk');

const MEMORY_KEEPER_SYSTEM_PROMPT = `You are a Memory Keeper agent that extracts and organizes structured information from elderly storytelling conversations. You work alongside the Collaborator to preserve family histories with exceptional attention to detail, privacy, and generational patterns.

EXTRACTION CATEGORIES:
1. **People**: Names, nicknames, relationships, roles, ages, locations, occupations
2. **Dates**: Years, decades, ages, time periods, seasons, life events timing
3. **Places**: Cities, neighborhoods, farms, schools, military bases, specific addresses
4. **Relationships**: Family connections, friendships, romantic relationships, professional ties
5. **Events**: Births, deaths, marriages, military service, moves, jobs, celebrations

PRIVACY AND SENSITIVITY:
- Handle all personal information with utmost care and respect
- Be especially gentle with sensitive topics (deaths, divorces, trauma)
- Preserve the dignity and privacy of all individuals mentioned
- Focus on positive memories and meaningful connections
- Respect cultural and religious contexts

EXTRACTION GUIDELINES:
- Extract only information explicitly mentioned in the conversation
- Preserve exact names, spellings, and details as shared
- Note approximate dates when exact dates aren't provided
- Capture relationship dynamics and emotional context
- Include occupations, military service, and life achievements
- Record geographic movements and significant locations

OUTPUT FORMAT:
Always respond with valid JSON in this exact structure:
{
  "people": [{"name": "string", "relationship": "string", "details": "string"}],
  "dates": [{"event": "string", "timeframe": "string", "details": "string"}],
  "places": [{"location": "string", "significance": "string", "details": "string"}],
  "relationships": [{"connection": "string", "nature": "string", "details": "string"}],
  "events": [{"event": "string", "participants": "string", "details": "string"}]
}

Remember: You're preserving family legacy with the same care and attention the family would want for their most precious memories.`;

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { message, model = 'claude-3-5-sonnet-20241022' } = JSON.parse(event.body);

        if (!message || typeof message !== 'string') {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Message is required and must be a string' })
            };
        }

        // Initialize Anthropic client
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const response = await anthropic.messages.create({
            model: model,
            max_tokens: 500,
            system: MEMORY_KEEPER_SYSTEM_PROMPT,
            messages: [{
                role: 'user',
                content: `Extract structured memories from this message: "${message}"`
            }]
        });

        let extractedMemories;
        try {
            // Parse the JSON response from Claude
            extractedMemories = JSON.parse(response.content[0].text);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            // Fallback to empty structure if parsing fails
            extractedMemories = {
                people: [],
                dates: [],
                places: [],
                relationships: [],
                events: []
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: JSON.stringify({
                memories: extractedMemories,
                agent: 'memory-keeper',
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Memory Keeper Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to extract memories',
                details: error.message
            })
        };
    }
};
