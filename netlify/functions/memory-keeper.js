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
- Extract ALL people mentioned, even in passing or as context
- INFER relationships from conversational clues and family context
- Build comprehensive family trees from fragments of information
- Connect new people to existing family members when relationships are implied
- Preserve exact names, spellings, and details as shared
- Note approximate dates when exact dates aren't provided
- Capture relationship dynamics and emotional context
- Include occupations, military service, and life achievements
- Record geographic movements and significant locations

RELATIONSHIP INFERENCE RULES:
- If someone is mentioned as "[Person A]'s son/daughter", extract both the child AND the parent-child relationship
- If aunts/uncles are mentioned, infer they are siblings of one of the narrator's parents
- If cousins are mentioned, connect them to their parents (aunts/uncles) and establish cousin relationship to narrator
- Build multi-generational family connections from scattered mentions
- When someone takes children to events, infer caregiver/family relationships
- Extract implied family roles and connections even if not explicitly stated

EXTRACTION EXAMPLES:
If someone says: "My aunt Debra used to take my cousin Marcus (Sandy's son) to the parade"
Extract:
- People: Marcus (Sandy's son, narrator's cousin), Debra (aunt), Sandy (aunt, Marcus's mother)
- Relationships: Debra-narrator (aunt-nephew/niece), Marcus-narrator (cousins), Sandy-Marcus (mother-son), Sandy-narrator (aunt-nephew/niece), Debra-Sandy (sisters or sisters-in-law)
- Events: Parade attendance with family members

If someone mentions: "We went to St. Luke AME Zion Church"
Extract:
- Places: St. Luke AME Zion Church (family church, community gathering place)
- Events: Church attendance (regular family activity)
- Relationships: Family religious community connections

OUTPUT FORMAT:
Always respond with valid JSON in this exact structure:
{
  "people": [{"name": "string", "relationship": "string", "details": "string"}],
  "dates": [{"event": "string", "timeframe": "string", "details": "string"}],
  "places": [{"location": "string", "significance": "string", "details": "string"}],
  "relationships": [{"connection": "string", "nature": "string", "details": "string"}],
  "events": [{"event": "string", "participants": "string", "details": "string"}]
}

REMEMBER: Be thorough and inferential. Extract every person mentioned and build complete relationship webs from conversational fragments.

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

        // Debug logging
        console.log('=== MEMORY KEEPER DEBUG ===');
        console.log('Input message:', message);
        console.log('Selected model:', model);
        console.log('Message length:', message?.length);
        console.log('Message type:', typeof message);

        if (!message || typeof message !== 'string') {
            console.log('ERROR: Invalid message format');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Message is required and must be a string' })
            };
        }

        // Initialize Anthropic client
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const promptContent = `Extract structured memories from this message: "${message}"`;
        console.log('Prompt sent to Claude:', promptContent);
        console.log('System prompt length:', MEMORY_KEEPER_SYSTEM_PROMPT.length);

        const response = await anthropic.messages.create({
            model: model,
            max_tokens: 500,
            system: MEMORY_KEEPER_SYSTEM_PROMPT,
            messages: [{
                role: 'user',
                content: promptContent
            }]
        });

        console.log('Claude raw response:', response.content[0].text);
        console.log('Response length:', response.content[0].text.length);

        let extractedMemories;
        try {
            // Parse the JSON response from Claude
            extractedMemories = JSON.parse(response.content[0].text);
            console.log('Successfully parsed memories:', JSON.stringify(extractedMemories, null, 2));
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            console.error('Raw response that failed to parse:', response.content[0].text);
            // Fallback to empty structure if parsing fails
            extractedMemories = {
                people: [],
                dates: [],
                places: [],
                relationships: [],
                events: []
            };
            console.log('Using fallback empty structure');
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
                debugInfo: {
                    rawResponse: response.content[0].text,
                    inputMessage: message,
                    selectedModel: model,
                    promptLength: MEMORY_KEEPER_SYSTEM_PROMPT.length,
                    responseLength: response.content[0].text.length
                },
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
