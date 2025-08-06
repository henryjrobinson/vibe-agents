const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const { query } = require('../config/database');
const { createErrorResponse, validatePagination } = require('../utils/validation');

const router = express.Router();

// All memory routes require authentication
router.use(authenticateUser);

// GET /api/memories - Get all user memories with filters
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { category, conversationId, verified, search } = req.query;
        const { limit, offset } = validatePagination(req.query);
        
        let whereClause = 'WHERE m.user_id = $1';
        const params = [userId];
        let paramCount = 2;
        
        if (category) {
            whereClause += ` AND m.category = $${paramCount++}`;
            params.push(category);
        }
        
        if (conversationId) {
            whereClause += ` AND m.conversation_id = $${paramCount++}`;
            params.push(parseInt(conversationId));
        }
        
        if (verified !== undefined) {
            whereClause += ` AND m.is_verified = $${paramCount++}`;
            params.push(verified === 'true');
        }
        
        if (search) {
            whereClause += ` AND m.content::text ILIKE $${paramCount++}`;
            params.push(`%${search}%`);
        }
        
        params.push(limit, offset);
        
        const result = await query(
            `SELECT m.id, m.category, m.content, m.extracted_at, m.is_verified, 
                    m.confidence_score, m.conversation_id,
                    c.title as conversation_title
             FROM memories m
             LEFT JOIN conversations c ON m.conversation_id = c.id AND c.user_id = m.user_id
             ${whereClause}
             ORDER BY m.extracted_at DESC
             LIMIT $${paramCount++} OFFSET $${paramCount++}`,
            params
        );
        
        // Get total count for pagination
        const countResult = await query(
            `SELECT COUNT(*) as total FROM memories m 
             LEFT JOIN conversations c ON m.conversation_id = c.id AND c.user_id = m.user_id
             ${whereClause}`,
            params.slice(0, -2) // Remove limit and offset
        );
        
        res.json({
            memories: result.rows,
            total: parseInt(countResult.rows[0].total),
            hasMore: result.rows.length === limit
        });
    } catch (error) {
        console.error('❌ Error fetching memories:', error);
        res.status(500).json(createErrorResponse(error));
    }
});

// GET /api/memories/:id - Get specific memory
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const memoryId = parseInt(req.params.id);
        
        if (isNaN(memoryId)) {
            return res.status(400).json(createErrorResponse(new Error('Invalid memory ID')));
        }
        
        const result = await query(
            `SELECT m.*, c.title as conversation_title
             FROM memories m
             LEFT JOIN conversations c ON m.conversation_id = c.id
             WHERE m.id = $1 AND m.user_id = $2`,
            [memoryId, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json(createErrorResponse(new Error('Memory not found')));
        }
        
        res.json({
            memory: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Error fetching memory:', error);
        res.status(500).json(createErrorResponse(error));
    }
});

// PUT /api/memories/:id - Update/verify memory
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const memoryId = parseInt(req.params.id);
        const { content, isVerified, category } = req.body;
        
        if (isNaN(memoryId)) {
            return res.status(400).json(createErrorResponse(new Error('Invalid memory ID')));
        }
        
        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (content !== undefined) {
            if (typeof content !== 'object') {
                return res.status(400).json(createErrorResponse(new Error('Content must be a valid object')));
            }
            updates.push(`content = $${paramCount++}`);
            values.push(JSON.stringify(content));
        }
        
        if (isVerified !== undefined) {
            updates.push(`is_verified = $${paramCount++}`);
            values.push(Boolean(isVerified));
        }
        
        if (category !== undefined) {
            const validCategories = ['people', 'places', 'dates', 'relationships', 'events'];
            if (!validCategories.includes(category)) {
                return res.status(400).json(createErrorResponse(new Error('Invalid category')));
            }
            updates.push(`category = $${paramCount++}`);
            values.push(category);
        }
        
        if (updates.length === 0) {
            return res.status(400).json(createErrorResponse(new Error('No valid updates provided')));
        }
        
        values.push(memoryId, userId);
        
        const result = await query(
            `UPDATE memories 
             SET ${updates.join(', ')}
             WHERE id = $${paramCount++} AND user_id = $${paramCount++}
             RETURNING id, category, content, is_verified, confidence_score`,
            values
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json(createErrorResponse(new Error('Memory not found')));
        }
        
        res.json({
            memory: result.rows[0],
            message: 'Memory updated successfully'
        });
    } catch (error) {
        console.error('❌ Error updating memory:', error);
        res.status(500).json(createErrorResponse(error));
    }
});

// DELETE /api/memories/:id - Delete memory
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const memoryId = parseInt(req.params.id);
        
        if (isNaN(memoryId)) {
            return res.status(400).json(createErrorResponse(new Error('Invalid memory ID')));
        }
        
        const result = await query(
            'DELETE FROM memories WHERE id = $1 AND user_id = $2 RETURNING id',
            [memoryId, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json(createErrorResponse(new Error('Memory not found')));
        }
        
        res.json({
            message: 'Memory deleted successfully',
            deletedId: memoryId
        });
    } catch (error) {
        console.error('❌ Error deleting memory:', error);
        res.status(500).json(createErrorResponse(error));
    }
});

// GET /api/memories/categories - Get memory categories with counts
router.get('/categories', async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const result = await query(
            `SELECT category, COUNT(*) as count
             FROM memories 
             WHERE user_id = $1
             GROUP BY category
             ORDER BY count DESC`,
            [userId]
        );
        
        res.json({
            categories: result.rows
        });
    } catch (error) {
        console.error('❌ Error fetching memory categories:', error);
        res.status(500).json(createErrorResponse(error));
    }
});

module.exports = router;
