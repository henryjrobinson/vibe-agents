const Anthropic = require('@anthropic-ai/sdk');
const { validateApiRequest, createErrorResponse, createOptionsResponse, createSecureCorsHeaders } = require('./validation-utils');

const MEMORY_KEEPER_SYSTEM_PROMPT = `You are a JSON extraction agent. You MUST respond with ONLY valid JSON, no other text.

Your job: Extract structured information from messages and return it in this EXACT JSON format:
{
  "people": [],
  "dates": [],
  "places": [],
  "relationships": [],
  "events": []
}

Rules:
- If someone mentions their name, add to people array
- If someone mentions a place, add to places array
- NO explanatory text, NO markdown, NO comments
- ONLY return the JSON object
- If nothing to extract, return empty arrays`;

exports.handler = async (event, context) => {
    let validation;
    try {
        // Comprehensive input validation
        validation = validateApiRequest(event);
        
        // Handle CORS preflight requests
        if (validation.isOptions) {
            return createOptionsResponse(validation.allowedOrigin);
        }
        
        // Extract validated data
        const { message, model } = validation.validatedData;
        const allowedOrigin = validation.allowedOrigin;

        // Debug logging with validated inputs
        console.log('=== MEMORY KEEPER DEBUG ===');
        console.log('Validated message:', message);
        console.log('Validated model:', model);
        console.log('Message length:', message.length);
        console.log('Message type:', typeof message);

        // Initialize Anthropic client
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const promptContent = `Extract information from: "${message}"

You MUST respond with ONLY valid JSON in this exact format:
{
  "people": [],
  "dates": [],
  "places": [],
  "relationships": [],
  "events": []
}

Rules:
- If someone mentions their name, add to people array: {"name": "Name", "relationship": "narrator", "details": "person telling story"}
- If someone mentions a place, add to places array: {"location": "Place", "significance": "context", "details": "description"}
- NO explanatory text, NO markdown, ONLY the JSON object

Message: "${message}"`;
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
            headers: createSecureCorsHeaders(allowedOrigin),
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
        return createErrorResponse(error, validation?.allowedOrigin);
    }
};
