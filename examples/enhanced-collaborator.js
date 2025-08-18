/**
 * Enhanced Collaborator Agent with RAG Integration
 * Example showing how to integrate story knowledge base with your collaborator
 */

const { createRAGClient } = require('../server/tools/ragClient');

// Enhanced collaborator endpoint with RAG context
app.post('/api/collaborator-enhanced', verifyFirebaseToken, ensureUserScope, async (req, res) => {
    try {
        const { message, conversationHistory = [], model } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required and must be a string' });
        }

        // Create RAG client for this user
        const ragClient = createRAGClient(req.userId);
        
        // Get relevant story context
        const context = await ragClient.getEnrichedContext(message, conversationHistory);
        
        // Build enhanced system prompt with story context
        let enhancedSystemPrompt = COLLABORATOR_SYSTEM_PROMPT;
        
        if (context.hasRelevantStories) {
            enhancedSystemPrompt += `\n\nRELEVANT FAMILY STORIES FROM YOUR KNOWLEDGE BASE:
${context.formattedContext}

Use these stories to provide more personalized and contextual responses. Reference specific details, people, and events when relevant to help the person remember and expand on their stories.`;
        }

        // Build conversation context
        const messages = [
            ...conversationHistory.slice(-4),
            {
                role: 'user',
                content: message
            }
        ];

        const effectiveModel = sanitizeModel(model, process.env.COLLABORATOR_MODEL || 'claude-3-5-haiku-latest');
        const response = await withTimeout(anthropic.messages.create({
            model: effectiveModel,
            max_tokens: 400, // Slightly higher for richer responses
            system: enhancedSystemPrompt,
            messages: messages
        }), 20000, 'Anthropic collaborator timeout');

        const collaboratorResponse = response.content[0].text;

        res.json({
            response: collaboratorResponse,
            agent: 'collaborator-enhanced',
            contextUsed: context.hasRelevantStories,
            storiesReferenced: context.storyCount,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Enhanced Collaborator API Error:', error);
        res.status(500).json({ 
            error: 'Failed to generate enhanced collaborator response',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Story-aware memory processing
app.post('/api/memory-keeper-enhanced', verifyFirebaseToken, ensureUserScope, async (req, res) => {
    try {
        const { message, model, conversationId = 'default', messageId } = req.body;
        
        // Extract memories as usual
        const effectiveModel = sanitizeModel(model, process.env.MEMORY_MODEL || 'claude-3-5-haiku-latest');
        const extractedMemories = await withTimeout(
            executeTool('memory_extractor', {
                message,
                model: effectiveModel,
                maxTokens: 300
            }, { anthropic }),
            20000,
            'Anthropic memory keeper timeout'
        ).catch(() => ({ people: [], dates: [], places: [], relationships: [], events: [] }));

        // Save memory
        const saved = await memoryStore.saveMemory({ 
            conversationId, 
            messageId, 
            payload: extractedMemories,
            userId: req.userId,
            userEmail: req.user?.email,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Process into stories if we have meaningful content
        const ragClient = createRAGClient(req.userId);
        let storyProcessingResult = null;
        
        const hasContent = ['people', 'dates', 'places', 'relationships', 'events']
            .some(k => Array.isArray(extractedMemories[k]) && extractedMemories[k].length > 0);
            
        if (hasContent) {
            try {
                storyProcessingResult = await ragClient.processMemories(conversationId);
            } catch (error) {
                console.error('Story processing failed:', error);
            }
        }

        // Emit SSE event
        try {
            const userConversationId = `${req.userId}_${conversationId}`;
            const chan = getChannel(userConversationId);
            chan.emit('memory', { 
                messageId, 
                ...extractedMemories, 
                id: saved?.id || null,
                storiesCreated: storyProcessingResult?.stories?.length || 0
            });
        } catch (e) {
            console.warn('SSE emit failed:', e.message);
        }

        res.json({
            memories: extractedMemories,
            id: saved?.id || null,
            storyProcessing: storyProcessingResult,
            agent: 'memory-keeper-enhanced',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Enhanced Memory Keeper API Error:', error);
        res.status(500).json({ 
            error: 'Failed to extract memories and process stories',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Utility endpoint to manually process existing memories into stories
app.post('/api/stories/process-all', verifyFirebaseToken, ensureUserScope, async (req, res) => {
    try {
        const ragClient = createRAGClient(req.userId);
        const result = await ragClient.processMemories();
        
        res.json({
            success: true,
            message: `Processed memories into ${result.stories?.length || 0} stories`,
            ...result
        });
    } catch (error) {
        console.error('Process all stories error:', error);
        res.status(500).json({ 
            error: 'Failed to process all memories into stories',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = {
    // Export functions if needed for testing
};
