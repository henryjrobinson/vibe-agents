#!/usr/bin/env node

/**
 * Enhanced Authentication Debug Program
 * 
 * This program replicates the exact test environment setup to identify
 * why the authentication works in isolation but fails in the test suite.
 */

require('dotenv').config();
const { Pool } = require('pg');

// Database configuration matching test setup
const testDbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'vibe_agents_test',
    user: process.env.DB_USER || process.env.USER || 'henryrobinson',
    password: process.env.DB_PASSWORD || '',
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

let testPool;

async function setupTestEnvironment() {
    console.log('🔧 Setting up test environment exactly like Jest tests...');
    
    // Create test pool
    testPool = new Pool(testDbConfig);
    
    // Clean database
    await testPool.query('TRUNCATE TABLE user_sessions, users RESTART IDENTITY CASCADE');
    
    // Override database module exactly like test setup
    const dbModule = require('./config/database');
    
    // Store original
    const originalPool = dbModule.pool;
    const originalQuery = dbModule.query;
    
    // Override with test database connection
    dbModule.pool = testPool;
    dbModule.query = async (text, params) => {
        const start = Date.now();
        try {
            const res = await testPool.query(text, params);
            const duration = Date.now() - start;
            console.log(`🔍 DB Query: ${text.substring(0, 50)}... | ${duration}ms | ${res.rowCount} rows`);
            return res;
        } catch (error) {
            console.error('❌ DB Query Error:', error.message);
            throw error;
        }
    };
    
    // Force pool property override
    Object.defineProperty(dbModule, 'pool', {
        value: testPool,
        writable: false,
        configurable: false
    });
    
    console.log('✅ Database module overridden for test environment');
    
    return { originalPool, originalQuery };
}

async function createTestUserAndSession() {
    console.log('\n👤 Creating test user and session...');
    
    // Create user
    const userResult = await testPool.query(
        'INSERT INTO users (email, name, is_active) VALUES ($1, $2, $3) RETURNING *',
        ['test@example.com', 'Test User', true]
    );
    const user = userResult.rows[0];
    console.log(`✅ User created: ID=${user.id}, Email=${user.email}`);
    
    // Create session using test utility approach
    const { generateJWT } = require('./utils/auth');
    const sessionToken = generateJWT({ userId: user.id, type: 'session' });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    const sessionResult = await testPool.query(
        'INSERT INTO user_sessions (user_id, session_token, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [user.id, sessionToken, expiresAt, 'Test User Agent', '127.0.0.1']
    );
    const session = sessionResult.rows[0];
    
    console.log(`✅ Session created: ID=${session.id}, Token=${sessionToken.substring(0, 50)}...`);
    
    return { user, session };
}

async function testAuthenticationMiddleware(sessionToken) {
    console.log('\n🔐 Testing authentication middleware logic...');
    
    // Import and test the verifyUserSession function
    const { verifyUserSession } = require('./utils/auth');
    
    try {
        const result = await verifyUserSession(sessionToken);
        console.log('✅ verifyUserSession succeeded:', result);
        return result;
    } catch (error) {
        console.error('❌ verifyUserSession failed:', error.message);
        return null;
    }
}

async function testDirectDatabaseAccess(sessionToken, userId) {
    console.log('\n🔍 Testing direct database access...');
    
    // Test the exact query from verifyUserSession
    const result = await testPool.query(
        'SELECT us.*, u.email, u.name, u.is_active FROM user_sessions us JOIN users u ON us.user_id = u.id WHERE us.session_token = $1 AND us.expires_at > NOW() AND us.user_id = $2',
        [sessionToken, userId]
    );
    
    console.log(`📊 Direct query result: ${result.rows.length} rows`);
    if (result.rows.length > 0) {
        console.log('✅ Direct query found session:', result.rows[0]);
    } else {
        console.log('❌ Direct query found no sessions');
    }
    
    return result.rows;
}

async function testSessionVisibility(sessionToken) {
    console.log('\n👁️ Testing session visibility across connections...');
    
    // Check what sessions exist
    const allSessions = await testPool.query('SELECT id, user_id, session_token, expires_at FROM user_sessions');
    console.log(`📊 Total sessions in database: ${allSessions.rows.length}`);
    
    if (allSessions.rows.length > 0) {
        console.log('📋 Sessions found:');
        allSessions.rows.forEach((session, index) => {
            console.log(`  ${index + 1}. ID=${session.id}, UserID=${session.user_id}, Token=${session.session_token.substring(0, 50)}...`);
        });
    }
    
    // Test if our specific session exists
    const specificSession = await testPool.query(
        'SELECT * FROM user_sessions WHERE session_token = $1',
        [sessionToken]
    );
    
    console.log(`🎯 Our specific session found: ${specificSession.rows.length > 0 ? '✅' : '❌'}`);
    
    return specificSession.rows;
}

async function runEnhancedDebugTest() {
    try {
        console.log('🚀 Starting Enhanced Authentication Debug Test\n');
        
        // Setup test environment
        const { originalPool, originalQuery } = await setupTestEnvironment();
        
        // Create test data
        const { user, session } = await createTestUserAndSession();
        
        // Test session visibility
        const visibilityResult = await testSessionVisibility(session.session_token);
        
        // Test authentication middleware
        const authResult = await testAuthenticationMiddleware(session.session_token);
        
        // Test direct database access
        const directResult = await testDirectDatabaseAccess(session.session_token, user.id);
        
        // Summary
        console.log('\n📊 ENHANCED DEBUG SUMMARY:');
        console.log('==========================');
        console.log(`Database setup: ✅`);
        console.log(`User created: ✅`);
        console.log(`Session created: ✅`);
        console.log(`Session visibility: ${visibilityResult.length > 0 ? '✅' : '❌'}`);
        console.log(`Authentication middleware: ${authResult ? '✅' : '❌'}`);
        console.log(`Direct database query: ${directResult.length > 0 ? '✅' : '❌'}`);
        
        if (visibilityResult.length > 0 && authResult && directResult.length === 0) {
            console.log('\n🔍 DIAGNOSIS:');
            console.log('Session exists and auth middleware works, but direct query fails.');
            console.log('This suggests a query condition or parameter issue.');
        }
        
    } catch (error) {
        console.error('💥 Enhanced debug test failed:', error);
    } finally {
        if (testPool) {
            await testPool.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run the enhanced debug test
if (require.main === module) {
    runEnhancedDebugTest().catch(console.error);
}

module.exports = { runEnhancedDebugTest };
