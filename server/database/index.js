// Database connection and utilities
const { Pool } = require('pg');
const crypto = require('crypto');

class Database {
    constructor() {
        this.dbConfigured = !!process.env.DATABASE_URL;
        if (!this.dbConfigured) {
            console.error('❌ DATABASE_URL is not set. The database is not configured.');
        }

        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.encryptionKey = process.env.ENCRYPTION_KEY;
        if (!this.encryptionKey || this.encryptionKey.length !== 64) {
            console.warn('⚠️ Invalid ENCRYPTION_KEY. Data encryption disabled.');
            this.encryptionKey = null;
        }

        this.initializeSchema();
    }

    async initializeSchema() {
        if (!this.dbConfigured) {
            console.warn('⚠️ Skipping schema initialization because DATABASE_URL is not configured.');
            return;
        }
        try {
            // Enable pgvector extension for embeddings
            await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

            // Add missing columns to existing users table for Firebase integration
            await this.pool.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE;
            `);

            // Create new tables for encrypted memories and audit logs
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS encrypted_memories (
                    id SERIAL PRIMARY KEY,
                    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    message_id VARCHAR(255),
                    encrypted_payload TEXT NOT NULL,
                    payload_hash VARCHAR(64) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    action VARCHAR(50) NOT NULL,
                    resource_type VARCHAR(50) NOT NULL,
                    resource_id INTEGER,
                    ip_address INET,
                    user_agent TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS user_preferences (
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    key VARCHAR(100) NOT NULL,
                    value JSONB,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    PRIMARY KEY (user_id, key)
                );

                CREATE TABLE IF NOT EXISTS stories (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    summary TEXT,
                    embedding vector(1536),
                    people TEXT[],
                    places TEXT[],
                    dates TEXT[],
                    events TEXT[],
                    source_memory_ids INTEGER[],
                    conversation_ids INTEGER[],
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `);

            // Create indexes
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_encrypted_memories_user_conversation ON encrypted_memories(user_id, conversation_id);
                CREATE INDEX IF NOT EXISTS idx_encrypted_memories_created_at ON encrypted_memories(created_at);
                CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at);
                CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at);
                CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
                CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
                CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at);
                CREATE INDEX IF NOT EXISTS idx_stories_embedding ON stories USING ivfflat (embedding vector_cosine_ops);
                CREATE INDEX IF NOT EXISTS idx_stories_people ON stories USING GIN (people);
                CREATE INDEX IF NOT EXISTS idx_stories_places ON stories USING GIN (places);
                CREATE INDEX IF NOT EXISTS idx_stories_events ON stories USING GIN (events);
            `);
            console.log('✅ Database schema initialized with RAG support');
        } catch (error) {
            console.error('❌ Database schema initialization failed:', error);
        }
    }

    async ping() {
        if (!this.dbConfigured) return { ok: false, configured: false };
        try {
            await this.pool.query('SELECT 1');
            return { ok: true, configured: true };
        } catch (e) {
            return { ok: false, configured: true, error: e?.message };
        }
    }

    // Encryption utilities
    encrypt(text) {
        if (!this.encryptionKey || !text) return text;

        const iv = crypto.randomBytes(16);
        const key = Buffer.from(this.encryptionKey, 'hex');
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return iv.toString('hex') + ':' + encrypted;
    }

    decrypt(encryptedText) {
        if (!this.encryptionKey || !encryptedText || !encryptedText.includes(':')) {
            return encryptedText;
        }

        const [ivHex, encrypted] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const key = Buffer.from(this.encryptionKey, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    // Create hash for integrity checking
    createHash(data) {
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }

    // User management
    async ensureUser(firebaseUid, email) {
        try {
            // First try to find user by firebase_uid
            let result = await this.pool.query(
                'SELECT id FROM users WHERE firebase_uid = $1',
                [firebaseUid]
            );

            if (result.rows.length > 0) {
                return result.rows[0].id;
            }

            // If not found by firebase_uid, try by email and update firebase_uid
            if (email) {
                result = await this.pool.query(
                    'SELECT id FROM users WHERE email = $1',
                    [email]
                );

                if (result.rows.length > 0) {
                    // Update existing user with firebase_uid
                    await this.pool.query(
                        'UPDATE users SET firebase_uid = $1 WHERE id = $2',
                        [firebaseUid, result.rows[0].id]
                    );
                    return result.rows[0].id;
                }
            }

            // Create new user
            const insertResult = await this.pool.query(
                'INSERT INTO users (firebase_uid, email, name, is_active, email_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [firebaseUid, email, email?.split('@')[0] || 'User', true, true]
            );

            return insertResult.rows[0].id;
        } catch (error) {
            console.error('Error ensuring user:', error);
            throw error;
        }
    }

    // Conversation management
    async ensureConversation(userId, conversationId) {
        try {
            // Look for existing conversation by title (using conversationId as title)
            const result = await this.pool.query(
                'SELECT id FROM conversations WHERE user_id = $1 AND title = $2',
                [userId, conversationId]
            );

            if (result.rows.length > 0) {
                return result.rows[0].id;
            }

            // Create new conversation
            const insertResult = await this.pool.query(
                'INSERT INTO conversations (user_id, title, description, is_archived, message_count, memory_count) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [userId, conversationId, `Conversation: ${conversationId}`, false, 0, 0]
            );

            return insertResult.rows[0].id;
        } catch (error) {
            console.error('Error ensuring conversation:', error);
            throw error;
        }
    }

    // User preferences
    async setUserPreference(firebaseUid, email, key, value) {
        try {
            console.log(`🔧 DB setUserPreference: uid=${firebaseUid}, email=${email}, key=${key}, value=${value}`);
            const dbUserId = await this.ensureUser(firebaseUid, email);
            console.log(`🔧 DB ensureUser returned: ${dbUserId}`);
            await this.pool.query(
                `INSERT INTO user_preferences (user_id, key, value, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (user_id, key)
                 DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [dbUserId, key, value]  // Let PostgreSQL JSONB handle JSON serialization automatically
            );
            console.log(`🔧 DB preference upsert completed for user ${dbUserId}`);
            await this.logAction(dbUserId, 'UPSERT', 'user_preference', null, null, null);
            return true;
        } catch (error) {
            console.error('❌ DB Error setting user preference:', error);
            throw error;
        }
    }

    async getUserPreference(firebaseUid, email, key) {
        try {
            console.log(`🔧 DB getUserPreference: uid=${firebaseUid}, email=${email}, key=${key}`);
            const dbUserId = await this.ensureUser(firebaseUid, email);
            console.log(`🔧 DB ensureUser returned: ${dbUserId}`);
            const result = await this.pool.query(
                'SELECT value FROM user_preferences WHERE user_id = $1 AND key = $2',
                [dbUserId, key]
            );
            console.log(`🔧 DB query result: ${result.rows.length} rows`);
            if (result.rows.length === 0) return null;
            
            // Handle both new JSONB format and legacy JSON.stringify format
            let value = result.rows[0].value;
            
            // If value is a string that looks like JSON-stringified data, parse it (legacy format)
            if (typeof value === 'string' && (value.startsWith('"') && value.endsWith('"'))) {
                try {
                    console.log(`🔧 DB detected legacy JSON string format, parsing: ${value}`);
                    value = JSON.parse(value);
                } catch (parseError) {
                    console.warn(`⚠️ DB failed to parse legacy JSON string: ${value}, using as-is`);
                    // Use the string value as-is if JSON parsing fails
                }
            }
            
            console.log(`🔧 DB returning value: ${value}`);
            return value;
        } catch (error) {
            console.error('❌ DB Error getting user preference:', error);
            throw error;
        }
    }

    // Audit logging
    async logAction(userId, action, resourceType, resourceId = null, ipAddress = null, userAgent = null) {
        try {
            await this.pool.query(
                'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
                [userId, action, resourceType, resourceId, ipAddress, userAgent]
            );
        } catch (error) {
            console.error('Error logging action:', error);
            // Don't throw - audit logging shouldn't break the main flow
        }
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = new Database();
