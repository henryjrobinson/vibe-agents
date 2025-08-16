// Secure Database Storage Implementation
const database = require('../database');

class DatabaseMemoryStore {
    constructor() {
        this.db = database;
    }

    // Save memory with encryption and user isolation
    async saveMemory({ conversationId = 'default', messageId, payload, userId, userEmail, ipAddress, userAgent }) {
        if (!payload || typeof payload !== 'object' || !userId) return null;
        
        // Check if payload has meaningful content
        const nonEmpty = ['people', 'dates', 'places', 'relationships', 'events']
            .some(k => Array.isArray(payload[k]) && payload[k].length > 0);
        if (!nonEmpty) return null;

        try {
            // Ensure user exists in database
            const dbUserId = await this.db.ensureUser(userId, userEmail);
            
            // Ensure conversation exists
            const conversationUuid = await this.db.ensureConversation(dbUserId, conversationId);
            
            // Encrypt sensitive payload
            const encryptedPayload = this.db.encrypt(JSON.stringify(payload));
            const payloadHash = this.db.createHash(payload);
            
            // Insert memory with proper user isolation
            const result = await this.db.pool.query(`
                INSERT INTO encrypted_memories (conversation_id, user_id, message_id, encrypted_payload, payload_hash)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, created_at
            `, [conversationUuid, dbUserId, messageId, encryptedPayload, payloadHash]);
            
            const memory = {
                id: result.rows[0].id,
                conversationId,
                messageId,
                payload,
                createdAt: result.rows[0].created_at
            };
            
            // Audit log
            await this.db.logAction(dbUserId, 'CREATE', 'memory', memory.id, ipAddress, userAgent);
            
            return memory;
            
        } catch (error) {
            console.error('Error saving memory:', error);
            throw error;
        }
    }

    // List memories with user isolation and decryption
    async listMemories(conversationId = 'default', userId, ipAddress = null, userAgent = null) {
        if (!userId) return [];
        
        try {
            // Get user's database ID
            const dbUserId = await this.db.ensureUser(userId);
            
            // Get conversation UUID
            const conversationResult = await this.db.pool.query(
                'SELECT id FROM conversations WHERE user_id = $1 AND conversation_id = $2',
                [dbUserId, conversationId]
            );
            
            if (conversationResult.rows.length === 0) return [];
            
            const conversationUuid = conversationResult.rows[0].id;
            
            // Fetch memories with proper user isolation
            const result = await this.db.pool.query(`
                SELECT id, message_id, encrypted_payload, created_at
                FROM memories 
                WHERE conversation_uuid = $1 AND user_id = $2
                ORDER BY created_at DESC
            `, [conversationUuid, dbUserId]);
            
            // Decrypt and return memories
            const memories = result.rows.map(row => {
                try {
                    const decryptedPayload = this.db.decrypt(row.encrypted_payload);
                    return {
                        id: row.id,
                        conversationId,
                        messageId: row.message_id,
                        payload: JSON.parse(decryptedPayload),
                        createdAt: row.created_at
                    };
                } catch (decryptError) {
                    console.error('Error decrypting memory:', decryptError);
                    return null;
                }
            }).filter(Boolean);
            
            // Audit log
            await this.db.logAction(dbUserId, 'LIST', 'memory', null, ipAddress, userAgent);
            
            return memories;
            
        } catch (error) {
            console.error('Error listing memories:', error);
            throw error;
        }
    }

    // Get single memory with user isolation
    async getMemory(conversationId = 'default', memoryId, userId, ipAddress = null, userAgent = null) {
        if (!userId || !memoryId) return null;
        
        try {
            // Get user's database ID
            const dbUserId = await this.db.ensureUser(userId);
            
            // Fetch memory with user isolation check
            const result = await this.db.pool.query(`
                SELECT m.id, m.message_id, m.encrypted_payload, m.created_at, c.title as conversation_id
                FROM encrypted_memories m
                JOIN conversations c ON m.conversation_id = c.id
                WHERE m.user_id = $1 AND c.title = $2 AND m.id = $3
            `, [dbUserId, conversationId, memoryId]);
            
            if (result.rows.length === 0) return null;
            
            const row = result.rows[0];
            
            try {
                const decryptedPayload = this.db.decrypt(row.encrypted_payload);
                const memory = {
                    id: row.id,
                    conversationId: row.conversation_id,
                    messageId: row.message_id,
                    payload: JSON.parse(decryptedPayload),
                    createdAt: row.created_at
                };
                
                // Audit log
                await this.db.logAction(dbUserId, 'READ', 'memory', memoryId, ipAddress, userAgent);
                
                return memory;
                
            } catch (decryptError) {
                console.error('Error decrypting memory:', decryptError);
                return null;
            }
            
        } catch (error) {
            console.error('Error getting memory:', error);
            throw error;
        }
    }

    // Clear conversation with user isolation
    async clearConversation(conversationId = 'default', userId, ipAddress = null, userAgent = null) {
        if (!userId) return false;
        
        try {
            // Get user's database ID
            const dbUserId = await this.db.ensureUser(userId);
            
            // Delete memories with proper user isolation
            const result = await this.db.pool.query(`
                DELETE FROM encrypted_memories 
                WHERE user_id = $1 AND conversation_id IN (
                    SELECT id FROM conversations WHERE user_id = $1 AND title = $2
                )
            `, [dbUserId, conversationId]);
            
            // Audit log
            await this.db.logAction(dbUserId, 'DELETE', 'conversation', null, ipAddress, userAgent);
            
            return result.rowCount > 0;
            
        } catch (error) {
            console.error('Error clearing conversation:', error);
            throw error;
        }
    }

    // Get user statistics
    async getUserStats(userId) {
        if (!userId) return null;
        
        try {
            const dbUserId = await this.db.ensureUser(userId);
            
            const result = await this.db.pool.query(`
                SELECT 
                    COUNT(DISTINCT c.id) as conversation_count,
                    COUNT(m.id) as memory_count,
                    MIN(m.created_at) as first_memory,
                    MAX(m.created_at) as last_memory
                FROM conversations c
                LEFT JOIN memories m ON c.id = m.conversation_uuid
                WHERE c.user_id = $1
            `, [dbUserId]);
            
            return result.rows[0];
            
        } catch (error) {
            console.error('Error getting user stats:', error);
            return null;
        }
    }
}

module.exports = new DatabaseMemoryStore();
