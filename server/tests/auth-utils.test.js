const {
    generateSecureToken,
    generateJWT,
    verifyJWT,
    createMagicLinkToken,
    verifyMagicLinkToken,
    createUserSession,
    verifyUserSession,
    invalidateUserSession,
    isValidEmail,
    getClientIP
} = require('../utils/auth');

describe('Auth Utils', () => {
    describe('generateSecureToken', () => {
        it('should generate token of default length (32 bytes = 64 hex chars)', () => {
            const token = generateSecureToken();
            expect(token).toHaveLength(64);
            expect(token).toMatch(/^[a-f0-9]+$/);
        });

        it('should generate token of specified length', () => {
            const token = generateSecureToken(16);
            expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
        });

        it('should generate unique tokens', () => {
            const token1 = generateSecureToken();
            const token2 = generateSecureToken();
            expect(token1).not.toBe(token2);
        });
    });

    describe('JWT functions', () => {
        it('should generate and verify JWT token', () => {
            const payload = { userId: 123, type: 'session' };
            const token = generateJWT(payload);
            
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');

            const decoded = verifyJWT(token);
            expect(decoded.userId).toBe(123);
            expect(decoded.type).toBe('session');
            expect(decoded.iss).toBe('vibe-agents');
            expect(decoded.aud).toBe('vibe-agents-users');
        });

        it('should reject invalid JWT token', () => {
            expect(() => {
                verifyJWT('invalid.jwt.token');
            }).toThrow('Invalid or expired token');
        });

        it('should reject malformed JWT token', () => {
            expect(() => {
                verifyJWT('not-a-jwt-token');
            }).toThrow('Invalid or expired token');
        });
    });

    describe('createMagicLinkToken', () => {
        it('should create magic link token in database', async () => {
            const email = 'magiclink@example.com';
            const result = await createMagicLinkToken(email);

            expect(result.token).toHaveLength(64);
            expect(result.expiresAt).toBeInstanceOf(Date);
            expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

            // Verify in database
            const pool = global.testUtils.getPool();
            const dbResult = await pool.query('SELECT * FROM magic_link_tokens WHERE email = $1', [email]);
            expect(dbResult.rows).toHaveLength(1);
            expect(dbResult.rows[0].token).toBe(result.token);
        });

        it('should create tokens with future expiration', async () => {
            const email = 'future@example.com';
            const result = await createMagicLinkToken(email);

            const now = new Date();
            const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
            
            expect(result.expiresAt.getTime()).toBeGreaterThan(now.getTime());
            expect(result.expiresAt.getTime()).toBeLessThanOrEqual(fifteenMinutesFromNow.getTime());
        });
    });

    describe('verifyMagicLinkToken', () => {
        it('should verify valid magic link token', async () => {
            const email = 'verify@example.com';
            const { token } = await createMagicLinkToken(email);

            const result = await verifyMagicLinkToken(token);
            expect(result.email).toBe(email);
            expect(result.token).toBe(token);
            expect(result.used_at).not.toBeNull();
        });

        it('should reject non-existent token', async () => {
            await expect(verifyMagicLinkToken('nonexistent_token_123')).rejects.toThrow('Invalid or expired magic link token');
        });

        it('should reject expired token', async () => {
            const email = 'expired@example.com';
            const pool = global.testUtils.getPool();
            
            // Create expired token directly in database
            const expiredToken = 'expired_' + Date.now();
            const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
            await pool.query(
                'INSERT INTO magic_link_tokens (email, token, expires_at) VALUES ($1, $2, $3)',
                [email, expiredToken, pastTime]
            );

            await expect(verifyMagicLinkToken(expiredToken)).rejects.toThrow('Invalid or expired magic link token');
        });

        it('should reject already used token', async () => {
            const email = 'used@example.com';
            const { token } = await createMagicLinkToken(email);

            // Use token first time
            await verifyMagicLinkToken(token);

            // Try to use again
            await expect(verifyMagicLinkToken(token)).rejects.toThrow('Invalid or expired magic link token');
        });
    });

    describe('createUserSession', () => {
        it('should create user session in database', async () => {
            const user = await global.testUtils.createTestUser('session@example.com');
            const userAgent = 'Test Browser';
            const ipAddress = '192.168.1.1';

            const session = await createUserSession(user.id, userAgent, ipAddress);

            expect(session).toBeDefined();
            expect(session.session_token).toBeDefined();
            expect(typeof session.session_token).toBe('string');
            expect(session.user_id).toBe(user.id);

            // Verify in database
            const pool = global.testUtils.getPool();
            const dbResult = await pool.query('SELECT * FROM user_sessions WHERE user_id = $1', [user.id]);
            expect(dbResult.rows).toHaveLength(1);
            expect(dbResult.rows[0].session_token).toBe(session.session_token);
            expect(dbResult.rows[0].user_agent).toBe(userAgent);
            expect(dbResult.rows[0].ip_address).toBe(ipAddress);
        });
    });

    describe('verifyUserSession', () => {
        it('should verify valid user session', async () => {
            const user = await global.testUtils.createTestUser('sessionverify@example.com', 'Session User');
            const session = await global.testUtils.createUserSession(user.id);

            const result = await verifyUserSession(session.session_token);

            expect(result.userId).toBe(user.id);
            expect(result.email).toBe(user.email);
            expect(result.name).toBe(user.name);
            expect(result.sessionId).toBe(session.id);
        });

        it('should reject invalid session token', async () => {
            await expect(verifyUserSession('invalid_session_token')).rejects.toThrow('Invalid session');
        });

        it('should reject expired session', async () => {
            const user = await global.testUtils.createTestUser('expired@example.com');
            const pool = global.testUtils.getPool();
            
            // Create expired session
            const expiredToken = generateJWT({ userId: user.id, type: 'session' });
            const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
            await pool.query(
                'INSERT INTO user_sessions (user_id, session_token, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5)',
                [user.id, expiredToken, pastTime, 'Test', '127.0.0.1']
            );

            await expect(verifyUserSession(expiredToken)).rejects.toThrow('Invalid session');
        });

        it('should reject session for inactive user', async () => {
            const user = await global.testUtils.createTestUser('inactive@example.com');
            const session = await global.testUtils.createUserSession(user.id);

            // Deactivate user
            const pool = global.testUtils.getPool();
            await pool.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);

            await expect(verifyUserSession(session.session_token)).rejects.toThrow('User account is inactive');
        });

        it('should update last accessed time', async () => {
            const user = await global.testUtils.createTestUser('lastaccess@example.com');
            const session = await global.testUtils.createUserSession(user.id);

            const originalTime = session.last_accessed;
            await global.testUtils.wait(100); // Wait a bit

            await verifyUserSession(session.session_token);

            // Check that last_accessed was updated
            const pool = global.testUtils.getPool();
            const updatedSession = await pool.query('SELECT * FROM user_sessions WHERE id = $1', [session.id]);
            expect(updatedSession.rows[0].last_accessed.getTime()).toBeGreaterThan(originalTime.getTime());
        });
    });

    describe('invalidateUserSession', () => {
        it('should invalidate user session', async () => {
            const user = await global.testUtils.createTestUser('invalidate@example.com');
            const session = await global.testUtils.createUserSession(user.id);

            await invalidateUserSession(session.session_token);

            // Verify session was deleted
            const pool = global.testUtils.getPool();
            const dbResult = await pool.query('SELECT * FROM user_sessions WHERE session_token = $1', [session.session_token]);
            expect(dbResult.rows).toHaveLength(0);
        });

        it('should not throw error for non-existent session', async () => {
            await expect(invalidateUserSession('non_existent_token')).resolves.not.toThrow();
        });
    });

    describe('isValidEmail', () => {
        it('should validate correct email addresses', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
            expect(isValidEmail('user123@test-domain.org')).toBe(true);
        });

        it('should reject invalid email addresses', () => {
            expect(isValidEmail('invalid-email')).toBe(false);
            expect(isValidEmail('test@')).toBe(false);
            expect(isValidEmail('@example.com')).toBe(false);
            expect(isValidEmail('test..test@example.com')).toBe(false);
            expect(isValidEmail('')).toBe(false);
        });
    });

    describe('getClientIP', () => {
        it('should extract IP from x-forwarded-for header', () => {
            const req = {
                headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
                ip: '127.0.0.1'
            };
            expect(getClientIP(req)).toBe('192.168.1.1, 10.0.0.1');
        });

        it('should extract IP from x-real-ip header', () => {
            const req = {
                headers: { 'x-real-ip': '192.168.1.1' },
                ip: '127.0.0.1'
            };
            expect(getClientIP(req)).toBe('192.168.1.1');
        });

        it('should fallback to req.ip', () => {
            const req = {
                headers: {},
                ip: '127.0.0.1'
            };
            expect(getClientIP(req)).toBe('127.0.0.1');
        });

        it('should handle missing IP gracefully', () => {
            const req = { headers: {} };
            expect(getClientIP(req)).toBeNull();
        });
    });
});
