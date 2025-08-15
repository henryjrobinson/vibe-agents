/**
 * Environment-specific API Configuration
 * Automatically detects environment and uses appropriate endpoints
 */

// Detect environment
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const isNetlifyDev = window.location.port === '8888';

// API endpoint configuration
const API_CONFIG = {
    // Production uses /api/ redirects from netlify.toml
    // Development uses direct /.netlify/functions/ endpoints
    MEMORY_KEEPER: isProduction ? '/api/memory-keeper' : '/.netlify/functions/memory-keeper',
    COLLABORATOR: isProduction ? '/api/collaborator' : '/.netlify/functions/collaborator'
};

// Export for use in other modules
window.API_CONFIG = API_CONFIG;

console.log(`🌍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`🔗 API Endpoints:`, API_CONFIG);