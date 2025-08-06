const { query, transaction, healthCheck } = require('../config/database');

describe('Database Operations', () => {
    describe('Database Connection', () => {
        it('should connect to database successfully', async () => {
            const result = await query('SELECT 1 as test');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].test).toBe(1);
        });

        it('should return healthy status', async () => {
            const health = await healthCheck();
            expect(health.status).toBe('healthy');
            expect(health.timestamp).toBeDefined();
            expect(health.pool).toMatchObject({
                totalCount: expect.any(Number),
                idleCount: expect.any(Number),
                waitingCount: expect.any(Number)
            });
        });
    });

    describe('Schema Validation', () => {
        it('should have all required tables', async () => {
            const tables = await query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
            `);

            const tableNames = tables.rows.map(row => row.table_name);
            expect(tableNames).toContain('users');
            expect(tableNames).toContain('conversations');
            expect(tableNames).toContain('messages');
            expect(tableNames).toContain('memories');
            expect(tableNames).toContain('memory_connections');
            expect(tableNames).toContain('magic_link_tokens');
            expect(tableNames).toContain('user_sessions');
        });

        it('should have proper indexes', async () => {
            const indexes = await query(`
                SELECT indexname 
                FROM pg_indexes 
                WHERE schemaname = 'public'
                ORDER BY indexname
            `);

            const indexNames = indexes.rows.map(row => row.indexname);
            expect(indexNames).toContain('idx_conversations_user_id');
            expect(indexNames).toContain('idx_messages_conversation_id');
            expect(indexNames).toContain('idx_memories_user_id');
            expect(indexNames).toContain('idx_memories_category');
            expect(indexNames).toContain('idx_magic_link_tokens_token');
            expect(indexNames).toContain('idx_user_sessions_token');
        });

        it('should have proper foreign key constraints', async () => {
            const constraints = await query(`
                SELECT conname, contype 
                FROM pg_constraint 
                WHERE contype = 'f'
                ORDER BY conname
            `);

            const constraintNames = constraints.rows.map(row => row.conname);
            expect(constraintNames.length).toBeGreaterThan(0);
            // Verify some key foreign key constraints exist
            expect(constraintNames.some(name => name.includes('conversations') && name.includes('user'))).toBe(true);
            expect(constraintNames.some(name => name.includes('messages') && name.includes('conversation'))).toBe(true);
            expect(constraintNames.some(name => name.includes('memories') && name.includes('user'))).toBe(true);
        });
    });

    describe('User Operations', () => {
        it('should create user with all fields', async () => {
            const result = await query(
                'INSERT INTO users (email, name, preferences) VALUES ($1, $2, $3) RETURNING *',
                ['dbtest@example.com', 'DB Test User', JSON.stringify({ theme: 'light' })]
            );

            expect(result.rows).toHaveLength(1);
            const user = result.rows[0];
            expect(user.email).toBe('dbtest@example.com');
            expect(user.name).toBe('DB Test User');
            expect(user.preferences).toEqual({ theme: 'light' });
            expect(user.is_active).toBe(true);
            expect(user.created_at).toBeDefined();
            expect(user.updated_at).toBeDefined();
        });

        it('should enforce unique email constraint', async () => {
            await query('INSERT INTO users (email) VALUES ($1)', ['unique@example.com']);

            await expect(
                query('INSERT INTO users (email) VALUES ($1)', ['unique@example.com'])
            ).rejects.toThrow();
        });

        it('should update updated_at timestamp on user update', async () => {
            const user = await global.testUtils.createTestUser('timestamp@example.com');
            const originalUpdatedAt = user.updated_at;

            await global.testUtils.wait(100); // Wait to ensure timestamp difference

            await query('UPDATE users SET name = $1 WHERE id = $2', ['Updated Name', user.id]);

            const updatedUser = await query('SELECT * FROM users WHERE id = $1', [user.id]);
            expect(updatedUser.rows[0].updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
        });
    });

    describe('Magic Link Token Operations', () => {
        it('should create and retrieve magic link tokens', async () => {
            const email = 'magicdb@example.com';
            const token = 'test_token_' + Date.now();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            await query(
                'INSERT INTO magic_link_tokens (email, token, expires_at) VALUES ($1, $2, $3)',
                [email, token, expiresAt]
            );

            const result = await query('SELECT * FROM magic_link_tokens WHERE email = $1', [email]);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].token).toBe(token);
            expect(result.rows[0].used_at).toBeNull();
        });

        it('should mark token as used', async () => {
            const tokenData = await global.testUtils.createMagicLinkToken('used@example.com');

            await query('UPDATE magic_link_tokens SET used_at = NOW() WHERE id = $1', [tokenData.id]);

            const result = await query('SELECT * FROM magic_link_tokens WHERE id = $1', [tokenData.id]);
            expect(result.rows[0].used_at).not.toBeNull();
        });
    });

    describe('User Session Operations', () => {
        it('should create and manage user sessions', async () => {
            const user = await global.testUtils.createTestUser('session@example.com');
            const sessionToken = 'test_session_' + Date.now();
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            await query(
                'INSERT INTO user_sessions (user_id, session_token, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5)',
                [user.id, sessionToken, expiresAt, 'Test Browser', '192.168.1.1']
            );

            const result = await query('SELECT * FROM user_sessions WHERE user_id = $1', [user.id]);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].session_token).toBe(sessionToken);
            expect(result.rows[0].user_agent).toBe('Test Browser');
            expect(result.rows[0].ip_address).toBe('192.168.1.1');
        });

        it('should cascade delete sessions when user is deleted', async () => {
            const user = await global.testUtils.createTestUser('cascade@example.com');
            await global.testUtils.createUserSession(user.id);

            // Verify session exists
            let sessions = await query('SELECT * FROM user_sessions WHERE user_id = $1', [user.id]);
            expect(sessions.rows).toHaveLength(1);

            // Delete user
            await query('DELETE FROM users WHERE id = $1', [user.id]);

            // Verify session was cascade deleted
            sessions = await query('SELECT * FROM user_sessions WHERE user_id = $1', [user.id]);
            expect(sessions.rows).toHaveLength(0);
        });
    });

    describe('Transaction Support', () => {
        it('should support database transactions', async () => {
            const email = 'transaction@example.com';

            const result = await transaction(async (client) => {
                const userResult = await client.query(
                    'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
                    [email, 'Transaction User']
                );
                const user = userResult.rows[0];

                await client.query(
                    'INSERT INTO magic_link_tokens (email, token, expires_at) VALUES ($1, $2, $3)',
                    [email, 'transaction_token', new Date(Date.now() + 15 * 60 * 1000)]
                );

                return user;
            });

            expect(result.email).toBe(email);

            // Verify both operations were committed
            const userCheck = await query('SELECT * FROM users WHERE email = $1', [email]);
            const tokenCheck = await query('SELECT * FROM magic_link_tokens WHERE email = $1', [email]);
            expect(userCheck.rows).toHaveLength(1);
            expect(tokenCheck.rows).toHaveLength(1);
        });

        it('should rollback transaction on error', async () => {
            const email = 'rollback@example.com';

            await expect(
                transaction(async (client) => {
                    await client.query(
                        'INSERT INTO users (email, name) VALUES ($1, $2)',
                        [email, 'Rollback User']
                    );

                    // This should cause an error and rollback
                    await client.query('INSERT INTO non_existent_table (id) VALUES (1)');
                })
            ).rejects.toThrow();

            // Verify user was not created due to rollback
            const userCheck = await query('SELECT * FROM users WHERE email = $1', [email]);
            expect(userCheck.rows).toHaveLength(0);
        });
    });

    describe('Triggers and Functions', () => {
        it('should have cleanup function for expired tokens', async () => {
            // Create expired token
            const expiredEmail = 'expired@example.com';
            const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
            await query(
                'INSERT INTO magic_link_tokens (email, token, expires_at) VALUES ($1, $2, $3)',
                [expiredEmail, 'expired_token', pastTime]
            );

            // Create expired session
            const user = await global.testUtils.createTestUser('expiredsession@example.com');
            await query(
                'INSERT INTO user_sessions (user_id, session_token, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5)',
                [user.id, 'expired_session', pastTime, 'Test', '127.0.0.1']
            );

            // Run cleanup function
            await query('SELECT cleanup_expired_tokens_and_sessions()');

            // Verify expired items were cleaned up
            const expiredTokens = await query('SELECT * FROM magic_link_tokens WHERE email = $1', [expiredEmail]);
            const expiredSessions = await query('SELECT * FROM user_sessions WHERE session_token = $1', ['expired_session']);

            expect(expiredTokens.rows).toHaveLength(0);
            expect(expiredSessions.rows).toHaveLength(0);
        });

        it('should update updated_at timestamp via trigger', async () => {
            const user = await global.testUtils.createTestUser('trigger@example.com');
            const originalUpdatedAt = user.updated_at;

            await global.testUtils.wait(100);

            // Update user - should trigger updated_at update
            await query('UPDATE users SET name = $1 WHERE id = $2', ['Trigger Test', user.id]);

            const updatedUser = await query('SELECT * FROM users WHERE id = $1', [user.id]);
            expect(updatedUser.rows[0].updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            await expect(
                query('SELECT * FROM non_existent_table')
            ).rejects.toThrow();
        });

        it('should handle constraint violations', async () => {
            await expect(
                query('INSERT INTO users (email) VALUES (NULL)')
            ).rejects.toThrow();
        });

        it('should handle invalid SQL', async () => {
            await expect(
                query('INVALID SQL STATEMENT')
            ).rejects.toThrow();
        });
    });
});
