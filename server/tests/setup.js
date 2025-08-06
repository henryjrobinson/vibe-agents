const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Test database configuration
const testDbConfig = {
    user: process.env.DB_USER || process.env.USER,
    host: process.env.DB_HOST || 'localhost',
    database: 'vibe_agents_test',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
};

let testPool;

// Setup test database before all tests
beforeAll(async () => {
    // Create test database if it doesn't exist
    const adminPool = new Pool({
        ...testDbConfig,
        database: 'postgres' // Connect to default database to create test database
    });

    try {
        await adminPool.query('CREATE DATABASE vibe_agents_test');
        console.log('✅ Test database created');
    } catch (error) {
        if (error.code !== '42P04') { // Database already exists
            console.error('❌ Error creating test database:', error);
            throw error;
        }
        console.log('📝 Test database already exists');
    } finally {
        await adminPool.end();
    }

    // Connect to test database
    testPool = new Pool(testDbConfig);

    // Apply schema to test database (drop existing tables first)
    try {
        // Drop all tables if they exist (in reverse dependency order)
        await testPool.query('DROP TABLE IF EXISTS memory_connections CASCADE');
        await testPool.query('DROP TABLE IF EXISTS memories CASCADE');
        await testPool.query('DROP TABLE IF EXISTS messages CASCADE');
        await testPool.query('DROP TABLE IF EXISTS conversations CASCADE');
        await testPool.query('DROP TABLE IF EXISTS user_sessions CASCADE');
        await testPool.query('DROP TABLE IF EXISTS magic_link_tokens CASCADE');
        await testPool.query('DROP TABLE IF EXISTS users CASCADE');
        
        // Drop functions if they exist
        await testPool.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');
        await testPool.query('DROP FUNCTION IF EXISTS update_conversation_message_count() CASCADE');
        await testPool.query('DROP FUNCTION IF EXISTS update_conversation_memory_count() CASCADE');
        await testPool.query('DROP FUNCTION IF EXISTS cleanup_expired_tokens_and_sessions() CASCADE');
        
        console.log('🧹 Existing test database objects dropped');
    } catch (error) {
        // Ignore errors if tables don't exist
        console.log('📝 No existing objects to drop');
    }
    
    // Apply fresh schema
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await testPool.query(schema);
    console.log('✅ Test database schema applied');

    // Override the database module to use test database
    const dbModule = require('../config/database');
    
    // Store original pool for restoration later
    const originalPool = dbModule.pool;
    const originalQuery = dbModule.query;
    
    // Override with test database connection - ensure all queries use the same pool
    dbModule.pool = testPool;
    dbModule.query = async (text, params) => {
        const start = Date.now();
        try {
            // Force all queries to use the same test pool connection
            const res = await testPool.query(text, params);
            const duration = Date.now() - start;
            // Reduced logging for tests
            if (process.env.TEST_DEBUG) {
                console.log('📊 Test Query executed', { text: text.substring(0, 30) + '...', duration, rows: res.rowCount });
            }
            return res;
        } catch (error) {
            console.error('❌ Test Database query error:', error);
            throw error;
        }
    };
    
    // Also override the pool property to ensure consistency
    Object.defineProperty(dbModule, 'pool', {
        value: testPool,
        writable: false,
        configurable: false
    });
    
    console.log('🔄 Database connection overridden for tests');
    
    // Store references for cleanup
    global.originalDbPool = originalPool;
    global.originalDbQuery = originalQuery;
});

// Clean up test database after each test
afterEach(async () => {
    if (testPool) {
        try {
            // Use TRUNCATE with CASCADE for complete cleanup
            await testPool.query('TRUNCATE TABLE memory_connections, memories, messages, conversations, user_sessions, magic_link_tokens, users RESTART IDENTITY CASCADE');
            
            if (process.env.TEST_DEBUG) {
                console.log('🧹 Test database truncated and sequences reset');
            }
        } catch (error) {
            console.warn('⚠️ Warning: Failed to truncate test database:', error.message);
            // Fallback to DELETE if TRUNCATE fails
            try {
                await testPool.query('DELETE FROM memory_connections');
                await testPool.query('DELETE FROM memories');
                await testPool.query('DELETE FROM messages');
                await testPool.query('DELETE FROM conversations');
                await testPool.query('DELETE FROM user_sessions');
                await testPool.query('DELETE FROM magic_link_tokens');
                await testPool.query('DELETE FROM users');
                console.log('🧹 Test database cleaned with DELETE fallback');
            } catch (fallbackError) {
                console.error('❌ Failed to clean test database:', fallbackError.message);
            }
        }
    }
});

// Cleanup after all tests
afterAll(async () => {
    if (testPool) {
        try {
            await testPool.end();
            console.log('✅ Test database connection closed');
        } catch (error) {
            console.warn('⚠️ Warning: Failed to close test database connection:', error.message);
        }
    }
    
    // Also close the main database connection if it exists
    const db = require('../config/database');
    if (db && db.pool) {
        try {
            await db.pool.end();
            console.log('✅ Main database connection closed');
        } catch (error) {
            console.warn('⚠️ Warning: Failed to close main database connection:', error.message);
        }
    }
});

// Test utilities
global.testUtils = {
    // Create a test user
    createTestUser: async (email = 'test@example.com', name = 'Test User') => {
        const result = await testPool.query(
            'INSERT INTO users (email, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
            [email, name]
        );
        return result.rows[0];
    },

    // Create a magic link token
    createMagicLinkToken: async (email, token = 'test_token_' + Date.now()) => {
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        const result = await testPool.query(
            'INSERT INTO magic_link_tokens (email, token, expires_at) VALUES ($1, $2, $3) RETURNING *',
            [email, token, expiresAt]
        );
        return result.rows[0];
    },

    // Create a user session
    createUserSession: async (userId, sessionToken = null) => {
        // Generate proper JWT token if not provided
        if (!sessionToken) {
            const { generateJWT } = require('../utils/auth');
            sessionToken = generateJWT({ userId, type: 'session' });
        }
        
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        const result = await testPool.query(
            'INSERT INTO user_sessions (user_id, session_token, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, sessionToken, expiresAt, 'Test User Agent', '127.0.0.1']
        );
        
        return result.rows[0];
    },

    // Get database pool for direct queries
    getPool: () => testPool,

    // Wait for a specified amount of time
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only';
process.env.EMAIL_SERVICE = 'test'; // Disable real email sending in tests
