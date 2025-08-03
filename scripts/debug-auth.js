#!/usr/bin/env node

// Advanced debugging for Anthropic API authentication issues
require('dotenv').config();
const https = require('https');
const fs = require('fs');

async function debugAuthentication() {
    console.log('🔬 Advanced Anthropic API Authentication Debug');
    console.log('==============================================');
    
    // 1. Check SDK Version and Dependencies
    console.log('\n📦 SDK Version Check:');
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        console.log('Anthropic SDK version:', packageJson.dependencies['@anthropic-ai/sdk']);
        
        // Check if SDK is up to date
        const Anthropic = require('@anthropic-ai/sdk');
        console.log('SDK loaded successfully');
    } catch (error) {
        console.log('❌ SDK loading error:', error.message);
    }
    
    // 2. Environment Variable Deep Analysis
    console.log('\n🔍 Environment Variable Deep Analysis:');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
        console.log('❌ No API key found');
        return;
    }
    
    // Check for hidden characters
    const keyBytes = Buffer.from(apiKey, 'utf8');
    console.log('Key byte length:', keyBytes.length);
    console.log('Key string length:', apiKey.length);
    console.log('Contains non-ASCII:', /[^\x00-\x7F]/.test(apiKey));
    console.log('Contains whitespace:', /\s/.test(apiKey));
    console.log('Contains newlines:', /[\r\n]/.test(apiKey));
    
    // Show first and last few characters in hex
    console.log('First 20 bytes (hex):', keyBytes.slice(0, 20).toString('hex'));
    console.log('Last 20 bytes (hex):', keyBytes.slice(-20).toString('hex'));
    
    // 3. Raw HTTP Request Test (Bypass SDK)
    console.log('\n🌐 Raw HTTP Request Test (Bypassing SDK):');
    
    const postData = JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
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
            'anthropic-version': '2023-06-01',
            'User-Agent': 'vibe-agents/1.0.0'
        },
        timeout: 10000
    };
    
    console.log('Request headers:');
    console.log('  x-api-key:', apiKey.substring(0, 15) + '...' + apiKey.substring(apiKey.length - 10));
    console.log('  anthropic-version:', options.headers['anthropic-version']);
    console.log('  Content-Type:', options.headers['Content-Type']);
    
    try {
        const rawResponse = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                
                console.log('Response status:', res.statusCode);
                console.log('Response headers:', JSON.stringify(res.headers, null, 2));
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    resolve({ statusCode: res.statusCode, data, headers: res.headers });
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.write(postData);
            req.end();
        });
        
        console.log('✅ Raw HTTP request completed');
        console.log('Response body:', rawResponse.data);
        
        if (rawResponse.statusCode === 200) {
            console.log('🎉 Raw HTTP request succeeded! The issue might be with the SDK.');
        } else if (rawResponse.statusCode === 401) {
            console.log('❌ Raw HTTP request also failed with 401. This confirms authentication issue.');
            
            // Parse error response
            try {
                const errorData = JSON.parse(rawResponse.data);
                console.log('Error details:', JSON.stringify(errorData, null, 2));
            } catch (e) {
                console.log('Could not parse error response');
            }
        }
        
    } catch (error) {
        console.log('❌ Raw HTTP request failed:', error.message);
    }
    
    // 4. Test Different API Versions
    console.log('\n🔄 Testing Different API Versions:');
    const versions = ['2023-06-01', '2023-01-01'];
    
    for (const version of versions) {
        console.log(`Testing version: ${version}`);
        try {
            const testOptions = { ...options };
            testOptions.headers['anthropic-version'] = version;
            
            // Quick test with minimal request
            const result = await new Promise((resolve, reject) => {
                const req = https.request(testOptions, (res) => {
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
            
            console.log(`  Version ${version}: Status ${result.status}`);
            if (result.status === 200) {
                console.log(`  ✅ Version ${version} works!`);
                break;
            }
        } catch (error) {
            console.log(`  ❌ Version ${version} failed:`, error.message);
        }
    }
    
    // 5. Network/Proxy Detection
    console.log('\n🔍 Network/Proxy Detection:');
    console.log('HTTP_PROXY:', process.env.HTTP_PROXY || 'Not set');
    console.log('HTTPS_PROXY:', process.env.HTTPS_PROXY || 'Not set');
    console.log('NO_PROXY:', process.env.NO_PROXY || 'Not set');
    
    // 6. Recommendations
    console.log('\n💡 Troubleshooting Recommendations:');
    console.log('1. Try updating the Anthropic SDK: npm update @anthropic-ai/sdk');
    console.log('2. Check if you\'re behind a corporate firewall/proxy');
    console.log('3. Try generating a completely new API key');
    console.log('4. Verify your account has Claude 3.5 Sonnet access');
    console.log('5. Check if there are any account restrictions or billing issues');
    console.log('6. Try using a different network (mobile hotspot) to rule out network issues');
}

// Run the debug
debugAuthentication().catch(console.error);
