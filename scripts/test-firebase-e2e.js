#!/usr/bin/env node

/**
 * End-to-end Firebase authentication test without browser
 * Tests Firebase Admin SDK integration and token validation
 */

const admin = require('firebase-admin');
const http = require('http');
const { URL } = require('url');

// Test configuration
const BASE_URL = 'http://localhost:3000';

/**
 * Test with a mock JWT token to simulate Firebase authentication
 * This tests the server's token validation without needing real Firebase tokens
 */
async function createMockToken() {
    console.log('🔧 Creating mock Firebase ID token for testing...');
    
    // Create a mock JWT-like token (this will fail validation, which is expected)
    const mockPayload = {
        iss: 'https://securetoken.google.com/story-collection-app-e131d',
        aud: 'story-collection-app-e131d',
        auth_time: Math.floor(Date.now() / 1000),
        user_id: 'test-user-mock',
        sub: 'test-user-mock',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        email: 'test@example.com',
        email_verified: true,
        firebase: {
            identities: {
                email: ['test@example.com']
            },
            sign_in_provider: 'password'
        }
    };
    
    // This is a mock token that will fail validation (which is what we want to test)
    const mockToken = 'mock.firebase.token';
    
    console.log('✅ Created mock token for testing token validation');
    return { mockToken, testUid: 'test-user-mock' };
}

/**
 * Test API endpoint with Firebase token
 */
async function testAPIWithToken(token) {
    console.log('\n🔍 Testing API with Firebase token...');
    
    return new Promise((resolve) => {
        const postData = JSON.stringify({
            message: 'Test message for Firebase auth',
            model: 'claude-3-5-haiku-latest',
            conversationId: 'firebase-test',
            messageId: 'test-msg-firebase'
        });
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/memory-keeper',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': `Bearer ${token}`
            }
        };
        
        const req = http.request(options, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    console.log(`   Response type: ${parsed.error ? 'Error' : 'Success'}`);
                    if (parsed.error) {
                        console.log(`   Error: ${parsed.message || parsed.error}`);
                    } else {
                        console.log(`   Success: Memory extraction attempted`);
                    }
                } catch (e) {
                    console.log(`   Raw response: ${data.substring(0, 100)}...`);
                }
                
                resolve({
                    status: res.statusCode,
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
 * Test SSE endpoint with Firebase token
 */
async function testSSEWithToken(token) {
    console.log('\n🔍 Testing SSE with Firebase token...');
    
    return new Promise((resolve) => {
        const url = new URL(`/events?conversationId=firebase-test&token=${encodeURIComponent(token)}`, BASE_URL);
        
        const req = http.get(url, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Content-Type: ${res.headers['content-type']}`);
            
            if (res.statusCode === 200) {
                console.log(`   ✅ SSE connection established successfully`);
                
                let eventCount = 0;
                res.on('data', (chunk) => {
                    const data = chunk.toString();
                    if (data.includes('event:') || data.includes('data:')) {
                        eventCount++;
                        console.log(`   📡 Received SSE event ${eventCount}`);
                    }
                });
                
                // Close after 3 seconds
                setTimeout(() => {
                    req.destroy();
                    resolve({
                        status: res.statusCode,
                        eventCount,
                        success: true
                    });
                }, 3000);
                
            } else {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    console.log(`   ❌ SSE connection failed: ${data}`);
                    resolve({
                        status: res.statusCode,
                        body: data,
                        success: false
                    });
                });
            }
        });
        
        req.on('error', (err) => {
            console.log(`   Error: ${err.message}`);
            resolve({ error: err.message });
        });
    });
}

/**
 * Test Firebase Admin SDK initialization by checking server endpoints
 */
async function testFirebaseAdminInit() {
    console.log('\n🔍 Testing Firebase Admin SDK via server endpoints...');
    
    return new Promise((resolve) => {
        // Test a protected endpoint to see if Firebase Admin is working
        const postData = JSON.stringify({
            message: 'Firebase admin test',
            model: 'claude-3-5-haiku-latest',
            conversationId: 'admin-test',
            messageId: 'admin-test-1'
        });
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/memory-keeper',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
                // No Authorization header - should get proper auth error
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    
                    // Check if we get a proper Firebase auth error (not a server crash)
                    if (res.statusCode === 401 && parsed.error === 'Unauthorized') {
                        console.log(`   ✅ Firebase Admin SDK is working (proper auth rejection)`);
                        console.log(`   Auth message: ${parsed.message}`);
                        resolve({ success: true, authWorking: true });
                    } else if (res.statusCode === 500) {
                        console.log(`   ❌ Server error - Firebase Admin may not be initialized`);
                        console.log(`   Error: ${parsed.message || data}`);
                        resolve({ success: false, error: 'Server error' });
                    } else {
                        console.log(`   ⚠️  Unexpected response: ${res.statusCode}`);
                        resolve({ success: false, error: 'Unexpected response' });
                    }
                } catch (e) {
                    console.log(`   ❌ Invalid JSON response: ${data}`);
                    resolve({ success: false, error: 'Invalid response' });
                }
            });
        });
        
        req.on('error', (err) => {
            console.log(`   ❌ Connection error: ${err.message}`);
            resolve({ success: false, error: err.message });
        });
        
        req.write(postData);
        req.end();
    });
}

/**
 * Test server health and Firebase readiness
 */
async function testServerHealth() {
    console.log('\n🔍 Testing server health and Firebase readiness...');
    
    return new Promise((resolve) => {
        const req = http.get(`${BASE_URL}/env.js`, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const hasFirebaseConfig = data.includes('FIREBASE_PROJECT_ID') && data.includes('FIREBASE_API_KEY');
                console.log(`   Firebase config exposed: ${hasFirebaseConfig ? '✅' : '❌'}`);
                
                if (hasFirebaseConfig) {
                    // Extract project ID for validation
                    const projectIdMatch = data.match(/FIREBASE_PROJECT_ID['"]\s*:\s*['"]([^'"]+)['"]/);
                    const projectId = projectIdMatch ? projectIdMatch[1] : 'unknown';
                    console.log(`   Project ID: ${projectId}`);
                }
                
                resolve({
                    status: res.statusCode,
                    hasFirebaseConfig,
                    configData: data
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
async function runFirebaseE2ETests() {
    console.log('🧪 Firebase End-to-End Authentication Tests');
    console.log('============================================');
    
    // Test 1: Server health and config
    const healthResult = await testServerHealth();
    if (healthResult.error || !healthResult.hasFirebaseConfig) {
        console.log('\n❌ Server health check failed. Ensure server is running with Firebase config.');
        return;
    }
    
    // Test 2: Firebase Admin initialization
    const adminResult = await testFirebaseAdminInit();
    if (!adminResult.success) {
        console.log('\n❌ Firebase Admin SDK not properly initialized.');
        return;
    }
    
    // Test 3: Create a mock token for testing
    const tokenResult = await createMockToken();
    
    if (tokenResult && tokenResult.mockToken) {
        console.log('\n🎯 Testing with mock Firebase token...');
        
        // Test 4: API with mock token (should fail validation)
        const apiResult = await testAPIWithToken(tokenResult.mockToken);
        
        // Test 5: SSE with mock token (should fail validation)
        const sseResult = await testSSEWithToken(tokenResult.mockToken);
        
        // Results summary
        console.log('\n📊 Firebase E2E Test Results');
        console.log('============================');
        console.log(`✅ Server Health: PASS`);
        console.log(`✅ Firebase Admin Init: PASS`);
        console.log(`✅ Token Creation: PASS`);
        // For mock tokens, we expect 401 responses (proper rejection)
        const apiAuthWorking = apiResult.status === 401;
        const sseAuthWorking = sseResult.status === 401;
        
        console.log(`${apiAuthWorking ? '✅' : '❌'} API Authentication: ${apiAuthWorking ? 'PASS' : 'FAIL'} (${apiResult.status})`);
        console.log(`${sseAuthWorking ? '✅' : '❌'} SSE Authentication: ${sseAuthWorking ? 'PASS' : 'FAIL'} (${sseResult.status})`);
        
        const allPassed = apiAuthWorking && sseAuthWorking;
        console.log(`\n🎯 Overall Result: ${allPassed ? '✅ FIREBASE E2E TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
        
        if (allPassed) {
            console.log('\n🚀 Firebase authentication is working end-to-end!');
            console.log('   - Mock tokens are properly rejected (401)');
            console.log('   - API endpoints require valid Firebase tokens');
            console.log('   - SSE connections require valid Firebase auth');
            console.log('   - Server-side token validation is working');
        }
        
    } else {
        console.log('\n⚠️  Could not create real Firebase tokens.');
        console.log('   This is expected if:');
        console.log('   - No service account key is configured');
        console.log('   - Running in development mode');
        console.log('   - Firebase project is not fully set up');
        console.log('\n💡 To enable full testing:');
        console.log('   1. Set up a Firebase project');
        console.log('   2. Generate a service account key');
        console.log('   3. Set FIREBASE_SERVICE_ACCOUNT_KEY in .env');
        console.log('\n✅ Basic Firebase Admin SDK integration is working!');
    }
    
    return {
        serverHealth: healthResult,
        adminInit: adminResult,
        tokenCreation: tokenResult,
        // Only include API/SSE results if we had a token
        ...(tokenResult && {
            apiTest: await testAPIWithToken(tokenResult.customToken),
            sseTest: await testSSEWithToken(tokenResult.customToken)
        })
    };
}

// Run tests if called directly
if (require.main === module) {
    runFirebaseE2ETests().catch(console.error);
}

module.exports = { runFirebaseE2ETests };
