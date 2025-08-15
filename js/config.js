/**
 * Environment-specific API Configuration
 * Automatically detects environment and uses appropriate endpoints
 */

// For Render and local server development, always use same-origin API routes
const API_CONFIG = {
    MEMORY_KEEPER: '/api/memory-keeper',
    COLLABORATOR: '/api/collaborator'
};

// Export for use in other modules
window.API_CONFIG = API_CONFIG;
console.log(`🔗 API Endpoints:`, API_CONFIG);