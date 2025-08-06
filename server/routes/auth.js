const express = require('express');
const Joi = require('joi');
const { query, transaction } = require('../config/database');
const { 
    createMagicLinkToken, 
    verifyMagicLinkToken, 
    createUserSession, 
    invalidateUserSession,
    isValidEmail,
    getClientIP 
} = require('../utils/auth');
const emailService = require('../services/email');
const { authenticateUser, sensitiveOperationLimit } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const requestMagicLinkSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email address is required'
    }),
    name: Joi.string().min(1).max(255).optional()
});

const verifyMagicLinkSchema = Joi.object({
    token: Joi.string().length(64).required().messages({
        'string.length': 'Invalid token format',
        'any.required': 'Token is required'
    })
});

// Request magic link endpoint
router.post('/request-magic-link', 
    sensitiveOperationLimit(5 * 60 * 1000, 3), // 3 attempts per 5 minutes
    async (req, res) => {
        try {
            // Validate request
            const { error, value } = requestMagicLinkSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: error.details[0].message,
                    timestamp: new Date().toISOString()
                });
            }

            const { email, name } = value;
            const clientIP = getClientIP(req);

            console.log(`📧 Magic link requested for ${email} from ${clientIP}`);

            // Check if user exists, create if not
            let user;
            const existingUser = await query('SELECT * FROM users WHERE email = $1', [email]);
            
            if (existingUser.rows.length > 0) {
                user = existingUser.rows[0];
                console.log(`👤 Existing user found: ${user.id}`);
            } else {
                // Create new user
                const newUserResult = await query(
                    'INSERT INTO users (email, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
                    [email, name || null]
                );
                user = newUserResult.rows[0];
                console.log(`👤 New user created: ${user.id}`);
                
                // Send welcome email (non-blocking)
                emailService.sendWelcomeEmail(email, name).catch(err => {
                    console.error('❌ Failed to send welcome email:', err);
                });
            }

            // Create magic link token
            const { token, expiresAt } = await createMagicLinkToken(email);

            // Send magic link email
            await emailService.sendMagicLink(email, token, user.name);

            res.json({
                success: true,
                message: 'Login link sent to your email address',
                expiresAt: expiresAt.toISOString(),
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Magic link request error:', error);
            res.status(500).json({
                error: 'Failed to send login link',
                message: 'Please try again in a few moments',
                timestamp: new Date().toISOString()
            });
        }
    }
);

// Verify magic link endpoint
router.post('/verify-magic-link', 
    sensitiveOperationLimit(5 * 60 * 1000, 10), // 10 attempts per 5 minutes
    async (req, res) => {
        try {
            // Validate request
            const { error, value } = verifyMagicLinkSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: error.details[0].message,
                    timestamp: new Date().toISOString()
                });
            }

            const { token } = value;
            const clientIP = getClientIP(req);
            const userAgent = req.headers['user-agent'] || 'Unknown';

            console.log(`🔐 Magic link verification attempted from ${clientIP}`);

            // Verify magic link token
            const tokenData = await verifyMagicLinkToken(token);
            
            // Get user data
            const userResult = await query('SELECT * FROM users WHERE email = $1', [tokenData.email]);
            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }
            
            const user = userResult.rows[0];

            // Create user session
            const session = await createUserSession(user.id, userAgent, clientIP);
            const sessionToken = session.session_token;

            // Update user's last login
            await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

            console.log(`✅ User ${user.email} logged in successfully`);

            res.json({
                success: true,
                message: 'Login successful',
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    createdAt: user.created_at,
                    lastLogin: new Date().toISOString()
                },
                sessionToken,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Magic link verification error:', error);
            res.status(400).json({
                error: 'Invalid or expired login link',
                message: 'Please request a new login link',
                timestamp: new Date().toISOString()
            });
        }
    }
);

// Get current user endpoint
router.get('/me', authenticateUser, async (req, res) => {
    try {
        // Get fresh user data
        const userResult = await query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                timestamp: new Date().toISOString()
            });
        }

        const user = userResult.rows[0];

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.created_at,
                lastLogin: user.last_login,
                preferences: user.preferences
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Get user error:', error);
        res.status(500).json({
            error: 'Failed to get user information',
            timestamp: new Date().toISOString()
        });
    }
});

// Update user profile endpoint
router.put('/profile', authenticateUser, async (req, res) => {
    try {
        const updateSchema = Joi.object({
            name: Joi.string().min(1).max(255).optional(),
            preferences: Joi.object().optional()
        });

        const { error, value } = updateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation error',
                message: error.details[0].message,
                timestamp: new Date().toISOString()
            });
        }

        const updates = [];
        const values = [];
        let paramCount = 1;

        if (value.name !== undefined) {
            updates.push(`name = $${paramCount}`);
            values.push(value.name);
            paramCount++;
        }

        if (value.preferences !== undefined) {
            updates.push(`preferences = $${paramCount}`);
            values.push(JSON.stringify(value.preferences));
            paramCount++;
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No updates provided',
                timestamp: new Date().toISOString()
            });
        }

        updates.push(`updated_at = NOW()`);
        values.push(req.user.userId);

        const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        const result = await query(updateQuery, values);

        const user = result.rows[0];

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.created_at,
                updatedAt: user.updated_at,
                preferences: user.preferences
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Update profile error:', error);
        res.status(500).json({
            error: 'Failed to update profile',
            timestamp: new Date().toISOString()
        });
    }
});

// Logout endpoint
router.post('/logout', authenticateUser, async (req, res) => {
    try {
        // Invalidate current session
        await invalidateUserSession(req.sessionToken);

        console.log(`👋 User ${req.user.email} logged out`);

        res.json({
            success: true,
            message: 'Logged out successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({
            error: 'Failed to logout',
            timestamp: new Date().toISOString()
        });
    }
});

// Logout all sessions endpoint
router.post('/logout-all', authenticateUser, async (req, res) => {
    try {
        // Invalidate all user sessions
        await query('DELETE FROM user_sessions WHERE user_id = $1', [req.user.userId]);

        console.log(`👋 All sessions invalidated for user ${req.user.email}`);

        res.json({
            success: true,
            message: 'Logged out from all devices',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Logout all error:', error);
        res.status(500).json({
            error: 'Failed to logout from all devices',
            timestamp: new Date().toISOString()
        });
    }
});

// Health check for auth service
router.get('/health', async (req, res) => {
    try {
        // Test database connection
        await query('SELECT 1');
        
        // Test email service
        const emailStatus = await emailService.testConnection();

        res.json({
            status: 'healthy',
            services: {
                database: 'connected',
                email: emailStatus.success ? 'connected' : 'disconnected',
                emailMessage: emailStatus.message
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
