/**
 * Authentication UI Components
 * Handles login modal and authentication flow
 */

class AuthUI {
    constructor() {
        this.loginModal = null;
        this.init();
    }

    /**
     * Initialize authentication UI
     */
    init() {
        this.createLoginModal();
        this.bindEvents();
    }

    /**
     * Create login modal HTML
     */
    createLoginModal() {
        const modalHTML = `
            <div class="auth-modal hidden" id="auth-modal">
                <div class="modal-content auth-modal-content">
                    <div class="auth-step" id="auth-step-email">
                        <h2>Welcome to Story Collection</h2>
                        <p>Sign in to save your conversations and memories securely.</p>
                        
                        <form id="magic-link-form" class="auth-form">
                            <div class="form-group">
                                <label for="email-input">Email Address</label>
                                <input 
                                    type="email" 
                                    id="email-input" 
                                    class="auth-input" 
                                    placeholder="Enter your email address"
                                    required
                                >
                            </div>
                            <button type="submit" class="auth-btn primary" id="request-magic-link-btn">
                                Send Magic Link
                            </button>
                        </form>
                        
                        <div class="auth-features">
                            <div class="feature">
                                <span class="feature-icon">🔒</span>
                                <div>
                                    <strong>Secure & Private</strong>
                                    <p>Your stories are encrypted and only accessible by you</p>
                                </div>
                            </div>
                            <div class="feature">
                                <span class="feature-icon">💾</span>
                                <div>
                                    <strong>Persistent Storage</strong>
                                    <p>Your conversations and memories are saved across sessions</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="auth-step hidden" id="auth-step-waiting">
                        <h2>Check Your Email</h2>
                        <p>We've sent you a magic link! Click the link in your email to sign in.</p>
                        
                        <div class="email-waiting">
                            <div class="waiting-icon">📧</div>
                            <p class="waiting-text">Waiting for you to click the magic link...</p>
                        </div>
                        
                        <div class="auth-actions">
                            <button class="auth-btn secondary" id="resend-magic-link-btn">
                                Resend Magic Link
                            </button>
                            <button class="auth-btn secondary" id="change-email-btn">
                                Use Different Email
                            </button>
                        </div>
                    </div>
                    
                    <div class="auth-step hidden" id="auth-step-success">
                        <h2>Welcome Back!</h2>
                        <p>You're now signed in. Your stories and memories are ready.</p>
                        
                        <div class="success-icon">✅</div>
                        
                        <button class="auth-btn primary" id="continue-to-app-btn">
                            Continue to Story Collection
                        </button>
                    </div>
                    
                    <div class="auth-step hidden" id="auth-step-error">
                        <h2>Sign In Problem</h2>
                        <p id="auth-error-message">Something went wrong. Please try again.</p>
                        
                        <div class="error-icon">❌</div>
                        
                        <button class="auth-btn primary" id="retry-auth-btn">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.loginModal = document.getElementById('auth-modal');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Magic link form submission
        document.getElementById('magic-link-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleMagicLinkRequest();
        });

        // Resend magic link
        document.getElementById('resend-magic-link-btn').addEventListener('click', () => {
            this.handleMagicLinkRequest();
        });

        // Change email
        document.getElementById('change-email-btn').addEventListener('click', () => {
            this.showStep('email');
        });

        // Continue to app
        document.getElementById('continue-to-app-btn').addEventListener('click', () => {
            this.hideModal();
            // Trigger app initialization
            if (window.initializeAuthenticatedApp) {
                window.initializeAuthenticatedApp();
            }
        });

        // Retry authentication
        document.getElementById('retry-auth-btn').addEventListener('click', () => {
            this.showStep('email');
        });

        // Check for magic link token in URL
        this.checkForMagicLinkToken();
    }

    /**
     * Handle magic link request
     */
    async handleMagicLinkRequest() {
        const emailInput = document.getElementById('email-input');
        const email = emailInput.value.trim();
        const submitBtn = document.getElementById('request-magic-link-btn');

        if (!email) {
            this.showError('Please enter your email address.');
            return;
        }

        try {
            // Show loading state
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            await window.authService.requestMagicLink(email);
            
            // Show waiting step
            this.showStep('waiting');
            
            // Store email for potential resend
            this.currentEmail = email;

        } catch (error) {
            console.error('Magic link request failed:', error);
            this.showError(error.message || 'Failed to send magic link. Please try again.');
        } finally {
            submitBtn.textContent = 'Send Magic Link';
            submitBtn.disabled = false;
        }
    }

    /**
     * Check for magic link token in URL
     */
    checkForMagicLinkToken() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (token) {
            this.verifyMagicLinkToken(token);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    /**
     * Verify magic link token
     */
    async verifyMagicLinkToken(token) {
        try {
            this.showStep('waiting');
            
            const result = await window.authService.verifyMagicLink(token);
            
            // Show success
            this.showStep('success');
            
            // Auto-continue after 2 seconds
            setTimeout(() => {
                this.hideModal();
                if (window.initializeAuthenticatedApp) {
                    window.initializeAuthenticatedApp();
                }
            }, 2000);

        } catch (error) {
            console.error('Magic link verification failed:', error);
            this.showError(error.message || 'Invalid or expired magic link.');
        }
    }

    /**
     * Show specific authentication step
     */
    showStep(stepName) {
        // Hide all steps
        document.querySelectorAll('.auth-step').forEach(step => {
            step.classList.add('hidden');
        });

        // Show requested step
        const step = document.getElementById(`auth-step-${stepName}`);
        if (step) {
            step.classList.remove('hidden');
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        document.getElementById('auth-error-message').textContent = message;
        this.showStep('error');
    }

    /**
     * Show login modal
     */
    showModal() {
        if (this.loginModal) {
            this.loginModal.classList.remove('hidden');
            this.showStep('email');
            
            // Focus email input
            setTimeout(() => {
                document.getElementById('email-input').focus();
            }, 100);
        }
    }

    /**
     * Hide login modal
     */
    hideModal() {
        if (this.loginModal) {
            this.loginModal.classList.add('hidden');
        }
    }

    /**
     * Check if user needs to authenticate
     */
    async checkAuthenticationStatus() {
        if (window.authService.isAuthenticated()) {
            return true;
        }

        // Try to validate existing session
        try {
            await window.authService.validateSession();
            return true;
        } catch (error) {
            // Show login modal
            this.showModal();
            return false;
        }
    }
}

// Create global auth UI instance
window.authUI = new AuthUI();
