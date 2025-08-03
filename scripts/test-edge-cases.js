#!/usr/bin/env node

// Test edge cases that could cause authentication failures
require('dotenv').config();
const https = require('https');
const fs = require('fs');

async function testEdgeCases() {
    console.log('🔬 Testing Edge Cases for Anthropic API Authentication');
    console.log('====================================================');
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    // 1. Test if the key works with curl (system-level test)
    console.log('\n🌐 Testing with curl (system-level):');
    try {
        const { exec } = require('child_process');
        const curlResult = await new Promise((resolve, reject) => {
            const curlCmd = `curl -s -w "HTTP_STATUS:%{http_code}" -X POST https://api.anthropic.com/v1/messages \\
                -H "Content-Type: application/json" \\
                -H "x-api-key: ${apiKey}" \\
                -H "anthropic-version: 2023-06-01" \\
                -d '{"model":"claude-3-haiku-20240307","max_tokens":5,"messages":[{"role":"user","content":"Hi"}]}'`;
            
            exec(curlCmd, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
        
        console.log('Curl output:', curlResult.stdout);
        if (curlResult.stderr) {
            console.log('Curl errors:', curlResult.stderr);
        }
        
        if (curlResult.stdout.includes('HTTP_STATUS:200')) {
            console.log('✅ Curl succeeded! The issue might be Node.js specific.');
        } else if (curlResult.stdout.includes('HTTP_STATUS:401')) {
            console.log('❌ Curl also failed with 401. Confirms API key issue.');
        }
        
    } catch (error) {
        console.log('❌ Curl test failed:', error.message);
    }
    
    // 2. Test with different User-Agent strings
    console.log('\n🤖 Testing Different User-Agent Strings:');
    const userAgents = [
        'curl/7.68.0',
        'Mozilla/5.0 (compatible; Anthropic-Test/1.0)',
        '@anthropic-ai/sdk/0.24.3',
        undefined  // No User-Agent header
    ];
    
    for (const userAgent of userAgents) {
        console.log(`Testing User-Agent: ${userAgent || 'None'}`);
        
        const postData = JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Hi' }]
        });
        
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        };
        
        if (userAgent) {
            headers['User-Agent'] = userAgent;
        }
        
        try {
            const result = await new Promise((resolve, reject) => {
                const req = https.request({
                    hostname: 'api.anthropic.com',
                    port: 443,
                    path: '/v1/messages',
                    method: 'POST',
                    headers: headers,
                    timeout: 5000
                }, (res) => {
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
                console.log(`  ✅ SUCCESS with User-Agent: ${userAgent || 'None'}`);
                return true;
            }
        } catch (error) {
            console.log(`  ❌ Failed: ${error.message}`);
        }
    }
    
    // 3. Test with exact SDK headers
    console.log('\n📦 Testing with Exact SDK Headers:');
    try {
        // Load the actual Anthropic SDK and inspect what headers it sends
        const Anthropic = require('@anthropic-ai/sdk');
        
        // Create a mock request to see what the SDK would send
        console.log('SDK version from package:', require('@anthropic-ai/sdk/package.json').version);
        
        // Try to make a request but intercept the headers
        const anthropic = new Anthropic({
            apiKey: apiKey,
        });
        
        // This will fail, but we can see what it tries to send
        try {
            await anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 5,
                messages: [{ role: 'user', content: 'Hi' }]
            });
        } catch (sdkError) {
            console.log('SDK error (expected):', sdkError.message);
            
            // Check if it's the same error we've been seeing
            if (sdkError.message.includes('invalid x-api-key')) {
                console.log('✅ SDK produces identical error - confirms consistency');
            }
        }
        
    } catch (error) {
        console.log('❌ SDK inspection failed:', error.message);
    }
    
    // 4. Test API key format variations
    console.log('\n🔑 Testing API Key Format Variations:');
    
    // Test with trimmed key (remove any potential whitespace)
    const trimmedKey = apiKey.trim();
    if (trimmedKey !== apiKey) {
        console.log('⚠️  Key had whitespace that was trimmed');
        // Test with trimmed version
        // ... (test code similar to above)
    } else {
        console.log('✅ Key has no extra whitespace');
    }
    
    // 5. Test with a completely different approach - try the Anthropic Messages API directly
    console.log('\n🔄 Testing Alternative API Approach:');
    
    // Try with minimal headers
    const minimalPostData = JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'test' }]
    });
    
    try {
        const result = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.anthropic.com',
                port: 443,
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                    // Minimal headers only
                },
                timeout: 10000
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    console.log('Response headers:', JSON.stringify(res.headers, null, 2));
                    resolve({ status: res.statusCode, data, headers: res.headers });
                });
            });
            req.on('error', reject);
            req.write(minimalPostData);
            req.end();
        });
        
        console.log('Minimal request status:', result.status);
        console.log('Response body:', result.data);
        
        if (result.status === 200) {
            console.log('✅ Minimal request succeeded!');
            return true;
        }
        
    } catch (error) {
        console.log('❌ Minimal request failed:', error.message);
    }
    
    console.log('\n🤔 If all tests failed, possible remaining causes:');
    console.log('1. API key was copied incorrectly (invisible characters)');
    console.log('2. Anthropic API is having issues with your specific key');
    console.log('3. There\'s a timing/synchronization issue with key activation');
    console.log('4. Regional restrictions we haven\'t detected');
    console.log('5. Anthropic\'s API has changed in a way our SDK doesn\'t handle');
    
    console.log('\n💡 Next steps:');
    console.log('1. Try copying the API key again (fresh copy/paste)');
    console.log('2. Generate a completely new API key');
    console.log('3. Contact Anthropic support with these test results');
    console.log('4. Try from a different network/location');
}

testEdgeCases().catch(console.error);
