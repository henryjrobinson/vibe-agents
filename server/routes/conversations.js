const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const { query } = require('../config/database');
const { validateInput, createErrorResponse } = require('../utils/validation');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// All conversation routes require authentication
router.use(authenticateUser);

// GET /api/conversations - Get all user conversations
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { archived = false, limit = 20, offset = 0 } = req.query;
        
        const result = await query(
            `SELECT id, title, description, created_at, updated_at, 
                    message_count, memory_count, is_archived
             FROM conversations 
             WHERE user_id = $1 AND is_archived = $2
             ORDER BY updated_at DESC
             LIMIT $3 OFFSET $4`,
            [userId, archived, limit, offset]
        );
        
        res.json({
            conversations: result.rows,
            total: result.rows.length,
            hasMore: result.rows.length === parseInt(limit)
        });
    } catch (error) {
        console.error('❌ Error fetching conversations:', error);
        res.status(500).json(createErrorResponse(error));
    }
});

// POST /api/conversations - Create new conversation
router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { title, description } = req.body;
        
        // Validate input
        if (!title || title.trim().length === 0) {
            return res.status(400).json(createErrorResponse(new Error('Title is required')));
        }
        
        if (title.length > 500) {
            return res.status(400).json(createErrorResponse(new Error('Title too long (max 500 characters)')));
        }
        
        const result = await query(
            `INSERT INTO conversations (user_id, title, description)
             VALUES ($1, $2, $3)
             RETURNING id, title, description, created_at, updated_at, message_count, memory_count`,
            [userId, title.trim(), description?.trim() || null]
        );
        
        res.status(201).json({
            conversation: result.rows[0],
            message: 'Conversation created successfully'
        });
    } catch (error) {
        console.error('❌ Error creating conversation:', error);
        res.status(500).json(createErrorResponse(error));
    }
});

// GET /api/conversations/:id - Get specific conversation with messages
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const conversationId = parseInt(req.params.id);
        
        if (isNaN(conversationId)) {
            return res.status(400).json(createErrorResponse(new Error('Invalid conversation ID')));
        }
        
        // Get conversation details
        const conversationResult = await query(
            `SELECT id, title, description, created_at, updated_at, 
                    message_count, memory_count, is_archived
             FROM conversations 
             WHERE id = $1 AND user_id = $2`,
            [conversationId, userId]
        );
        
        if (conversationResult.rows.length === 0) {
            return res.status(404).json(createErrorResponse(new Error('Conversation not found')));
        }
        
        // Get messages for this conversation
        const messagesResult = await query(
            `SELECT id, role, content, timestamp, message_type, metadata
             FROM messages 
             WHERE conversation_id = $1
             ORDER BY timestamp ASC`,
            [conversationId]
        );
        
        // Get memories for this conversation
        const memoriesResult = await query(
            `SELECT id, category, content, extracted_at, is_verified, confidence_score
             FROM memories 
             WHERE conversation_id = $1
             ORDER BY extracted_at DESC`,
            [conversationId]
        );
        
        res.json({
            conversation: conversationResult.rows[0],
            messages: messagesResult.rows,
            memories: memoriesResult.rows
        });
    } catch (error) {
        console.error('❌ Error fetching conversation:', error);
        res.status(500).json(createErrorResponse(error));
    }
});

// POST /api/conversations/:id/messages - Send message and get AI response
router.post('/:id/messages', async (req, res) => {
    try {
        const userId = req.user.userId;
        const conversationId = parseInt(req.params.id);
        const { content, messageType = 'chat' } = req.body;
        
        if (isNaN(conversationId)) {
            return res.status(400).json(createErrorResponse(new Error('Invalid conversation ID')));
        }
        
        if (!content || content.trim().length === 0) {
            return res.status(400).json(createErrorResponse(new Error('Message content is required')));
        }
        
        // Verify conversation belongs to user
        const conversationCheck = await query(
            'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
            [conversationId, userId]
        );
        
        if (conversationCheck.rows.length === 0) {
            return res.status(404).json(createErrorResponse(new Error('Conversation not found')));
        }
        
        // Store user message
        const userMessageResult = await query(
            `INSERT INTO messages (conversation_id, role, content, message_type)
             VALUES ($1, 'user', $2, $3)
             RETURNING id, role, content, timestamp, message_type`,
            [conversationId, content.trim(), messageType]
        );
        
        // Get conversation history for AI context
        const historyResult = await query(
            `SELECT role, content FROM messages 
             WHERE conversation_id = $1 
             ORDER BY timestamp ASC 
             LIMIT 20`,
            [conversationId]
        );
        
        // Generate AI response using Collaborator agent
        const collaboratorResponse = await generateCollaboratorResponse(
            content.trim(),
            historyResult.rows
        );
        
        // Store AI response
        const aiMessageResult = await query(
            `INSERT INTO messages (conversation_id, role, content, message_type)
             VALUES ($1, 'collaborator', $2, 'chat')
             RETURNING id, role, content, timestamp, message_type`,
            [conversationId, collaboratorResponse]
        );
        
        // Extract memories from the conversation
        await extractMemories(conversationId, userId, content.trim(), collaboratorResponse);
        
        res.json({
            userMessage: userMessageResult.rows[0],
            aiResponse: aiMessageResult.rows[0],
            message: 'Messages sent successfully'
        });
    } catch (error) {
        console.error('❌ Error sending message:', error);
        res.status(500).json(createErrorResponse(error));
    }
});

// PUT /api/conversations/:id - Update conversation
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const conversationId = parseInt(req.params.id);
        const { title, description, isArchived } = req.body;
        
        if (isNaN(conversationId)) {
            return res.status(400).json(createErrorResponse(new Error('Invalid conversation ID')));
        }
        
        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (title !== undefined) {
            if (!title || title.trim().length === 0) {
                return res.status(400).json(createErrorResponse(new Error('Title cannot be empty')));
            }
            updates.push(`title = $${paramCount++}`);
            values.push(title.trim());
        }
        
        if (description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(description?.trim() || null);
        }
        
        if (isArchived !== undefined) {
            updates.push(`is_archived = $${paramCount++}`);
            values.push(Boolean(isArchived));
        }
        
        if (updates.length === 0) {
            return res.status(400).json(createErrorResponse(new Error('No valid updates provided')));
        }
        
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(conversationId, userId);
        
        const result = await query(
            `UPDATE conversations 
             SET ${updates.join(', ')}
             WHERE id = $${paramCount++} AND user_id = $${paramCount++}
             RETURNING id, title, description, updated_at, is_archived`,
            values
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json(createErrorResponse(new Error('Conversation not found')));
        }
        
        res.json({
            conversation: result.rows[0],
            message: 'Conversation updated successfully'
        });
    } catch (error) {
        console.error('❌ Error updating conversation:', error);
        res.status(500).json(createErrorResponse(error));
    }
});

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const conversationId = parseInt(req.params.id);
        
        if (isNaN(conversationId)) {
            return res.status(400).json(createErrorResponse(new Error('Invalid conversation ID')));
        }
        
        const result = await query(
            'DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id',
            [conversationId, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json(createErrorResponse(new Error('Conversation not found')));
        }
        
        res.json({
            message: 'Conversation deleted successfully',
            deletedId: conversationId
        });
    } catch (error) {
        console.error('❌ Error deleting conversation:', error);
        res.status(500).json(createErrorResponse(error));
    }
});

// Helper function to generate Collaborator AI response
async function generateCollaboratorResponse(userMessage, conversationHistory) {
    try {
        // Build conversation context
        const messages = conversationHistory.map(msg => ({
            role: msg.role === 'collaborator' ? 'assistant' : 'user',
            content: msg.content
        }));
        
        // Add current user message
        messages.push({ role: 'user', content: userMessage });
        
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1000,
            system: `You are a compassionate Collaborator agent helping seniors share their life stories. Your role is to:

1. Listen empathetically and ask thoughtful follow-up questions
2. Help users explore their memories in detail
3. Encourage storytelling about people, places, events, and relationships
4. Be patient, warm, and genuinely interested
5. Ask one question at a time to avoid overwhelming
6. Help users feel comfortable sharing personal stories

Your responses should be conversational, caring, and focused on drawing out rich details about the user's life experiences.`,
            messages: messages
        });
        
        return response.content[0].text;
    } catch (error) {
        console.error('❌ Error generating AI response:', error);
        return "I'm sorry, I'm having trouble responding right now. Could you please try again?";
    }
}

// Helper function to extract memories from conversation
async function extractMemories(conversationId, userId, userMessage, aiResponse) {
    try {
        const combinedText = `User: ${userMessage}\n\nCollaborator: ${aiResponse}`;
        
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1000,
            system: `You are a Memory Keeper agent that extracts structured memories from conversations. Extract key information and return it as JSON.

Extract these categories:
- people: Names and relationships
- places: Locations mentioned
- dates: Time periods, ages, years
- relationships: Connections between people
- events: Significant happenings

Return ONLY valid JSON in this format:
{
  "people": [{"name": "string", "relationship": "string", "description": "string"}],
  "places": [{"name": "string", "type": "string", "description": "string"}],
  "dates": [{"period": "string", "description": "string"}],
  "relationships": [{"person1": "string", "person2": "string", "type": "string"}],
  "events": [{"name": "string", "description": "string", "timeframe": "string"}]
}`,
            messages: [{ role: 'user', content: combinedText }]
        });
        
        const extractedData = JSON.parse(response.content[0].text);
        
        // Store extracted memories in database
        for (const [category, items] of Object.entries(extractedData)) {
            if (Array.isArray(items) && items.length > 0) {
                for (const item of items) {
                    await query(
                        `INSERT INTO memories (user_id, conversation_id, category, content, confidence_score)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [userId, conversationId, category, JSON.stringify(item), 0.8]
                    );
                }
            }
        }
    } catch (error) {
        console.error('❌ Error extracting memories:', error);
        // Don't fail the main request if memory extraction fails
    }
}

module.exports = router;
