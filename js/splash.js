/**
 * Splash Page Authentication Logic
 * Handles the step-by-step login flow on the landing page
 */

class SplashAuth {
    constructor() {
        this.currentStep = 'login';
        this.userEmail = '';
        this.init();
    }

    async init() {
        console.log('🎬 Splash page initializing...');
        
        // Wait for auth service to load
        await this.waitForServices();
        
        // Check for magic link token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (token) {
            console.log('🔗 Magic link token found, verifying...');
            await this.verifyMagicLinkToken(token);
            return;
        }
        
        // Check if user is already authenticated
        if (window.authService && window.authService.isAuthenticated()) {
            console.log('✅ User already authenticated, showing success step');
            this.showStep('success');
        } else {
            console.log('🔐 User not authenticated, showing login step');
            this.showStep('login');
        }
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check for background video
        this.setupBackgroundVideo();
        
        // Handle magic link verification if present in URL
        this.handleMagicLinkVerification();
    }

    async waitForServices() {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds timeout
        
        return new Promise((resolve) => {
            const checkServices = setInterval(() => {
                attempts++;
                if (window.authService && window.conversationService) {
                    clearInterval(checkServices);
                    console.log('✅ Services loaded successfully');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkServices);
                    console.error('❌ Services failed to load');
                    resolve(); // Continue anyway
                }
            }, 100);
        });
    }

    setupEventListeners() {
        // Magic link form submission
        const magicLinkForm = document.getElementById('magic-link-form');
        if (magicLinkForm) {
            magicLinkForm.addEventListener('submit', (e) => this.handleMagicLinkRequest(e));
        }

        // Resend magic link
        const resendBtn = document.getElementById('resend-magic-link-btn');
        if (resendBtn) {
            resendBtn.addEventListener('click', () => this.resendMagicLink());
        }

        // Change email
        const changeEmailBtn = document.getElementById('change-email-btn');
        if (changeEmailBtn) {
            changeEmailBtn.addEventListener('click', () => this.showStep('login'));
        }

        // Continue to app
        const continueBtn = document.getElementById('continue-to-app-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.continueToApp());
        }

        // Retry authentication
        const retryBtn = document.getElementById('retry-auth-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.showStep('login'));
        }
    }

    setupBackgroundVideo() {
        const video = document.getElementById('background-video');
        const videoBackground = document.querySelector('.video-background');
        
        // Check if video source exists
        const videoSources = video.querySelectorAll('source');
        let hasValidSource = false;
        
        videoSources.forEach(source => {
            if (source.src && source.src.trim() !== '') {
                hasValidSource = true;
            }
        });
        
        if (hasValidSource) {
            document.body.classList.add('has-video');
            console.log('🎥 Background video detected and enabled');
            
            // Ensure video properties are set
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            
            // Handle video events
            video.addEventListener('loadeddata', () => {
                console.log('✅ Background video loaded successfully');
            });
            
            video.addEventListener('error', () => {
                console.warn('⚠️ Background video failed to load, using gradient fallback');
                document.body.classList.remove('has-video');
            });
            
            // Attempt to play
            video.play().catch(error => {
                console.log('Video autoplay prevented by browser (normal):', error.message);
            });
        } else {
            console.log('🎨 No background video, using gradient background');
            document.body.classList.remove('has-video');
        }
    }

    async handleMagicLinkRequest(e) {
        e.preventDefault();
        
        const emailInput = document.getElementById('email-input');
        const submitBtn = document.getElementById('request-magic-link-btn');
        
        if (!emailInput || !submitBtn) return;
        
        const email = emailInput.value.trim();
        if (!email) {
            this.showError('Please enter your email address');
            return;
        }
        
        this.userEmail = email;
        
        // Show loading state
        submitBtn.classList.add('loading');
        
        try {
            console.log('📧 Requesting magic link for:', email);
            
            if (!window.authService) {
                throw new Error('Authentication service not available');
            }
            
            await window.authService.requestMagicLink(email);
            console.log('✅ Magic link sent successfully');
            
            // Show waiting step
            this.showStep('waiting');
            
        } catch (error) {
            console.error('❌ Magic link request failed:', error);
            this.showError(error.message || 'Failed to send magic link. Please try again.');
        } finally {
            submitBtn.classList.remove('loading');
        }
    }

    async verifyMagicLinkToken(token) {
        console.log('🔗 Verifying magic link token...');
        this.showStep('verifying');
        
        try {
            if (!window.authService) {
                throw new Error('Authentication service not available');
            }
            
            // Call the backend API to verify the token
            const response = await fetch('http://localhost:3000/api/auth/verify-magic-link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Token verification failed');
            }
            
            const data = await response.json();
            console.log('✅ Magic link verified successfully:', data);
            
            // Store the session token
            if (data.sessionToken) {
                window.authService.setSessionToken(data.sessionToken);
            }
            
            // Clean up URL (remove token parameter)
            const url = new URL(window.location);
            url.searchParams.delete('token');
            window.history.replaceState({}, document.title, url.toString());
            
            // Show success step
            this.showStep('success');
            
        } catch (error) {
            console.error('❌ Magic link verification failed:', error);
            this.showError(error.message || 'Invalid or expired magic link. Please try again.');
        }
    }

    async resendMagicLink() {
        if (!this.userEmail) {
            this.showStep('login');
            return;
        }
        
        const resendBtn = document.getElementById('resend-magic-link-btn');
        if (resendBtn) {
            resendBtn.classList.add('loading');
            resendBtn.textContent = 'Sending...';
        }
        
        try {
            await window.authService.requestMagicLink(this.userEmail);
            console.log('✅ Magic link resent successfully');
            
            // Show brief confirmation
            if (resendBtn) {
                resendBtn.textContent = 'Sent!';
                setTimeout(() => {
                    resendBtn.textContent = 'Resend Magic Link';
                    resendBtn.classList.remove('loading');
                }, 2000);
            }
            
        } catch (error) {
            console.error('❌ Resend magic link failed:', error);
            this.showError(error.message || 'Failed to resend magic link');
            
            if (resendBtn) {
                resendBtn.textContent = 'Resend Magic Link';
                resendBtn.classList.remove('loading');
            }
        }
    }

    async handleMagicLinkVerification() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (!token) return;
        
        console.log('🔑 Magic link token detected, verifying...');
        
        try {
            if (!window.authService) {
                throw new Error('Authentication service not available');
            }
            
            await window.authService.verifyMagicLink(token);
            console.log('✅ Magic link verification successful');
            
            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Show success step
            this.showStep('success');
            
        } catch (error) {
            console.error('❌ Magic link verification failed:', error);
            this.showError(error.message || 'Invalid or expired magic link');
        }
    }

    continueToApp() {
        console.log('🚀 Continuing to main app...');
        
        // Redirect to main app
        window.location.href = 'index.html';
    }

    showStep(stepName) {
        console.log(`📋 Showing step: ${stepName}`);
        
        // Hide all steps
        const allSteps = document.querySelectorAll('.auth-step');
        allSteps.forEach(step => {
            step.classList.remove('active');
        });
        
        // Show target step
        const targetStep = document.getElementById(`step-${stepName}`);
        if (targetStep) {
            targetStep.classList.add('active');
            this.currentStep = stepName;
        }
        
        // Focus appropriate input
        if (stepName === 'login') {
            setTimeout(() => {
                const emailInput = document.getElementById('email-input');
                if (emailInput) emailInput.focus();
            }, 300);
        }
    }

    showError(message) {
        console.error('❌ Showing error:', message);
        
        const errorMessageEl = document.getElementById('error-message');
        if (errorMessageEl) {
            errorMessageEl.textContent = message;
        }
        
        this.showStep('error');
    }
}

// Initialize splash page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 DOM loaded, initializing splash page...');
    window.splashAuth = new SplashAuth();
});

// Handle page visibility changes (for magic link verification)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.splashAuth) {
        // Page became visible, check if user got authenticated
        setTimeout(() => {
            if (window.authService && window.authService.isAuthenticated() && 
                window.splashAuth.currentStep !== 'success') {
                console.log('✅ User authenticated while page was hidden');
                window.splashAuth.showStep('success');
            }
        }, 1000);
    }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SplashAuth;
}
