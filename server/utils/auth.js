const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');

// Generate secure random token
const generateSecureToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

// Generate JWT token
const generateJWT = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '30d',
        issuer: 'vibe-agents',
        audience: 'vibe-agents-users'
    });
};

// Verify JWT token
const verifyJWT = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET, {
            issuer: 'vibe-agents',
            audience: 'vibe-agents-users'
        });
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

// Create magic link token
const createMagicLinkToken = async (email) => {
    const token = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + (15 * 60 * 1000)); // 15 minutes
    
    // Store token in database
    await query(
        'INSERT INTO magic_link_tokens (email, token, expires_at) VALUES ($1, $2, $3)',
        [email, token, expiresAt]
    );
    
    return { token, expiresAt };
};

// Verify magic link token
const verifyMagicLinkToken = async (token) => {
    const result = await query(
        'SELECT * FROM magic_link_tokens WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL',
        [token]
    );
    
    if (result.rows.length === 0) {
        throw new Error('Invalid or expired magic link token');
    }
    
    const tokenData = result.rows[0];
    
    // Mark token as used
    await query(
        'UPDATE magic_link_tokens SET used_at = NOW() WHERE id = $1',
        [tokenData.id]
    );
    
    return tokenData;
};

// Create user session
const createUserSession = async (userId, userAgent, ipAddress) => {
    const sessionToken = generateJWT({ userId, type: 'session' });
    const expiresAt = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    
    // Store session in database and return the full session object
    const result = await query(
        'INSERT INTO user_sessions (user_id, session_token, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [userId, sessionToken, expiresAt, userAgent, ipAddress]
    );
    
    return result.rows[0];
};

// Verify user session
const verifyUserSession = async (sessionToken) => {
    try {
        // Verify JWT structure and get payload
        const decoded = verifyJWT(sessionToken);
        
        if (!decoded.userId || decoded.type !== 'session') {
            throw new Error('Invalid session token format');
        }
        
        // Check if session exists in database and is not expired
        // Look up by the actual token since we store the full JWT
        const result = await query(
            'SELECT us.*, u.email, u.name, u.is_active FROM user_sessions us JOIN users u ON us.user_id = u.id WHERE us.session_token = $1 AND us.expires_at > NOW() AND us.user_id = $2',
            [sessionToken, decoded.userId]
        );
        
        if (result.rows.length === 0) {
            throw new Error('Session not found or expired');
        }
        
        const session = result.rows[0];
        
        if (!session.is_active) {
            throw new Error('User account is inactive');
        }
        
        // Update last accessed time
        await query(
            'UPDATE user_sessions SET last_accessed = NOW() WHERE id = $1',
            [session.id]
        );
        
        return {
            userId: session.user_id,
            email: session.email,
            name: session.name,
            sessionId: session.id
        };
    } catch (error) {
        throw new Error('Invalid session: ' + error.message);
    }
};

// Invalidate user session
const invalidateUserSession = async (sessionToken) => {
    await query(
        'DELETE FROM user_sessions WHERE session_token = $1',
        [sessionToken]
    );
};

// Cleanup expired tokens and sessions
const cleanupExpiredTokensAndSessions = async () => {
    try {
        const result = await query('SELECT cleanup_expired_tokens_and_sessions()');
        console.log('🧹 Cleaned up expired tokens and sessions');
        return result;
    } catch (error) {
        console.error('❌ Error cleaning up expired tokens:', error);
        throw error;
    }
};

// Validate email format
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Extract IP address from request
const getClientIP = (req) => {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.ip;
};

module.exports = {
    generateSecureToken,
    generateJWT,
    verifyJWT,
    createMagicLinkToken,
    verifyMagicLinkToken,
    createUserSession,
    verifyUserSession,
    invalidateUserSession,
    cleanupExpiredTokensAndSessions,
    isValidEmail,
    getClientIP
};
