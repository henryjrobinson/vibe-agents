/**
 * Authentication Service for Server-Centric Architecture
 * Handles magic link authentication and session management
 */

class AuthService {
    constructor() {
        this.baseURL = 'http://localhost:3000/api';
        this.sessionToken = null;
        this.user = null;
        this.init();
    }

    /**
     * Initialize authentication service
     */
    async init() {
        // Check for existing session token
        this.sessionToken = localStorage.getItem('session_token');
        if (this.sessionToken) {
            try {
                await this.validateSession();
            } catch (error) {
                console.log('Session expired, clearing token');
                this.clearSession();
            }
        }
    }

    /**
     * Request magic link authentication
     */
    async requestMagicLink(email) {
        try {
            const response = await fetch(`${this.baseURL}/auth/request-magic-link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to request magic link');
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Magic link request failed:', error);
            throw error;
        }
    }

    /**
     * Verify magic link token
     */
    async verifyMagicLink(token) {
        try {
            const response = await fetch(`${this.baseURL}/auth/verify-magic-link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Invalid magic link');
            }

            const result = await response.json();
            
            // Store session token and user info
            this.sessionToken = result.sessionToken;
            this.user = result.user;
            localStorage.setItem('session_token', this.sessionToken);
            
            return result;
        } catch (error) {
            console.error('Magic link verification failed:', error);
            throw error;
        }
    }

    /**
     * Validate current session
     */
    async validateSession() {
        if (!this.sessionToken) {
            throw new Error('No session token');
        }

        try {
            const response = await fetch(`${this.baseURL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Session invalid');
            }

            const result = await response.json();
            this.user = result.user;
            return result;
        } catch (error) {
            console.error('Session validation failed:', error);
            this.clearSession();
            throw error;
        }
    }

    /**
     * Logout user
     */
    async logout() {
        if (this.sessionToken) {
            try {
                await fetch(`${this.baseURL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.sessionToken}`
                    }
                });
            } catch (error) {
                console.error('Logout request failed:', error);
            }
        }
        
        this.clearSession();
    }

    /**
     * Set session token (for development backdoor)
     */
    setSessionToken(token) {
        this.sessionToken = token;
        localStorage.setItem('session_token', token);
        console.log('✅ Session token set successfully');
        
        // Validate the session to get user info
        this.validateSession().catch(error => {
            console.error('Failed to validate session after setting token:', error);
        });
    }

    /**
     * Clear local session data
     */
    clearSession() {
        this.sessionToken = null;
        this.user = null;
        localStorage.removeItem('session_token');
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.sessionToken && this.user;
    }

    /**
     * Get authorization headers for API requests
     */
    getAuthHeaders() {
        if (!this.sessionToken) {
            throw new Error('Not authenticated');
        }
        
        return {
            'Authorization': `Bearer ${this.sessionToken}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Make authenticated API request
     */
    async authenticatedFetch(url, options = {}) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const headers = {
            ...this.getAuthHeaders(),
            ...(options.headers || {})
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        // Handle authentication errors
        if (response.status === 401) {
            this.clearSession();
            throw new Error('Session expired. Please sign in again.');
        }

        return response;
    }
}

// Create global auth service instance
window.authService = new AuthService();
