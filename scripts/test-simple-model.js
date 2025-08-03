#!/usr/bin/env node

// Test with the simplest possible Anthropic API call
require('dotenv').config();
const https = require('https');

async function testSimpleModel() {
    console.log('🧪 Testing Simplest Possible Anthropic API Call');
    console.log('===============================================');
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    // Try with the most basic Claude model and minimal request
    const models = [
        'claude-3-haiku-20240307',      // Cheapest/most basic
        'claude-3-sonnet-20240229',     // Mid-tier
        'claude-3-5-sonnet-20241022'    // Latest (what we've been trying)
    ];
    
    for (const model of models) {
        console.log(`\n🔍 Testing model: ${model}`);
        
        const postData = JSON.stringify({
            model: model,
            max_tokens: 5,  // Minimal tokens
            messages: [{ role: 'user', content: 'Hi' }]
        });
        
        const options = {
            hostname: 'api.anthropic.com',
            port: 443,
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            timeout: 10000
        };
        
        try {
            const result = await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => resolve({ status: res.statusCode, data }));
                });
                req.on('error', reject);
                req.setTimeout(5000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
                req.write(postData);
                req.end();
            });
            
            console.log(`  Status: ${result.status}`);
            
            if (result.status === 200) {
                console.log(`  ✅ SUCCESS! Model ${model} works!`);
                const response = JSON.parse(result.data);
                console.log(`  Response: ${response.content[0].text}`);
                return true;
            } else {
                console.log(`  ❌ Failed with status ${result.status}`);
                try {
                    const errorData = JSON.parse(result.data);
                    console.log(`  Error: ${errorData.error.message}`);
                    
                    // Specific error analysis
                    if (errorData.error.type === 'authentication_error') {
                        console.log('  🔑 Authentication error - API key issue');
                    } else if (errorData.error.type === 'permission_error') {
                        console.log('  🚫 Permission error - Model access restricted');
                    } else if (errorData.error.type === 'billing_error') {
                        console.log('  💳 Billing error - Payment/credits issue');
                    }
                } catch (e) {
                    console.log(`  Raw response: ${result.data}`);
                }
            }
        } catch (error) {
            console.log(`  ❌ Network error: ${error.message}`);
        }
    }
    
    console.log('\n📋 If all models failed with authentication errors:');
    console.log('1. Double-check the API key in Anthropic Console');
    console.log('2. Verify billing/payment method is valid');
    console.log('3. Check if Claude API access is enabled for your account');
    console.log('4. Look for any account restrictions or suspensions');
    console.log('5. Try creating a completely new API key');
    
    return false;
}

testSimpleModel().catch(console.error);
