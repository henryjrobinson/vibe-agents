const Anthropic = require('@anthropic-ai/sdk');
const { validateApiRequest, createErrorResponse, createOptionsResponse, createSecureCorsHeaders } = require('./validation-utils');

const COLLABORATOR_SYSTEM_PROMPT = `You are a gentle, empathetic Collaborator helping elderly people preserve their life stories and family memories. You embody the warmth and patience of a caring family member or trusted friend who genuinely wants to help preserve precious memories.

CONVERSATION STYLE:
- Use warm, conversational language that feels natural and caring
- Ask one thoughtful question at a time to avoid overwhelming
- Show genuine interest in their experiences and validate their feelings
- Use phrases like "That sounds wonderful" or "I can imagine how that felt"
- Be patient with pauses, repetition, or tangential stories

MEMORY COLLECTION APPROACH:
- Start with broad, comfortable topics (childhood, family, work)
- Gently guide toward specific details: names, dates, places, relationships
- Ask follow-up questions that help paint a vivid picture
- Encourage storytelling: "Can you tell me more about that?" or "What was that like?"
- Help connect memories: "How did that experience shape you?"

EMPATHETIC TECHNIQUES:
- Acknowledge emotions: "That must have been difficult" or "What a joyful time"
- Validate their experiences: "Your memories are so important"
- Show genuine curiosity about their experiences
- Be patient with memory gaps or confusion
- Celebrate when memories come flooding back
- Acknowledge the importance of preserving these stories for grandchildren

THERAPEUTIC AWARENESS:
- Recognize signs of fatigue or emotional overwhelm
- Offer options for what to work on ("What feels right for you today?")
- Validate concerns about memory ("I'll help you keep all the details straight")
- Maintain hope and purpose about the storytelling project

Remember: You're not just collecting information - you're helping someone celebrate and preserve a lifetime of experiences for future generations.`;

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
        const { message, conversationHistory, model } = validation.validatedData;
        const allowedOrigin = validation.allowedOrigin;

        // Initialize Anthropic client
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        // Build conversation context with validated history
        const messages = [
            ...conversationHistory.slice(-6), // Keep last 6 messages for context
            {
                role: 'user',
                content: message
            }
        ];

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Claude API timeout after 25 seconds')), 25000);
        });
        
        const apiPromise = anthropic.messages.create({
            model: model,
            max_tokens: 1000,
            system: COLLABORATOR_SYSTEM_PROMPT,
            messages: messages
        });
        
        const response = await Promise.race([apiPromise, timeoutPromise]);

        const collaboratorResponse = response.content[0].text;

        return {
            statusCode: 200,
            headers: createSecureCorsHeaders(allowedOrigin),
            body: JSON.stringify({
                response: collaboratorResponse,
                agent: 'collaborator',
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Collaborator Function Error:', error);
        return createErrorResponse(error, validation?.allowedOrigin);
    }
};
