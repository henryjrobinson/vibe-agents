/**
 * Environment-specific API Configuration
 * Automatically detects environment and uses appropriate endpoints
 */

// For Render and local server development, always use same-origin API routes
const API_CONFIG = {
    MEMORY_KEEPER: '/api/memory-keeper',
    COLLABORATOR: '/api/collaborator'
};

// Firebase Configuration - these values should be set via environment variables
// In production, these will be injected by the server
const FIREBASE_CONFIG = {
    apiKey: window.ENV?.FIREBASE_API_KEY || "your-api-key",
    authDomain: window.ENV?.FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
    projectId: window.ENV?.FIREBASE_PROJECT_ID || "your-project-id",
    storageBucket: window.ENV?.FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
    messagingSenderId: window.ENV?.FIREBASE_MESSAGING_SENDER_ID || "123456789",
    appId: window.ENV?.FIREBASE_APP_ID || "your-app-id"
};

// Export for use in other modules
window.API_CONFIG = API_CONFIG;
window.FIREBASE_CONFIG = FIREBASE_CONFIG;