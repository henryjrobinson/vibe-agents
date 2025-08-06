const request = require('supertest');
const app = require('../server');

describe('Server Health and Core Functionality', () => {
    describe('GET /health', () => {
        it('should return healthy status with all components', async () => {
            const response = await request(app)
                .get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                status: 'healthy',
                version: '1.0.0',
                environment: 'test'
            });
            expect(response.body.timestamp).toBeDefined();
            expect(response.body.database).toMatchObject({
                status: 'healthy'
            });
            expect(response.body.database.pool).toMatchObject({
                totalCount: expect.any(Number),
                idleCount: expect.any(Number),
                waitingCount: expect.any(Number)
            });
        });

        it('should include proper response headers', async () => {
            const response = await request(app)
                .get('/health');

            expect(response.headers['content-type']).toContain('application/json');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
        });
    });

    describe('404 Error Handling', () => {
        it('should return 404 for non-existent endpoints', async () => {
            const response = await request(app)
                .get('/api/non-existent-endpoint');

            expect(response.status).toBe(404);
            expect(response.body).toMatchObject({
                error: 'Endpoint not found',
                path: '/api/non-existent-endpoint',
                method: 'GET'
            });
            expect(response.body.timestamp).toBeDefined();
        });

        it('should return 404 for non-existent POST endpoints', async () => {
            const response = await request(app)
                .post('/api/invalid/endpoint')
                .send({ test: 'data' });

            expect(response.status).toBe(404);
            expect(response.body.method).toBe('POST');
        });
    });

    describe('Route Stubs', () => {
        let authToken;

        beforeEach(async () => {
            // Create authenticated user for protected route tests
            const user = await global.testUtils.createTestUser('routetest@example.com');
            const session = await global.testUtils.createUserSession(user.id);
            authToken = session.session_token;
        });

        it('should return placeholder for conversations endpoint', async () => {
            const response = await request(app)
                .get('/api/conversations')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Conversations API - Coming in Phase 2');
        });

        it('should return placeholder for messages endpoint', async () => {
            const response = await request(app)
                .get('/api/messages')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Messages API - Coming in Phase 2');
        });

        it('should return placeholder for memories endpoint', async () => {
            const response = await request(app)
                .get('/api/memories')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Memories API - Coming in Phase 3');
        });

        it('should return placeholder for search endpoints', async () => {
            const conversationsResponse = await request(app)
                .get('/api/search/conversations')
                .set('Authorization', `Bearer ${authToken}`);

            const memoriesResponse = await request(app)
                .get('/api/search/memories')
                .set('Authorization', `Bearer ${authToken}`);

            expect(conversationsResponse.status).toBe(200);
            expect(conversationsResponse.body.message).toContain('Search conversations - Coming in Phase 4');

            expect(memoriesResponse.status).toBe(200);
            expect(memoriesResponse.body.message).toContain('Search memories - Coming in Phase 4');
        });

        it('should return placeholder for export endpoints', async () => {
            const conversationResponse = await request(app)
                .get('/api/export/conversation/123')
                .set('Authorization', `Bearer ${authToken}`);

            const memoriesResponse = await request(app)
                .get('/api/export/memories')
                .set('Authorization', `Bearer ${authToken}`);

            expect(conversationResponse.status).toBe(200);
            expect(conversationResponse.body.message).toContain('Export conversation - Coming in Phase 4');

            expect(memoriesResponse.status).toBe(200);
            expect(memoriesResponse.body.message).toContain('Export memories - Coming in Phase 4');
        });

        it('should require authentication for protected route stubs', async () => {
            const endpoints = [
                '/api/conversations',
                '/api/messages',
                '/api/memories',
                '/api/search/conversations',
                '/api/search/memories',
                '/api/export/conversation/123',
                '/api/export/memories'
            ];

            for (const endpoint of endpoints) {
                const response = await request(app).get(endpoint);
                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authentication required');
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle server errors gracefully', async () => {
            // This test simulates a server error by making a request that would cause an error
            // We'll test this by trying to access a protected route with a malformed token
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer malformed.jwt.token');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid authentication');
            expect(response.body.timestamp).toBeDefined();
        });

        it('should not leak sensitive information in error responses', async () => {
            const response = await request(app)
                .post('/api/auth/verify-magic-link')
                .send({ token: 'invalid_token_format' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation error');
            // Should not contain stack traces or internal error details
            expect(response.body.stack).toBeUndefined();
            expect(response.body.code).toBeUndefined();
        });
    });

    describe('Request Logging', () => {
        it('should log requests (verified by successful response)', async () => {
            // We can't easily test console output, but we can verify the middleware doesn't break requests
            const response = await request(app)
                .get('/health');

            expect(response.status).toBe(200);
            // If logging middleware was broken, this request would fail
        });
    });

    describe('Content Type Handling', () => {
        it('should handle JSON content type correctly', async () => {
            const response = await request(app)
                .post('/api/auth/request-magic-link')
                .set('Content-Type', 'application/json')
                .send(JSON.stringify({ email: 'json@example.com' }));

            expect(response.status).toBe(200);
        });

        it('should handle URL-encoded content type', async () => {
            const response = await request(app)
                .post('/api/auth/request-magic-link')
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .send('email=urlencoded@example.com');

            expect(response.status).toBe(200);
        });
    });

    describe('HTTP Methods', () => {
        it('should handle GET requests', async () => {
            const response = await request(app)
                .get('/health');

            expect(response.status).toBe(200);
        });

        it('should handle POST requests', async () => {
            const response = await request(app)
                .post('/api/auth/request-magic-link')
                .send({ email: 'post@example.com' });

            expect(response.status).toBe(200);
        });

        it('should handle PUT requests', async () => {
            const user = await global.testUtils.createTestUser('put@example.com');
            const session = await global.testUtils.createUserSession(user.id);

            const response = await request(app)
                .put('/api/auth/profile')
                .set('Authorization', `Bearer ${session.session_token}`)
                .send({ name: 'Updated Name' });

            expect(response.status).toBe(200);
        });

        it('should return 404 for unsupported methods on existing endpoints', async () => {
            const response = await request(app)
                .patch('/health'); // PATCH not supported on /health

            expect(response.status).toBe(404);
        });
    });
});
