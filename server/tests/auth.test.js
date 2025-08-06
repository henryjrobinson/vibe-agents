const request = require('supertest');
const app = require('../server');
const { generateJWT, createMagicLinkToken, verifyMagicLinkToken } = require('../utils/auth');

describe('Authentication System', () => {
    describe('POST /api/auth/request-magic-link', () => {
        it('should create a new user and send magic link for new email', async () => {
            const response = await request(app)
                .post('/api/auth/request-magic-link')
                .send({
                    email: 'newuser@example.com',
                    name: 'New User'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('Login link sent');
            expect(response.body.expiresAt).toBeDefined();

            // Verify user was created in database
            const pool = global.testUtils.getPool();
            const userResult = await pool.query('SELECT * FROM users WHERE email = $1', ['newuser@example.com']);
            expect(userResult.rows).toHaveLength(1);
            expect(userResult.rows[0].name).toBe('New User');

            // Verify magic link token was created
            const tokenResult = await pool.query('SELECT * FROM magic_link_tokens WHERE email = $1', ['newuser@example.com']);
            expect(tokenResult.rows).toHaveLength(1);
            expect(tokenResult.rows[0].used_at).toBeNull();
        });

        it('should send magic link for existing user', async () => {
            // Create existing user
            await global.testUtils.createTestUser('existing@example.com', 'Existing User');

            const response = await request(app)
                .post('/api/auth/request-magic-link')
                .send({
                    email: 'existing@example.com'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify magic link token was created
            const pool = global.testUtils.getPool();
            const tokenResult = await pool.query('SELECT * FROM magic_link_tokens WHERE email = $1', ['existing@example.com']);
            expect(tokenResult.rows).toHaveLength(1);
        });

        it('should reject invalid email addresses', async () => {
            const response = await request(app)
                .post('/api/auth/request-magic-link')
                .send({
                    email: 'invalid-email'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation error');
            expect(response.body.message).toContain('valid email address');
        });

        it('should reject missing email', async () => {
            const response = await request(app)
                .post('/api/auth/request-magic-link')
                .send({
                    name: 'Test User'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation error');
            expect(response.body.message).toContain('required');
        });

        it('should enforce rate limiting', async () => {
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
        });
    });

    describe('POST /api/auth/verify-magic-link', () => {
        it('should successfully verify valid magic link token', async () => {
            const email = 'verify@example.com';
            const user = await global.testUtils.createTestUser(email, 'Verify User');
            const tokenData = await global.testUtils.createMagicLinkToken(email);

            const response = await request(app)
                .post('/api/auth/verify-magic-link')
                .send({
                    token: tokenData.token
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Login successful');
            expect(response.body.user).toMatchObject({
                id: user.id,
                email: user.email,
                name: user.name
            });
            expect(response.body.sessionToken).toBeDefined();

            // Verify token was marked as used
            const pool = global.testUtils.getPool();
            const tokenResult = await pool.query('SELECT * FROM magic_link_tokens WHERE token = $1', [tokenData.token]);
            expect(tokenResult.rows[0].used_at).not.toBeNull();

            // Verify session was created
            const sessionResult = await pool.query('SELECT * FROM user_sessions WHERE user_id = $1', [user.id]);
            expect(sessionResult.rows).toHaveLength(1);
        });

        it('should reject invalid token format', async () => {
            const response = await request(app)
                .post('/api/auth/verify-magic-link')
                .send({
                    token: 'invalid-token'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation error');
            expect(response.body.message).toContain('Invalid token format');
        });

        it('should reject non-existent token', async () => {
            const response = await request(app)
                .post('/api/auth/verify-magic-link')
                .send({
                    token: 'a'.repeat(64) // Valid format but doesn't exist
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid or expired');
        });

        it('should reject expired token', async () => {
            const email = 'expired@example.com';
            await global.testUtils.createTestUser(email);

            // Create expired token
            const pool = global.testUtils.getPool();
            const expiredToken = 'expired_token_' + Date.now();
            const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
            await pool.query(
                'INSERT INTO magic_link_tokens (email, token, expires_at) VALUES ($1, $2, $3)',
                [email, expiredToken, pastTime]
            );

            const response = await request(app)
                .post('/api/auth/verify-magic-link')
                .send({
                    token: expiredToken
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid or expired');
        });

        it('should reject already used token', async () => {
            const email = 'used@example.com';
            await global.testUtils.createTestUser(email);
            const tokenData = await global.testUtils.createMagicLinkToken(email);

            // Use the token first time
            await request(app)
                .post('/api/auth/verify-magic-link')
                .send({ token: tokenData.token });

            // Try to use it again
            const response = await request(app)
                .post('/api/auth/verify-magic-link')
                .send({ token: tokenData.token });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid or expired');
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return user info for authenticated user', async () => {
            const user = await global.testUtils.createTestUser('me@example.com', 'Me User');
            const session = await global.testUtils.createUserSession(user.id);

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${session.session_token}`);

            expect(response.status).toBe(200);
            expect(response.body.user).toMatchObject({
                id: user.id,
                email: user.email,
                name: user.name
            });
        });

        it('should reject request without token', async () => {
            const response = await request(app)
                .get('/api/auth/me');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid_token');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid authentication');
        });

        it('should reject request with expired session', async () => {
            const user = await global.testUtils.createTestUser('expired@example.com');
            
            // Create expired session
            const pool = global.testUtils.getPool();
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

    describe('PUT /api/auth/profile', () => {
        it('should update user profile successfully', async () => {
            const user = await global.testUtils.createTestUser('profile@example.com', 'Original Name');
            const session = await global.testUtils.createUserSession(user.id);

            const response = await request(app)
                .put('/api/auth/profile')
                .set('Authorization', `Bearer ${session.session_token}`)
                .send({
                    name: 'Updated Name',
                    preferences: { theme: 'dark', notifications: true }
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user.name).toBe('Updated Name');
            expect(response.body.user.preferences).toMatchObject({
                theme: 'dark',
                notifications: true
            });

            // Verify in database
            const pool = global.testUtils.getPool();
            const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);
            expect(userResult.rows[0].name).toBe('Updated Name');
        });

        it('should reject empty update', async () => {
            const user = await global.testUtils.createTestUser('empty@example.com');
            const session = await global.testUtils.createUserSession(user.id);

            const response = await request(app)
                .put('/api/auth/profile')
                .set('Authorization', `Bearer ${session.session_token}`)
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('No updates provided');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .put('/api/auth/profile')
                .send({ name: 'New Name' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should logout user successfully', async () => {
            const user = await global.testUtils.createTestUser('logout@example.com');
            const session = await global.testUtils.createUserSession(user.id);

            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${session.session_token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Logged out successfully');

            // Verify session was deleted
            const pool = global.testUtils.getPool();
            const sessionResult = await pool.query('SELECT * FROM user_sessions WHERE session_token = $1', [session.session_token]);
            expect(sessionResult.rows).toHaveLength(0);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/auth/logout');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('POST /api/auth/logout-all', () => {
        it('should logout from all sessions', async () => {
            const user = await global.testUtils.createTestUser('logoutall@example.com');
            const session1 = await global.testUtils.createUserSession(user.id, 'token1');
            const session2 = await global.testUtils.createUserSession(user.id, 'token2');

            const response = await request(app)
                .post('/api/auth/logout-all')
                .set('Authorization', `Bearer ${session1.session_token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Logged out from all devices');

            // Verify all sessions were deleted
            const pool = global.testUtils.getPool();
            const sessionResult = await pool.query('SELECT * FROM user_sessions WHERE user_id = $1', [user.id]);
            expect(sessionResult.rows).toHaveLength(0);
        });
    });

    describe('GET /api/auth/health', () => {
        it('should return healthy status', async () => {
            const response = await request(app)
                .get('/api/auth/health');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('healthy');
            expect(response.body.services.database).toBe('connected');
        });
    });
});
