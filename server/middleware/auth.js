// Firebase Authentication Middleware for Express
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseApp;

function initializeFirebaseAdmin() {
    if (firebaseApp) return firebaseApp;
    
    try {
        // In production, use service account key from environment
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
            : null;
        
        // Prefer explicit service account when provided
        if (serviceAccount) {
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            }, 'story-collection-admin');
            console.log('🔥 Firebase Admin SDK initialized with service account');
            return firebaseApp;
        }

        // Otherwise, try Application Default Credentials first
        const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-project';
        try {
            firebaseApp = admin.initializeApp({
                projectId,
                credential: admin.credential.applicationDefault()
            }, 'story-collection-admin');
            console.log('🔥 Firebase Admin SDK initialized with Application Default Credentials');
            return firebaseApp;
        } catch (adcErr) {
            console.warn('⚠️ Firebase Admin ADC initialization failed, attempting projectId-only mode:', adcErr.message);
            // Final fallback: initialize with projectId only (sufficient for verifying ID tokens via public keys)
            try {
                firebaseApp = admin.initializeApp({ projectId }, 'story-collection-admin');
                console.log('🔥 Firebase Admin SDK initialized with projectId-only mode');
                return firebaseApp;
            } catch (finalErr) {
                console.error('❌ Firebase Admin final initialization failed:', finalErr.message);
                // Return null to allow graceful degradation in development
                return null;
            }
        }
    } catch (error) {
        console.error('❌ Firebase Admin initialization failed:', error.message);
        // Return null to allow graceful degradation in development
        return null;
    }
}

// Middleware to verify Firebase ID tokens
async function verifyFirebaseToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'No valid authorization header provided' 
            });
        }
        
        const idToken = authHeader.split('Bearer ')[1];
        
        if (!firebaseApp) {
            console.warn('⚠️ Firebase Admin not initialized, skipping token verification');
            // In development, allow requests to proceed without authentication
            if (process.env.NODE_ENV === 'development') {
                req.user = { uid: 'dev-user', email: 'dev@example.com' };
                return next();
            }
            return res.status(500).json({ 
                error: 'Server Error', 
                message: 'Authentication service unavailable' 
            });
        }
        
        // Verify the ID token
        const decodedToken = await admin.auth(firebaseApp).verifyIdToken(idToken);
        
        // Add user info to request
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified,
            name: decodedToken.name,
            picture: decodedToken.picture
        };
        
        console.log(`✅ Authenticated user: ${req.user.email}`);
        next();
        
    } catch (error) {
        console.error('❌ Token verification failed:', error.message);
        
        // Provide specific error messages for different failure types
        let errorMessage = 'Invalid authentication token';
        
        if (error.code === 'auth/id-token-expired') {
            errorMessage = 'Authentication token has expired. Please sign in again.';
        } else if (error.code === 'auth/id-token-revoked') {
            errorMessage = 'Authentication token has been revoked. Please sign in again.';
        } else if (error.code === 'auth/invalid-id-token') {
            errorMessage = 'Invalid authentication token format.';
        }
        
        return res.status(401).json({ 
            error: 'Unauthorized', 
            message: errorMessage,
            code: error.code 
        });
    }
}

// Optional middleware - allows both authenticated and anonymous access
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No auth header, proceed as anonymous user
            req.user = null;
            return next();
        }
        
        // Try to verify token, but don't fail if invalid
        await verifyFirebaseToken(req, res, next);
    } catch (error) {
        // Log error but proceed as anonymous user
        console.warn('⚠️ Optional auth failed, proceeding as anonymous:', error.message);
        req.user = null;
        next();
    }
}

// Middleware to ensure user data isolation
function ensureUserScope(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ 
            error: 'Unauthorized', 
            message: 'User authentication required for this operation' 
        });
    }
    
    // Add user ID to request for data scoping
    req.userId = req.user.uid;
    next();
}

// Initialize Firebase Admin on module load
initializeFirebaseAdmin();

module.exports = {
    verifyFirebaseToken,
    optionalAuth,
    ensureUserScope,
    initializeFirebaseAdmin
};
