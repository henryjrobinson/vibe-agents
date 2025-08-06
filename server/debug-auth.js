#!/usr/bin/env node

/**
 * Standalone Authentication Debug Program
 * 
 * This program isolates the authentication/session issue to identify the root cause
 * without the complexity of the full test suite.
 */

require('dotenv').config();
const { Pool } = require('pg');

// Import our auth utilities
const { 
    generateJWT, 
    verifyJWT, 
    createUserSession, 
    verifyUserSession,
    isValidEmail 
} = require('./utils/auth');

// Database configuration for test database
const testDbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'vibe_agents_test', // Use test database
    user: process.env.DB_USER || process.env.USER || 'henryrobinson', // Use system user if DB_USER not set
    password: process.env.DB_PASSWORD || '', // Empty password for local development
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

console.log('🔧 Database config:', {
    host: testDbConfig.host,
    port: testDbConfig.port,
    database: testDbConfig.database,
    user: testDbConfig.user
});

let pool;

// Override the database query function to use our test pool
const originalQuery = require('./config/database').query;
require('./config/database').query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log(`🔍 Query: ${text.substring(0, 50)}... | Duration: ${duration}ms | Rows: ${res.rowCount}`);
        return res;
    } catch (error) {
        console.error('❌ Query Error:', error.message);
        throw error;
    }
};

async function setupDatabase() {
    console.log('🔧 Setting up test database...');
    
    // Connect to test database
    pool = new Pool(testDbConfig);
    
    // Clean up any existing data
    try {
        await pool.query('TRUNCATE TABLE user_sessions, users RESTART IDENTITY CASCADE');
        console.log('✅ Test database cleaned');
    } catch (error) {
        console.log('📝 No existing data to clean');
    }
}

async function createTestUser() {
    console.log('\n👤 Creating test user...');
    
    const email = 'debug@example.com';
    const name = 'Debug User';
    
    const result = await pool.query(
        'INSERT INTO users (email, name, is_active) VALUES ($1, $2, $3) RETURNING *',
        [email, name, true]
    );
    
    const user = result.rows[0];
    console.log(`✅ Created user: ID=${user.id}, Email=${user.email}`);
    return user;
}

async function testJWTGeneration() {
    console.log('\n🔐 Testing JWT generation and verification...');
    
    const payload = { userId: 1, type: 'session' };
    
    // Generate JWT
    const token = generateJWT(payload);
    console.log(`✅ Generated JWT: ${token.substring(0, 50)}...`);
    
    // Verify JWT
    const decoded = verifyJWT(token);
    console.log(`✅ Decoded JWT:`, decoded);
    
    return token;
}

async function testSessionCreation(userId) {
    console.log('\n📝 Testing session creation...');
    
    const userAgent = 'Debug Test Agent';
    const ipAddress = '127.0.0.1';
    
    // Create session using our utility function
    const session = await createUserSession(userId, userAgent, ipAddress);
    console.log(`✅ Created session:`, {
        id: session.id,
        user_id: session.user_id,
        token_start: session.session_token.substring(0, 50) + '...',
        expires_at: session.expires_at
    });
    
    return session;
}

async function testSessionLookup(sessionToken) {
    console.log('\n🔍 Testing session lookup...');
    
    // First, let's see what's in the database
    const allSessions = await pool.query('SELECT id, user_id, session_token, expires_at FROM user_sessions');
    console.log(`📊 Sessions in database: ${allSessions.rows.length}`);
    
    if (allSessions.rows.length > 0) {
        console.log(`📋 First session:`, {
            id: allSessions.rows[0].id,
            user_id: allSessions.rows[0].user_id,
            token_start: allSessions.rows[0].session_token.substring(0, 50) + '...',
            expires_at: allSessions.rows[0].expires_at
        });
    }
    
    // Now test our verification function
    try {
        const result = await verifyUserSession(sessionToken);
        console.log(`✅ Session verification successful:`, result);
        return result;
    } catch (error) {
        console.error(`❌ Session verification failed:`, error.message);
        return null;
    }
}

async function testDirectDatabaseQuery(sessionToken, userId) {
    console.log('\n🔎 Testing direct database query...');
    
    // Test the exact query used in verifyUserSession
    const result = await pool.query(
        'SELECT us.*, u.email, u.name, u.is_active FROM user_sessions us JOIN users u ON us.user_id = u.id WHERE us.session_token = $1 AND us.expires_at > NOW() AND us.user_id = $2',
        [sessionToken, userId]
    );
    
    console.log(`📊 Direct query result: ${result.rows.length} rows`);
    if (result.rows.length > 0) {
        console.log(`📋 Query result:`, result.rows[0]);
    }
    
    return result.rows;
}

async function runDebugTest() {
    try {
        console.log('🚀 Starting Authentication Debug Test\n');
        
        // Setup
        await setupDatabase();
        
        // Create test user
        const user = await createTestUser();
        
        // Test JWT functionality
        const testToken = await testJWTGeneration();
        
        // Create session
        const session = await testSessionCreation(user.id);
        
        // Test session lookup
        const verificationResult = await testSessionLookup(session.session_token);
        
        // Test direct database query
        const directQueryResult = await testDirectDatabaseQuery(session.session_token, user.id);
        
        // Summary
        console.log('\n📊 DEBUG SUMMARY:');
        console.log('================');
        console.log(`User created: ${user ? '✅' : '❌'}`);
        console.log(`JWT generation: ${testToken ? '✅' : '❌'}`);
        console.log(`Session created: ${session ? '✅' : '❌'}`);
        console.log(`Session verification: ${verificationResult ? '✅' : '❌'}`);
        console.log(`Direct query: ${directQueryResult.length > 0 ? '✅' : '❌'}`);
        
        if (!verificationResult && directQueryResult.length === 0) {
            console.log('\n🔍 ROOT CAUSE ANALYSIS:');
            console.log('The session is being created but not found during lookup.');
            console.log('This suggests either:');
            console.log('1. Database connection/transaction issue');
            console.log('2. Token mismatch between creation and lookup');
            console.log('3. Query condition issue (expires_at, user_id mismatch)');
        }
        
    } catch (error) {
        console.error('💥 Debug test failed:', error);
    } finally {
        if (pool) {
            await pool.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run the debug test
if (require.main === module) {
    runDebugTest().catch(console.error);
}

module.exports = { runDebugTest };
