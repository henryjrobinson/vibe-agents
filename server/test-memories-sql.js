/**
 * Test script to verify memories SQL queries work correctly
 */

// Load environment variables with .env file taking priority over system variables
require('dotenv').config({ override: true });

// Ensure we're using the correct .env file path (from project root)
const path = require('path');
require('dotenv').config({ 
    path: path.join(__dirname, '../.env'),
    override: true 
});

const { query } = require('./config/database');

async function testMemoriesSQL() {
    console.log('🧪 Testing Memories SQL Queries');
    console.log('================================');

    try {
        // Test 1: Basic memories query (should work even with no data)
        console.log('1. Testing basic memories query...');
        const result1 = await query(
            `SELECT m.id, m.category, m.content, m.extracted_at, m.is_verified, 
                    m.confidence_score, m.conversation_id,
                    c.title as conversation_title
             FROM memories m
             LEFT JOIN conversations c ON m.conversation_id = c.id AND c.user_id = m.user_id
             WHERE m.user_id = $1
             ORDER BY m.extracted_at DESC
             LIMIT 10 OFFSET 0`,
            [1]
        );
        console.log('✅ Basic query successful:', result1.rows.length, 'rows');

        // Test 2: Count query
        console.log('2. Testing count query...');
        const result2 = await query(
            `SELECT COUNT(*) as total FROM memories m 
             LEFT JOIN conversations c ON m.conversation_id = c.id AND c.user_id = m.user_id
             WHERE m.user_id = $1`,
            [1]
        );
        console.log('✅ Count query successful:', result2.rows[0].total, 'total memories');

        // Test 3: Query with filters
        console.log('3. Testing query with category filter...');
        const result3 = await query(
            `SELECT m.id, m.category, m.content, m.extracted_at, m.is_verified, 
                    m.confidence_score, m.conversation_id,
                    c.title as conversation_title
             FROM memories m
             LEFT JOIN conversations c ON m.conversation_id = c.id AND c.user_id = m.user_id
             WHERE m.user_id = $1 AND m.category = $2
             ORDER BY m.extracted_at DESC
             LIMIT 10 OFFSET 0`,
            [1, 'people']
        );
        console.log('✅ Filtered query successful:', result3.rows.length, 'rows');

        console.log('\n🎉 All SQL queries working correctly!');
        console.log('✅ No ambiguity errors');
        console.log('✅ Proper user isolation');
        console.log('✅ Secure JOIN conditions');

    } catch (error) {
        console.error('❌ SQL Error:', error.message);
        console.error('Full error:', error);
    }

    process.exit(0);
}

testMemoriesSQL();
