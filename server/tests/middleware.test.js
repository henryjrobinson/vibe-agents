const request = require('supertest');
const app = require('../server');

describe('Authentication Middleware', () => {
    describe('authenticateUser middleware', () => {
        it('should allow access with valid session token', async () => {
            const user = await global.testUtils.createTestUser('middleware@example.com');
            const session = await global.testUtils.createUserSession(user.id);

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${session.session_token}`);

            expect(response.status).toBe(200);
            expect(response.body.user.email).toBe(user.email);
        });

        it('should reject request without Authorization header', async () => {
            const response = await request(app)
                .get('/api/auth/me');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
            expect(response.body.message).toContain('valid authentication token');
        });

        it('should reject request with malformed Authorization header', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'InvalidFormat token123');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid_token_here');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid authentication');
            expect(response.body.message).toContain('session has expired');
        });

        it('should reject request with expired session', async () => {
            const user = await global.testUtils.createTestUser('expired@example.com');
            const pool = global.testUtils.getPool();
            
            // Create expired session
            const { generateJWT } = require('../utils/auth');
            const expiredToken = generateJWT({ userId: user.id, type: 'session' });
            const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
            await pool.query(
                'INSERT INTO user_sessions (user_id, session_token, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5)',
                [user.id, expiredToken, pastTime, 'Test', '127.0.0.1']
            );

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${expiredToken}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid authentication');
        });
    });

    describe('Rate Limiting Middleware', () => {
        it('should allow requests within rate limit', async () => {
            // Make several requests that should be allowed
            for (let i = 0; i < 5; i++) {
                const response = await request(app)
                    .get('/health');
                expect(response.status).toBe(200);
            }
        });

        it('should enforce rate limiting on magic link requests', async () => {
            const email = 'ratelimit@example.com';

            // Make 3 requests (should be allowed)
            for (let i = 0; i < 3; i++) {
                const response = await request(app)
                    .post('/api/auth/request-magic-link')
                    .send({ email });
                expect(response.status).toBe(200);
            }

            // 4th request should be rate limited
            const response = await request(app)
                .post('/api/auth/request-magic-link')
                .send({ email });

            expect(response.status).toBe(429);
            expect(response.body.error).toContain('Too many attempts');
            expect(response.body.retryAfter).toBeDefined();
        });
    });

    describe('CORS Middleware', () => {
        it('should include CORS headers in responses', async () => {
            const response = await request(app)
                .get('/health')
                .set('Origin', 'http://localhost:3000');

            expect(response.headers['access-control-allow-origin']).toBeDefined();
        });

        it('should handle preflight OPTIONS requests', async () => {
            const response = await request(app)
                .options('/api/auth/me')
                .set('Origin', 'http://localhost:3000')
                .set('Access-Control-Request-Method', 'GET')
                .set('Access-Control-Request-Headers', 'Authorization');

            expect(response.status).toBe(204);
            expect(response.headers['access-control-allow-methods']).toContain('GET');
            expect(response.headers['access-control-allow-headers']).toContain('Authorization');
        });
    });

    describe('Security Headers Middleware', () => {
        it('should include security headers', async () => {
            const response = await request(app)
                .get('/health');

            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['x-xss-protection']).toBe('0');
            expect(response.headers['content-security-policy']).toBeDefined();
        });
    });

    describe('Request Validation', () => {
        it('should reject requests with oversized JSON payload', async () => {
            const largePayload = {
                email: 'test@example.com',
                data: 'x'.repeat(11 * 1024 * 1024) // 11MB payload
            };

            const response = await request(app)
                .post('/api/auth/request-magic-link')
                .send(largePayload);

            expect(response.status).toBe(413); // Payload Too Large
        });

        it('should handle malformed JSON gracefully', async () => {
            const response = await request(app)
                .post('/api/auth/request-magic-link')
                .set('Content-Type', 'application/json')
                .send('{ invalid json }');

            expect(response.status).toBe(400);
        });
    });
});
