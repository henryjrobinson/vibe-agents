// API Configuration
// This file centralizes all API endpoint configuration for easy deployment updates

class APIConfig {
    constructor() {
        // Determine the API base URL based on environment
        this.baseURL = this.getAPIBaseURL();
    }

    getAPIBaseURL() {
        // Check if we're in development (localhost)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3001'; // Local development server
        }
        
        // Production: Use Render backend URL
        // Update this with your actual Render app URL after deployment
        return 'https://YOUR-ACTUAL-RENDER-URL.onrender.com'; // Replace with your actual Render URL from dashboard
    }

    // Get full API endpoint URL
    getEndpoint(path) {
        return `${this.baseURL}${path}`;
    }

    // Common API endpoints
    get endpoints() {
        return {
            // Authentication
            requestMagicLink: this.getEndpoint('/api/auth/request-magic-link'),
            verifyMagicLink: this.getEndpoint('/api/auth/verify-magic-link'),
            verifySession: this.getEndpoint('/api/auth/verify-session'),
            logout: this.getEndpoint('/api/auth/logout'),
            
            // Conversations
            conversations: this.getEndpoint('/api/conversations'),
            
            // Memory and AI
            collaborator: this.getEndpoint('/api/collaborator'),
            memoryKeeper: this.getEndpoint('/api/memory-keeper'),
            
            // Health check
            health: this.getEndpoint('/api/health')
        };
    }
}

// Create global API config instance
window.API = new APIConfig();

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIConfig;
}
