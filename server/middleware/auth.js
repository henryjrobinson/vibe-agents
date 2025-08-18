// Firebase Authentication Middleware for Express
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseApp;

function initializeFirebaseAdmin() {
    if (firebaseApp) return firebaseApp;
    
    try {
        // In production, use service account key from environment
        // Prefer Base64 variant to avoid fragile JSON escaping in env systems
        let serviceAccount = null;
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) {
            try {
                const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64, 'base64').toString('utf8');
                serviceAccount = JSON.parse(decoded);
                console.log('🔥 Firebase Admin: using Base64 credentials from FIREBASE_SERVICE_ACCOUNT_KEY_B64');
            } catch (b64Err) {
                console.error('❌ Failed to decode/parse FIREBASE_SERVICE_ACCOUNT_KEY_B64:', b64Err.message);
            }
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            try {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                console.log('🔥 Firebase Admin: using JSON credentials from FIREBASE_SERVICE_ACCOUNT_KEY');
            } catch (jsonErr) {
                console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', jsonErr.message);
            }
        }
        
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
        // Test bypass: allow tests to set a fake user without real Firebase
        if (process.env.TEST_BYPASS_AUTH === '1') {
            req.user = {
                uid: process.env.TEST_BYPASS_UID || 'test-uid',
                email: process.env.TEST_BYPASS_EMAIL || 'test@example.com',
                emailVerified: true
            };
            return next();
        }

        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'No valid authorization header provided' 
            });
        }
        
        const idToken = authHeader.split('Bearer ')[1];
        
        if (!firebaseApp) {
            console.error('❌ Firebase Admin not initialized - authentication required');
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
