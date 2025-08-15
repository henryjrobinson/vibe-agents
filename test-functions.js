#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Netlify Functions
 * Tests both Memory Keeper and Collaborator functions in dev environment
 */

const https = require('https');
const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:8888';
const TEST_MESSAGE = "My name is Sarah and I'm from Boston. I went to college there and met my best friend Emma.";
const TEST_MODEL = 'claude-opus-4-20250514';

// Test data
const memoryKeeperPayload = {
    message: TEST_MESSAGE,
    model: TEST_MODEL
};

const collaboratorPayload = {
    message: TEST_MESSAGE,
    conversationHistory: [],
    model: TEST_MODEL
};

/**
 * Make HTTP request with proper error handling
 */
function makeRequest(url, method, data) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: responseData
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

/**
 * Test Memory Keeper function
 */
async function testMemoryKeeper() {
    console.log('\n🧠 TESTING MEMORY KEEPER FUNCTION');
    console.log('=====================================');
    
    try {
        // Test direct function endpoint
        console.log('Testing: /.netlify/functions/memory-keeper');
        const directResponse = await makeRequest(
            `${BASE_URL}/.netlify/functions/memory-keeper`,
            'POST',
            memoryKeeperPayload
        );
        
        console.log(`Status: ${directResponse.statusCode}`);
        console.log(`Headers:`, directResponse.headers);
        console.log(`Body: ${directResponse.body.substring(0, 200)}...`);
        
        if (directResponse.statusCode === 200) {
            try {
                const parsed = JSON.parse(directResponse.body);
                console.log('✅ Memory Keeper: JSON parsing successful');
                console.log('✅ Memory Keeper: Function working correctly');
                return true;
            } catch (parseError) {
                console.log('❌ Memory Keeper: JSON parsing failed:', parseError.message);
                return false;
            }
        } else {
            console.log('❌ Memory Keeper: Non-200 status code');
            return false;
        }
        
    } catch (error) {
        console.log('❌ Memory Keeper: Request failed:', error.message);
        return false;
    }
}

/**
 * Test Collaborator function
 */
async function testCollaborator() {
    console.log('\n🤝 TESTING COLLABORATOR FUNCTION');
    console.log('=================================');
    
    try {
        // Test direct function endpoint
        console.log('Testing: /.netlify/functions/collaborator');
        const directResponse = await makeRequest(
            `${BASE_URL}/.netlify/functions/collaborator`,
            'POST',
            collaboratorPayload
        );
        
        console.log(`Status: ${directResponse.statusCode}`);
        console.log(`Headers:`, directResponse.headers);
        console.log(`Body: ${directResponse.body.substring(0, 200)}...`);
        
        if (directResponse.statusCode === 200) {
            try {
                const parsed = JSON.parse(directResponse.body);
                console.log('✅ Collaborator: JSON parsing successful');
                console.log('✅ Collaborator: Function working correctly');
                return true;
            } catch (parseError) {
                console.log('❌ Collaborator: JSON parsing failed:', parseError.message);
                return false;
            }
        } else {
            console.log('❌ Collaborator: Non-200 status code');
            return false;
        }
        
    } catch (error) {
        console.log('❌ Collaborator: Request failed:', error.message);
        return false;
    }
}

/**
 * Test API redirect endpoints (should work in production)
 */
async function testApiRedirects() {
    console.log('\n🔄 TESTING API REDIRECT ENDPOINTS');
    console.log('==================================');
    
    try {
        // Test /api/memory-keeper redirect
        console.log('Testing: /api/memory-keeper');
        const memoryResponse = await makeRequest(
            `${BASE_URL}/api/memory-keeper`,
            'POST',
            memoryKeeperPayload
        );
        
        console.log(`Memory Keeper Redirect Status: ${memoryResponse.statusCode}`);
        console.log(`Memory Keeper Redirect Body: ${memoryResponse.body.substring(0, 100)}...`);
        
        // Test /api/collaborator redirect
        console.log('Testing: /api/collaborator');
        const collabResponse = await makeRequest(
            `${BASE_URL}/api/collaborator`,
            'POST',
            collaboratorPayload
        );
        
        console.log(`Collaborator Redirect Status: ${collabResponse.statusCode}`);
        console.log(`Collaborator Redirect Body: ${collabResponse.body.substring(0, 100)}...`);
        
        if (memoryResponse.statusCode === 200 && collabResponse.statusCode === 200) {
            console.log('✅ API Redirects: Working correctly');
            return true;
        } else {
            console.log('❌ API Redirects: Not working in dev environment (expected)');
            return false;
        }
        
    } catch (error) {
        console.log('❌ API Redirects: Request failed:', error.message);
        return false;
    }
}

/**
 * Test CORS and OPTIONS requests
 */
async function testCORS() {
    console.log('\n🌐 TESTING CORS AND OPTIONS');
    console.log('============================');
    
    try {
        // Test OPTIONS request
        const optionsResponse = await makeRequest(
            `${BASE_URL}/.netlify/functions/memory-keeper`,
            'OPTIONS',
            null
        );
        
        console.log(`OPTIONS Status: ${optionsResponse.statusCode}`);
        console.log(`CORS Headers:`, optionsResponse.headers);
        
        if (optionsResponse.statusCode === 200 || optionsResponse.statusCode === 204) {
            console.log('✅ CORS: OPTIONS request handled correctly');
            return true;
        } else {
            console.log('❌ CORS: OPTIONS request failed');
            return false;
        }
        
    } catch (error) {
        console.log('❌ CORS: Request failed:', error.message);
        return false;
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🚀 NETLIFY FUNCTIONS TEST SUITE');
    console.log('================================');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Test Message: ${TEST_MESSAGE}`);
    console.log(`Test Model: ${TEST_MODEL}`);
    
    const results = {
        memoryKeeper: false,
        collaborator: false,
        apiRedirects: false,
        cors: false
    };
    
    // Run all tests
    results.memoryKeeper = await testMemoryKeeper();
    results.collaborator = await testCollaborator();
    results.apiRedirects = await testApiRedirects();
    results.cors = await testCORS();
    
    // Summary
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('========================');
    console.log(`Memory Keeper Function: ${results.memoryKeeper ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Collaborator Function: ${results.collaborator ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`API Redirects: ${results.apiRedirects ? '✅ PASS' : '❌ FAIL (expected in dev)'}`);
    console.log(`CORS Handling: ${results.cors ? '✅ PASS' : '❌ FAIL'}`);
    
    const passing = Object.values(results).filter(Boolean).length;
    const total = Object.values(results).length;
    
    console.log(`\n🎯 Overall: ${passing}/${total} tests passing`);
    
    if (results.memoryKeeper && results.collaborator) {
        console.log('\n✅ FUNCTIONS ARE WORKING! The issue is likely in the frontend API calls.');
        console.log('💡 Recommendation: Check browser network tab for actual request URLs');
    } else {
        console.log('\n❌ FUNCTIONS HAVE ISSUES! Check Netlify dev server logs and function code.');
    }
}

// Run the tests
runTests().catch(console.error);
