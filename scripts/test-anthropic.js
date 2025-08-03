#!/usr/bin/env node

// Test Anthropic API connection before starting the server
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

async function testAnthropicConnection() {
    console.log('🔍 Testing Anthropic API connection...');
    
    // Check if API key exists
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
        console.error('   Please check your .env file');
        process.exit(1);
    }
    
    // Check API key format
    if (!process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
        console.error('❌ Invalid Anthropic API key format');
        console.error('   API key should start with "sk-ant-"');
        console.error('   Current key starts with:', process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...');
        process.exit(1);
    }
    
    console.log('✅ API key format looks correct');
    console.log('🔑 Key starts with:', process.env.ANTHROPIC_API_KEY.substring(0, 15) + '...');
    
    // Initialize Anthropic client
    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    try {
        console.log('🌐 Testing connection to Claude...');
        
        // Make a simple test call
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 50,
            system: 'You are a helpful assistant. Respond with exactly: "Anthropic connection successful!"',
            messages: [
                {
                    role: 'user',
                    content: 'Test connection'
                }
            ]
        });
        
        const responseText = response.content[0].text.trim();
        console.log('📨 Claude response:', responseText);
        
        if (responseText.includes('Anthropic connection successful')) {
            console.log('✅ Anthropic API connection verified!');
            console.log('🤖 Claude 3.5 Sonnet is ready for story collection');
            return true;
        } else {
            console.log('⚠️  Unexpected response from Claude:', responseText);
            console.log('✅ Connection works but response format differs');
            return true;
        }
        
    } catch (error) {
        console.error('❌ Anthropic API connection failed:');
        
        if (error.status === 401) {
            console.error('   🔑 Authentication failed - Invalid API key');
            console.error('   Please check your Anthropic API key in .env file');
        } else if (error.status === 429) {
            console.error('   🚫 Rate limit exceeded - Please try again later');
        } else if (error.status === 500) {
            console.error('   🔧 Anthropic server error - Please try again later');
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            console.error('   🌐 Network connection failed - Check your internet connection');
        } else {
            console.error('   📋 Error details:', error.message);
            console.error('   📊 Status:', error.status);
            console.error('   🔍 Code:', error.code);
        }
        
        process.exit(1);
    }
}

// Run the test if this script is executed directly
if (require.main === module) {
    testAnthropicConnection()
        .then(() => {
            console.log('🎉 All tests passed! Ready to start the server.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Test failed:', error.message);
            process.exit(1);
        });
}

module.exports = testAnthropicConnection;
