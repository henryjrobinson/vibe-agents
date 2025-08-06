#!/usr/bin/env node

/**
 * Debug script to check Anthropic API key configuration
 */

// Load environment variables with .env file taking priority over system variables
require('dotenv').config({ override: true });

// Ensure we're using the correct .env file path (from project root)
const path = require('path');
require('dotenv').config({ 
    path: path.join(__dirname, '../.env'),
    override: true 
});

console.log('🔍 API Key Debug Information:');
console.log('================================');

console.log('1. System Environment Variable:');
console.log('   ANTHROPIC_API_KEY =', process.env.ANTHROPIC_API_KEY ? 
    `${process.env.ANTHROPIC_API_KEY.substring(0, 20)}...` : '(not set)');

console.log('\n2. .env File Loading:');
console.log('   NODE_ENV =', process.env.NODE_ENV);
console.log('   PORT =', process.env.PORT);

console.log('\n3. Anthropic SDK Test:');
try {
    const Anthropic = require('@anthropic-ai/sdk');
    
    console.log('   SDK loaded successfully');
    
    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    console.log('   Anthropic client created successfully');
    console.log('   API Key configured:', !!process.env.ANTHROPIC_API_KEY);
    
    // Test a simple API call
    console.log('\n4. Testing API Connection...');
    
    anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }]
    }).then(response => {
        console.log('   ✅ API connection successful!');
        console.log('   Response:', response.content[0].text);
    }).catch(error => {
        console.log('   ❌ API connection failed:');
        console.log('   Error:', error.message);
        console.log('   Error type:', error.constructor.name);
    });
    
} catch (error) {
    console.log('   ❌ SDK setup failed:', error.message);
}

console.log('\n5. Environment Variables Check:');
const relevantEnvVars = [
    'NODE_ENV',
    'ANTHROPIC_API_KEY',
    'JWT_SECRET',
    'DB_NAME'
];

relevantEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (varName === 'ANTHROPIC_API_KEY' && value) {
        console.log(`   ${varName} = ${value.substring(0, 20)}...`);
    } else {
        console.log(`   ${varName} = ${value || '(not set)'}`);
    }
});
