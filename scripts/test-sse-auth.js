#!/usr/bin/env node

/**
 * Programmatic test for SSE authentication improvements
 * Tests the changes made to force-refresh tokens and improve reliability
 */

const http = require('http');
const { URL } = require('url');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_TOKEN = 'fake-test-token-for-validation';

/**
 * Test SSE endpoint without authentication
 */
async function testSSENoAuth() {
    console.log('\n🔍 Testing SSE without authentication...');
    
    return new Promise((resolve) => {
        const url = new URL('/events?conversationId=test', BASE_URL);
        
        const req = http.get(url, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`   Response: ${data}`);
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on('error', (err) => {
            console.log(`   Error: ${err.message}`);
            resolve({ error: err.message });
        });
        
        // Close after 2 seconds
        setTimeout(() => {
            req.destroy();
            resolve({ timeout: true });
        }, 2000);
    });
}

/**
 * Test SSE endpoint with fake token (should fail gracefully)
 */
async function testSSEWithFakeToken() {
    console.log('\n🔍 Testing SSE with fake token...');
    
    return new Promise((resolve) => {
        const url = new URL(`/events?conversationId=test&token=${encodeURIComponent(TEST_TOKEN)}`, BASE_URL);
        
        const req = http.get(url, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`   Response: ${data}`);
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on('error', (err) => {
            console.log(`   Error: ${err.message}`);
            resolve({ error: err.message });
        });
        
        // Close after 2 seconds
        setTimeout(() => {
            req.destroy();
            resolve({ timeout: true });
        }, 2000);
    });
}

/**
 * Test API endpoint authentication
 */
async function testAPIAuth() {
    console.log('\n🔍 Testing API authentication...');
    
    return new Promise((resolve) => {
        const postData = JSON.stringify({
            message: 'Test message',
            model: 'claude-3-5-haiku-latest',
            conversationId: 'test',
            messageId: 'test-msg-1'
        });
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/memory-keeper',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`   Response: ${data}`);
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on('error', (err) => {
            console.log(`   Error: ${err.message}`);
            resolve({ error: err.message });
        });
        
        req.write(postData);
        req.end();
    });
}

/**
 * Test server health and Firebase initialization
 */
async function testServerHealth() {
    console.log('\n🔍 Testing server health...');
    
    return new Promise((resolve) => {
        const req = http.get(`${BASE_URL}/`, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Content-Type: ${res.headers['content-type']}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const hasFirebaseConfig = data.includes('firebase') || data.includes('Firebase');
                console.log(`   Firebase config present: ${hasFirebaseConfig}`);
                resolve({
                    status: res.statusCode,
                    hasFirebaseConfig,
                    contentType: res.headers['content-type']
                });
            });
        });
        
        req.on('error', (err) => {
            console.log(`   Error: ${err.message}`);
            resolve({ error: err.message });
        });
    });
}

/**
 * Test environment endpoint
 */
async function testEnvEndpoint() {
    console.log('\n🔍 Testing /env.js endpoint...');
    
    return new Promise((resolve) => {
        const req = http.get(`${BASE_URL}/env.js`, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Content-Type: ${res.headers['content-type']}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const hasFirebaseVars = data.includes('FIREBASE_API_KEY') || data.includes('FIREBASE_PROJECT_ID');
                console.log(`   Firebase env vars present: ${hasFirebaseVars}`);
                console.log(`   Response preview: ${data.substring(0, 200)}...`);
                resolve({
                    status: res.statusCode,
                    hasFirebaseVars,
                    contentType: res.headers['content-type'],
                    preview: data.substring(0, 200)
                });
            });
        });
        
        req.on('error', (err) => {
            console.log(`   Error: ${err.message}`);
            resolve({ error: err.message });
        });
    });
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🧪 Starting SSE Authentication Tests');
    console.log('=====================================');
    
    const results = {
        serverHealth: await testServerHealth(),
        envEndpoint: await testEnvEndpoint(),
        apiAuth: await testAPIAuth(),
        sseNoAuth: await testSSENoAuth(),
        sseFakeToken: await testSSEWithFakeToken()
    };
    
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    
    // Server Health
    const healthOk = results.serverHealth.status === 200 && results.serverHealth.hasFirebaseConfig;
    console.log(`✅ Server Health: ${healthOk ? 'PASS' : 'FAIL'} (${results.serverHealth.status})`);
    
    // Environment endpoint
    const envOk = results.envEndpoint.status === 200 && results.envEndpoint.hasFirebaseVars;
    console.log(`✅ Environment Config: ${envOk ? 'PASS' : 'FAIL'} (${results.envEndpoint.status})`);
    
    // API Auth (should fail with 401)
    const apiAuthOk = results.apiAuth.status === 401;
    console.log(`✅ API Authentication: ${apiAuthOk ? 'PASS' : 'FAIL'} (${results.apiAuth.status})`);
    
    // SSE No Auth (should fail with 401)
    const sseNoAuthOk = results.sseNoAuth.status === 401;
    console.log(`✅ SSE No Auth: ${sseNoAuthOk ? 'PASS' : 'FAIL'} (${results.sseNoAuth.status})`);
    
    // SSE Fake Token (should fail with 401)
    const sseFakeTokenOk = results.sseFakeToken.status === 401;
    console.log(`✅ SSE Fake Token: ${sseFakeTokenOk ? 'PASS' : 'FAIL'} (${results.sseFakeToken.status})`);
    
    const allPassed = healthOk && envOk && apiAuthOk && sseNoAuthOk && sseFakeTokenOk;
    console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allPassed) {
        console.log('\n🚀 Server is properly configured for Firebase authentication!');
        console.log('   - SSE endpoint correctly requires authentication');
        console.log('   - API endpoints are protected');
        console.log('   - Environment configuration is working');
        console.log('   - Firebase integration is ready');
    } else {
        console.log('\n⚠️  Some issues detected. Check the test output above.');
    }
    
    return results;
}

// Run tests if called directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests };
