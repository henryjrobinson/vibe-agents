#!/usr/bin/env node

// Exhaustive Anthropic API debugging - testing every possible angle
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function exhaustiveDebug() {
    console.log('🔬 EXHAUSTIVE Anthropic API Debug - Testing Every Possible Angle');
    console.log('================================================================');
    
    // 1. Environment and File System Analysis
    console.log('\n📁 Environment and File System Analysis:');
    console.log('Current working directory:', process.cwd());
    console.log('Script location:', __filename);
    console.log('Node.js version:', process.version);
    console.log('Platform:', process.platform);
    console.log('Architecture:', process.arch);
    
    // Check all possible .env file locations
    const envPaths = [
        '.env',
        './.env',
        path.join(process.cwd(), '.env'),
        path.join(__dirname, '..', '.env')
    ];
    
    console.log('\n🔍 Checking all possible .env file locations:');
    for (const envPath of envPaths) {
        const exists = fs.existsSync(envPath);
        console.log(`  ${envPath}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
        if (exists) {
            const stats = fs.statSync(envPath);
            console.log(`    Size: ${stats.size} bytes`);
            console.log(`    Modified: ${stats.mtime}`);
        }
    }
    
    // 2. Multiple Environment Loading Methods
    console.log('\n🔄 Testing Multiple Environment Loading Methods:');
    
    // Method 1: Standard dotenv
    require('dotenv').config();
    const key1 = process.env.ANTHROPIC_API_KEY;
    console.log('Method 1 (standard dotenv):', key1 ? `Found (${key1.length} chars)` : 'NOT FOUND');
    
    // Method 2: Explicit path
    require('dotenv').config({ path: '.env' });
    const key2 = process.env.ANTHROPIC_API_KEY;
    console.log('Method 2 (explicit path):', key2 ? `Found (${key2.length} chars)` : 'NOT FOUND');
    
    // Method 3: Manual file reading
    try {
        const envContent = fs.readFileSync('.env', 'utf8');
        const lines = envContent.split('\n');
        let key3 = null;
        for (const line of lines) {
            if (line.startsWith('ANTHROPIC_API_KEY=')) {
                key3 = line.split('=')[1];
                break;
            }
        }
        console.log('Method 3 (manual parsing):', key3 ? `Found (${key3.length} chars)` : 'NOT FOUND');
        
        // Compare keys from different methods
        if (key1 && key3) {
            console.log('Keys match between methods:', key1 === key3 ? '✅ YES' : '❌ NO');
            if (key1 !== key3) {
                console.log('Key1 (dotenv):', key1.substring(0, 20) + '...');
                console.log('Key3 (manual):', key3.substring(0, 20) + '...');
            }
        }
    } catch (error) {
        console.log('Method 3 (manual parsing): ERROR -', error.message);
    }
    
    // 3. Deep API Key Analysis
    console.log('\n🔑 Deep API Key Analysis:');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
        console.log('❌ No API key found - cannot continue');
        return;
    }
    
    console.log('Key length:', apiKey.length);
    console.log('Key type:', typeof apiKey);
    console.log('Key starts with:', apiKey.substring(0, 20));
    console.log('Key ends with:', apiKey.substring(apiKey.length - 20));
    
    // Check for invisible characters
    const keyBuffer = Buffer.from(apiKey, 'utf8');
    console.log('Buffer length:', keyBuffer.length);
    console.log('String length:', apiKey.length);
    console.log('Lengths match:', keyBuffer.length === apiKey.length ? '✅ YES' : '❌ NO');
    
    // Check for specific problematic characters
    const problematicChars = ['\r', '\n', '\t', ' ', '\u00A0', '\uFEFF'];
    for (const char of problematicChars) {
        if (apiKey.includes(char)) {
            console.log(`⚠️  Contains ${char.charCodeAt(0)} (${char === ' ' ? 'space' : char === '\r' ? 'CR' : char === '\n' ? 'LF' : char === '\t' ? 'tab' : 'other'})`);
        }
    }
    
    // Generate hash for comparison
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    console.log('Key hash (for comparison):', keyHash.substring(0, 16) + '...');
    
    // 4. Test Different SDK Versions and Configurations
    console.log('\n📦 SDK Version and Configuration Testing:');
    
    try {
        const anthropicPkg = require('@anthropic-ai/sdk/package.json');
        console.log('SDK version:', anthropicPkg.version);
    } catch (error) {
        console.log('Cannot read SDK version:', error.message);
    }
    
    // Test different SDK initialization methods
    const Anthropic = require('@anthropic-ai/sdk');
    
    // Method 1: Standard initialization
    try {
        const client1 = new Anthropic({
            apiKey: apiKey
        });
        console.log('SDK init method 1: ✅ SUCCESS');
    } catch (error) {
        console.log('SDK init method 1: ❌ FAILED -', error.message);
    }
    
    // Method 2: With explicit base URL
    try {
        const client2 = new Anthropic({
            apiKey: apiKey,
            baseURL: 'https://api.anthropic.com'
        });
        console.log('SDK init method 2 (explicit baseURL): ✅ SUCCESS');
    } catch (error) {
        console.log('SDK init method 2 (explicit baseURL): ❌ FAILED -', error.message);
    }
    
    // Method 3: With timeout settings
    try {
        const client3 = new Anthropic({
            apiKey: apiKey,
            timeout: 30000
        });
        console.log('SDK init method 3 (with timeout): ✅ SUCCESS');
    } catch (error) {
        console.log('SDK init method 3 (with timeout): ❌ FAILED -', error.message);
    }
    
    // 5. Network and DNS Testing
    console.log('\n🌐 Network and DNS Testing:');
    
    // DNS resolution test
    const dns = require('dns');
    try {
        const addresses = await new Promise((resolve, reject) => {
            dns.resolve4('api.anthropic.com', (err, addresses) => {
                if (err) reject(err);
                else resolve(addresses);
            });
        });
        console.log('DNS resolution for api.anthropic.com:', addresses);
    } catch (error) {
        console.log('DNS resolution failed:', error.message);
    }
    
    // Test different request methods
    console.log('\n📡 Testing Different Request Methods:');
    
    const testPayload = {
        model: 'claude-3-haiku-20240307',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'test' }]
    };
    
    // Method 1: Node.js https module (our current method)
    console.log('\n🔧 Method 1: Node.js HTTPS module');
    try {
        const result1 = await testWithNodeHttps(apiKey, testPayload);
        console.log('Result:', result1.status, result1.data.substring(0, 100));
    } catch (error) {
        console.log('Failed:', error.message);
    }
    
    // Method 2: Using fetch (if available)
    if (typeof fetch !== 'undefined' || global.fetch) {
        console.log('\n🔧 Method 2: Fetch API');
        try {
            const result2 = await testWithFetch(apiKey, testPayload);
            console.log('Result:', result2.status, await result2.text().then(t => t.substring(0, 100)));
        } catch (error) {
            console.log('Failed:', error.message);
        }
    }
    
    // Method 3: Different HTTP headers
    console.log('\n🔧 Method 3: Different Header Combinations');
    const headerVariations = [
        {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        {
            'content-type': 'application/json',  // lowercase
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,  // different case
            'anthropic-version': '2023-06-01'
        },
        {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'Anthropic-Version': '2023-06-01'  // different case
        }
    ];
    
    for (let i = 0; i < headerVariations.length; i++) {
        try {
            const result = await testWithCustomHeaders(headerVariations[i], testPayload);
            console.log(`Header variation ${i + 1}:`, result.status, result.data.substring(0, 50));
        } catch (error) {
            console.log(`Header variation ${i + 1}: Failed -`, error.message);
        }
    }
    
    // 6. Environment Variable Debugging
    console.log('\n🔍 Environment Variable Deep Dive:');
    console.log('All environment variables containing "ANTHROPIC":');
    for (const [key, value] of Object.entries(process.env)) {
        if (key.includes('ANTHROPIC') || key.includes('anthropic')) {
            console.log(`  ${key}: ${value ? value.substring(0, 20) + '...' : 'undefined'}`);
        }
    }
    
    // 7. File System Permissions
    console.log('\n📁 File System Permissions:');
    try {
        const envStat = fs.statSync('.env');
        console.log('.env file permissions:', envStat.mode.toString(8));
        console.log('.env file owner readable:', !!(envStat.mode & 0o400));
        console.log('.env file group readable:', !!(envStat.mode & 0o040));
        console.log('.env file other readable:', !!(envStat.mode & 0o004));
    } catch (error) {
        console.log('Cannot check .env permissions:', error.message);
    }
    
    // 8. Final Recommendations
    console.log('\n💡 Final Analysis and Recommendations:');
    console.log('1. Try regenerating API key in Anthropic Console');
    console.log('2. Try from a completely different network/computer');
    console.log('3. Try creating a new Anthropic account for testing');
    console.log('4. Check if there are any corporate firewalls/proxies');
    console.log('5. Try using a different API client (Postman, Insomnia)');
    console.log('6. Verify account region/geographic restrictions');
}

// Helper functions
async function testWithNodeHttps(apiKey, payload) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload);
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
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function testWithFetch(apiKey, payload) {
    return fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload)
    });
}

async function testWithCustomHeaders(headers, payload) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload);
        const options = {
            hostname: 'api.anthropic.com',
            port: 443,
            path: '/v1/messages',
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Run the exhaustive debug
exhaustiveDebug().catch(console.error);
