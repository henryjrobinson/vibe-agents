const { verifyUserSession, getClientIP } = require('../utils/auth');

// Authentication middleware
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please provide a valid authentication token',
                timestamp: new Date().toISOString()
            });
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        // Verify session
        const user = await verifyUserSession(token);
        
        // Add user info to request object
        req.user = user;
        req.sessionToken = token;
        
        next();
    } catch (error) {
        console.error('❌ Authentication error:', error.message);
        return res.status(401).json({
            error: 'Invalid authentication',
            message: 'Your session has expired or is invalid. Please sign in again.',
            timestamp: new Date().toISOString()
        });
    }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const user = await verifyUserSession(token);
            req.user = user;
            req.sessionToken = token;
        }
        
        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};

// User ownership middleware (ensures user can only access their own data)
const requireOwnership = (resourceUserIdField = 'user_id') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                timestamp: new Date().toISOString()
            });
        }
        
        // Check if user owns the resource
        const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField] || req.query[resourceUserIdField];
        
        if (resourceUserId && parseInt(resourceUserId) !== req.user.userId) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only access your own data',
                timestamp: new Date().toISOString()
            });
        }
        
        next();
    };
};

// Admin middleware (for future admin features)
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                timestamp: new Date().toISOString()
            });
        }
        
        // For now, we don't have admin roles, so this will always deny
        // In the future, check user role in database
        return res.status(403).json({
            error: 'Admin access required',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Admin check error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
};

// Rate limiting middleware for sensitive operations
const sensitiveOperationLimit = (windowMs = 5 * 60 * 1000, maxAttempts = 5) => {
    const attempts = new Map();
    
    return (req, res, next) => {
        const clientIP = getClientIP(req);
        const key = `${clientIP}:${req.path}`;
        const now = Date.now();
        
        // Clean up old entries
        for (const [k, data] of attempts.entries()) {
            if (now - data.firstAttempt > windowMs) {
                attempts.delete(k);
            }
        }
        
        // Check current attempts
        const userAttempts = attempts.get(key);
        
        if (!userAttempts) {
            attempts.set(key, { count: 1, firstAttempt: now });
            return next();
        }
        
        if (userAttempts.count >= maxAttempts) {
            const timeLeft = Math.ceil((windowMs - (now - userAttempts.firstAttempt)) / 1000);
            return res.status(429).json({
                error: 'Too many attempts',
                message: `Please wait ${timeLeft} seconds before trying again`,
                retryAfter: timeLeft,
                timestamp: new Date().toISOString()
            });
        }
        
        userAttempts.count++;
        next();
    };
};

module.exports = {
    authenticateUser,
    optionalAuth,
    requireOwnership,
    requireAdmin,
    sensitiveOperationLimit
};
