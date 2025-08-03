#!/usr/bin/env node

// Comprehensive Anthropic API diagnostics
require('dotenv').config();
const https = require('https');

async function diagnoseAnthropicAPI() {
    console.log('🔍 Comprehensive Anthropic API Diagnostics');
    console.log('==========================================');
    
    // 1. Environment Check
    console.log('\n📋 Environment Check:');
    console.log('Node.js version:', process.version);
    console.log('Working directory:', process.cwd());
    console.log('.env file exists:', require('fs').existsSync('.env'));
    
    // 2. API Key Analysis
    console.log('\n🔑 API Key Analysis:');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
        console.log('❌ No API key found in environment');
        return;
    }
    
    console.log('✅ API key found');
    console.log('Key length:', apiKey.length);
    console.log('Key starts with:', apiKey.substring(0, 15) + '...');
    console.log('Key ends with:', '...' + apiKey.substring(apiKey.length - 10));
    
    // Check for common issues
    if (apiKey.includes(' ')) {
        console.log('⚠️  WARNING: API key contains spaces');
    }
    if (apiKey.includes('\n') || apiKey.includes('\r')) {
        console.log('⚠️  WARNING: API key contains newline characters');
    }
    if (!apiKey.startsWith('sk-ant-')) {
        console.log('⚠️  WARNING: API key doesn\'t start with expected prefix');
    }
    
    // 3. Network Connectivity Test
    console.log('\n🌐 Network Connectivity Test:');
    try {
        await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.anthropic.com',
                port: 443,
                path: '/v1/messages',
                method: 'HEAD',
                timeout: 5000
            }, (res) => {
                console.log('✅ Can reach api.anthropic.com');
                console.log('Response status:', res.statusCode);
                resolve();
            });
            
            req.on('error', (error) => {
                console.log('❌ Cannot reach api.anthropic.com:', error.message);
                reject(error);
            });
            
            req.on('timeout', () => {
                console.log('❌ Timeout connecting to api.anthropic.com');
                req.destroy();
                reject(new Error('Timeout'));
            });
            
            req.end();
        });
    } catch (error) {
        console.log('Network test failed:', error.message);
    }
    
    // 4. API Authentication Test
    console.log('\n🔐 API Authentication Test:');
    try {
        const Anthropic = require('@anthropic-ai/sdk');
        const anthropic = new Anthropic({
            apiKey: apiKey,
        });
        
        console.log('📡 Attempting API call...');
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 10,
            system: 'Respond with "OK"',
            messages: [{ role: 'user', content: 'Test' }]
        });
        
        console.log('✅ API call successful!');
        console.log('Response:', response.content[0].text);
        
    } catch (error) {
        console.log('❌ API call failed');
        console.log('Error type:', error.constructor.name);
        console.log('Status code:', error.status);
        console.log('Error message:', error.message);
        
        // Detailed error analysis
        if (error.status === 401) {
            console.log('\n🔍 401 Authentication Error Analysis:');
            console.log('   • API key is invalid, expired, or malformed');
            console.log('   • Account may be suspended or have billing issues');
            console.log('   • API key may not have Claude access permissions');
            console.log('   • Check: https://console.anthropic.com/');
        } else if (error.status === 403) {
            console.log('\n🔍 403 Forbidden Error Analysis:');
            console.log('   • Account may have insufficient permissions');
            console.log('   • Usage limits may be exceeded');
            console.log('   • Billing issues may prevent API access');
        } else if (error.status === 429) {
            console.log('\n🔍 429 Rate Limit Error Analysis:');
            console.log('   • Too many requests - try again later');
            console.log('   • Account may have hit usage limits');
        }
        
        // Raw error details for debugging
        console.log('\n🐛 Raw Error Details:');
        console.log(JSON.stringify({
            name: error.name,
            message: error.message,
            status: error.status,
            code: error.code,
            type: error.type
        }, null, 2));
    }
    
    console.log('\n📋 Next Steps:');
    console.log('1. Visit https://console.anthropic.com/');
    console.log('2. Check API key status and permissions');
    console.log('3. Verify billing and usage limits');
    console.log('4. Generate a new API key if needed');
    console.log('5. Ensure Claude 3.5 Sonnet access is enabled');
}

// Run diagnostics
diagnoseAnthropicAPI().catch(console.error);
