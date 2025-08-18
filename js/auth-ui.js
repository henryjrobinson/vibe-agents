// Authentication UI Management
class AuthUI {
    constructor() {
        this.currentView = 'signin'; // 'signin', 'signup', 'forgot'
        this.isLoading = false;
        this.lastAction = null; // Store last action for retry functionality
        this.retryCount = 0;
        this.maxRetries = 3;
        this.init();
    }

    init() {
        this.createAuthModal();
        this.bindEvents();
        this.setupAuthStateListener();
    }

    createAuthModal() {
        // Prevent duplicate modal injection if already present
        if (document.getElementById('auth-modal')) {
            return;
        }
        // Create modal HTML
        const modalHTML = `
            <div id="auth-modal" class="auth-modal hidden">
                <div class="auth-modal-content">
                    <div class="auth-header">
                        <h2 id="auth-title">Welcome Back</h2>
                        <button class="auth-close" id="auth-close-btn">&times;</button>
                    </div>
                    
                    <div class="auth-body">
                        <!-- Sign In Form -->
                        <form id="signin-form" class="auth-form">
                            <div class="form-group">
                                <label for="signin-email">Email</label>
                                <input type="email" id="signin-email" required>
                            </div>
                            <div class="form-group">
                                <label for="signin-password">Password</label>
                                <input type="password" id="signin-password" required>
                            </div>
                            <button type="submit" class="auth-btn primary" id="signin-btn">
                                <span class="btn-text">Sign In</span>
                                <span class="btn-spinner hidden">⏳</span>
                            </button>
                        </form>

                        <!-- Sign Up Form -->
                        <form id="signup-form" class="auth-form hidden">
                            <div class="form-group">
                                <label for="signup-email">Email</label>
                                <input type="email" id="signup-email" required>
                            </div>
                            <div class="form-group">
                                <label for="signup-password">Password</label>
                                <input type="password" id="signup-password" required minlength="6">
                                <small>At least 6 characters</small>
                            </div>
                            <div class="form-group">
                                <label for="signup-confirm">Confirm Password</label>
                                <input type="password" id="signup-confirm" required minlength="6">
                            </div>
                            <button type="submit" class="auth-btn primary" id="signup-btn">
                                <span class="btn-text">Create Account</span>
                                <span class="btn-spinner hidden">⏳</span>
                            </button>
                        </form>

                        <!-- Forgot Password Form -->
                        <form id="forgot-form" class="auth-form hidden">
                            <div class="form-group">
                                <label for="forgot-email">Email</label>
                                <input type="email" id="forgot-email" required>
                            </div>
                            <button type="submit" class="auth-btn primary" id="forgot-btn">
                                <span class="btn-text">Send Reset Email</span>
                                <span class="btn-spinner hidden">⏳</span>
                            </button>
                        </form>

                        <!-- Messages -->
                        <div id="auth-message" class="auth-message hidden"></div>

                        <!-- Form Switchers -->
                        <div class="auth-switchers">
                            <div id="signin-switchers" class="switcher-group">
                                <button type="button" class="auth-link" id="show-signup">Don't have an account? Sign up</button>
                                <button type="button" class="auth-link" id="show-forgot">Forgot password?</button>
                            </div>
                            <div id="signup-switchers" class="switcher-group hidden">
                                <button type="button" class="auth-link" id="show-signin-from-signup">Already have an account? Sign in</button>
                            </div>
                            <div id="forgot-switchers" class="switcher-group hidden">
                                <button type="button" class="auth-link" id="show-signin-from-forgot">Back to sign in</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    bindEvents() {
        // Modal controls
        document.getElementById('auth-close-btn').addEventListener('click', () => this.hideModal());
        document.getElementById('auth-modal').addEventListener('click', (e) => {
            if (e.target.id === 'auth-modal') this.hideModal();
        });

        // Form submissions
        document.getElementById('signin-form').addEventListener('submit', (e) => this.handleSignIn(e));
        document.getElementById('signup-form').addEventListener('submit', (e) => this.handleSignUp(e));
        document.getElementById('forgot-form').addEventListener('submit', (e) => this.handleForgotPassword(e));

        // Form switchers
        document.getElementById('show-signup').addEventListener('click', () => this.switchView('signup'));
        document.getElementById('show-signin-from-signup').addEventListener('click', () => this.switchView('signin'));
        document.getElementById('show-forgot').addEventListener('click', () => this.switchView('forgot'));
        document.getElementById('show-signin-from-forgot').addEventListener('click', () => this.switchView('signin'));
    }

    setupAuthStateListener() {
        if (window.firebaseAuth) {
            window.firebaseAuth.onAuthStateChanged((user) => {
                if (user) {
                    this.hideModal();
                    this.showAuthenticatedState(user);
                } else {
                    this.showUnauthenticatedState();
                }
            });
        } else {
            // Wait for Firebase to finish initializing
            window.addEventListener('firebase-ready', () => {
                this.setupAuthStateListener();
            }, { once: true });
        }
    }

    showModal(view = 'signin') {
        this.switchView(view);
        const modal = document.getElementById('auth-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex-visible');
        // Hide underlying auth-required prompt (if present) while modal is open
        const authRequired = document.getElementById('auth-required');
        if (authRequired) authRequired.classList.add('hidden');
        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        const modal = document.getElementById('auth-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex-visible');
        document.body.style.overflow = 'auto';
        // If user is still unauthenticated, re-show the auth-required prompt
        try {
            if (window.firebaseAuth && !window.firebaseAuth.isAuthenticated()) {
                const authRequired = document.getElementById('auth-required');
                if (authRequired) authRequired.classList.remove('hidden');
            }
        } catch (_) {
            // No-op: if firebaseAuth not ready, don't throw
        }
        this.clearMessages();
    }

    switchView(view) {
        this.currentView = view;
        
        // Hide all forms
        document.getElementById('signin-form').classList.add('hidden');
        document.getElementById('signup-form').classList.add('hidden');
        document.getElementById('forgot-form').classList.add('hidden');
        
        // Hide all switchers
        document.getElementById('signin-switchers').classList.add('hidden');
        document.getElementById('signup-switchers').classList.add('hidden');
        document.getElementById('forgot-switchers').classList.add('hidden');

        // Show appropriate form and switchers
        switch (view) {
            case 'signin':
                document.getElementById('auth-title').textContent = 'Welcome Back';
                document.getElementById('signin-form').classList.remove('hidden');
                document.getElementById('signin-switchers').classList.remove('hidden');
                break;
            case 'signup':
                document.getElementById('auth-title').textContent = 'Create Account';
                document.getElementById('signup-form').classList.remove('hidden');
                document.getElementById('signup-switchers').classList.remove('hidden');
                break;
            case 'forgot':
                document.getElementById('auth-title').textContent = 'Reset Password';
                document.getElementById('forgot-form').classList.remove('hidden');
                document.getElementById('forgot-switchers').classList.remove('hidden');
                break;
        }

        this.clearMessages();
    }

    async handleSignIn(e) {
        e.preventDefault();
        if (this.isLoading) return;

        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;

        // Store action for retry functionality
        this.lastAction = { type: 'signin', email, password };

        this.setLoading('signin', true);
        this.clearMessages();

        const result = await this.performAuthAction(() => window.firebaseAuth.signIn(email, password));
        
        if (result.success) {
            this.showMessage(result.message, 'success');
            this.retryCount = 0; // Reset retry count on success
            // Modal will be hidden by auth state listener
        } else {
            this.showMessage(result.error, 'error', { action: 'signin' });
        }

        this.setLoading('signin', false);
    }

    async handleSignUp(e) {
        e.preventDefault();
        if (this.isLoading) return;

        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;

        if (password !== confirm) {
            this.showMessage('The passwords you entered don\'t match. Please make sure both password fields are exactly the same.', 'error');
            return;
        }

        // Store action for retry functionality
        this.lastAction = { type: 'signup', email, password };

        this.setLoading('signup', true);
        this.clearMessages();

        const result = await this.performAuthAction(() => window.firebaseAuth.signUp(email, password));
        
        if (result.success) {
            this.showMessage(result.message, 'success');
            this.retryCount = 0; // Reset retry count on success
            // Switch to sign in after successful signup
            setTimeout(() => this.switchView('signin'), 3000);
        } else {
            this.showMessage(result.error, 'error', { action: 'signup' });
        }

        this.setLoading('signup', false);
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        if (this.isLoading) return;

        const email = document.getElementById('forgot-email').value;

        // Store action for retry functionality
        this.lastAction = { type: 'forgot', email };

        this.setLoading('forgot', true);
        this.clearMessages();

        const result = await this.performAuthAction(() => window.firebaseAuth.resetPassword(email));
        
        if (result.success) {
            this.showMessage(result.message, 'success');
            this.retryCount = 0; // Reset retry count on success
            setTimeout(() => this.switchView('signin'), 3000);
        } else {
            this.showMessage(result.error, 'error', { action: 'forgot' });
        }

        this.setLoading('forgot', false);
    }

    // Perform auth action with connection retry logic
    async performAuthAction(actionFn) {
        try {
            return await actionFn();
        } catch (error) {
            // Check if this is a network error that we should retry
            if (this.shouldRetryError(error) && this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`Retrying auth action (attempt ${this.retryCount}/${this.maxRetries})`);
                
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
                
                return await this.performAuthAction(actionFn);
            }
            
            // If we can't retry or max retries reached, return the error
            return {
                success: false,
                error: error.message || 'An unexpected error occurred. Please try again.'
            };
        }
    }

    // Check if an error should trigger a retry
    shouldRetryError(error) {
        const retryableErrors = [
            'network-request-failed',
            'timeout',
            'internal-error',
            'unavailable'
        ];
        
        const errorCode = error.code || '';
        const errorMessage = error.message || '';
        
        return retryableErrors.some(retryError => 
            errorCode.includes(retryError) || errorMessage.toLowerCase().includes(retryError)
        );
    }

    // Retry the last action (called by error action buttons)
    async retryLastAction() {
        if (!this.lastAction) return;
        
        const { type, email, password } = this.lastAction;
        
        // Clear previous error message
        this.clearMessages();
        
        // Re-trigger the appropriate form submission
        switch (type) {
            case 'signin':
                document.getElementById('signin-email').value = email;
                document.getElementById('signin-password').value = password;
                await this.handleSignIn({ preventDefault: () => {} });
                break;
            case 'signup':
                document.getElementById('signup-email').value = email;
                document.getElementById('signup-password').value = password;
                document.getElementById('signup-confirm').value = password;
                await this.handleSignUp({ preventDefault: () => {} });
                break;
            case 'forgot':
                document.getElementById('forgot-email').value = email;
                await this.handleForgotPassword({ preventDefault: () => {} });
                break;
        }
    }

    setLoading(form, loading) {
        this.isLoading = loading;
        const btn = document.getElementById(`${form}-btn`);
        const text = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.btn-spinner');
        
        btn.disabled = loading;
        if (loading) {
            text.classList.add('hidden');
            spinner.classList.remove('hidden');
            spinner.classList.add('inline-visible');
        } else {
            text.classList.remove('hidden');
            spinner.classList.add('hidden');
            spinner.classList.remove('inline-visible');
        }
    }

    showMessage(message, type, options = {}) {
        const messageEl = document.getElementById('auth-message');
        messageEl.innerHTML = this.formatMessage(message, type, options);
        messageEl.className = `auth-message ${type}`;
        messageEl.classList.remove('hidden');
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (!messageEl.classList.contains('hidden')) {
                    this.clearMessages();
                }
            }, 5000);
        }
    }

    formatMessage(message, type, options = {}) {
        let html = `<div class="message-text">${message}</div>`;
        
        // Add helpful actions for specific error types
        if (type === 'error') {
            const actions = this.getErrorActions(message, options);
            if (actions.length > 0) {
                html += '<div class="message-actions">';
                actions.forEach(action => {
                    html += `<button class="message-action-btn" onclick="${action.onclick}">${action.text}</button>`;
                });
                html += '</div>';
            }
        }
        
        return html;
    }

    getErrorActions(message, options = {}) {
        const actions = [];
        
        // Suggest creating account if user not found
        if (message.includes('couldn\'t find an account')) {
            actions.push({
                text: 'Create New Account',
                onclick: 'window.authUI.switchView("signup")'
            });
        }
        
        // Suggest password reset for wrong password
        if (message.includes('password you entered is incorrect')) {
            actions.push({
                text: 'Reset Password',
                onclick: 'window.authUI.switchView("forgot")'
            });
        }
        
        // Suggest sign in for existing account
        if (message.includes('account with this email address already exists')) {
            actions.push({
                text: 'Sign In Instead',
                onclick: 'window.authUI.switchView("signin")'
            });
        }
        
        // Add retry button for network errors
        if (message.includes('connection') || message.includes('network') || message.includes('timeout')) {
            actions.push({
                text: 'Try Again',
                onclick: 'window.authUI.retryLastAction()'
            });
        }
        
        // Add refresh suggestion for persistent errors
        if (message.includes('refresh the page')) {
            actions.push({
                text: 'Refresh Page',
                onclick: 'window.location.reload()'
            });
        }
        
        return actions;
    }

    clearMessages() {
        const messageEl = document.getElementById('auth-message');
        messageEl.classList.add('hidden');
        messageEl.textContent = '';
    }

    showAuthenticatedState(user) {
        // Update UI to show authenticated state
        console.log('User authenticated:', user.email);
        
        // Show user info in header if exists
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            userInfo.innerHTML = `
                <span class="user-email">${user.email}</span>
                <button id="signout-btn" class="signout-btn">Sign Out</button>
            `;
            
            document.getElementById('signout-btn').addEventListener('click', async () => {
                const result = await window.firebaseAuth.signOut();
                if (result.success) {
                    console.log('Signed out successfully');
                }
            });
        }

        // Enable protected features
        this.enableProtectedFeatures();

        // Show post-login onboarding, if available
        try {
            if (typeof window.showPostLoginOnboarding === 'function') {
                window.showPostLoginOnboarding(user);
            }
        } catch (_) {
            // no-op
        }
    }

    showUnauthenticatedState() {
        // Update UI to show unauthenticated state
        console.log('User not authenticated');
        
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            userInfo.innerHTML = `
                <button id="signin-trigger" class="signin-btn">Sign In</button>
            `;
            
            document.getElementById('signin-trigger').addEventListener('click', () => {
                this.showModal('signin');
            });
        }

        // Disable protected features
        this.disableProtectedFeatures();
    }

    enableProtectedFeatures() {
        // Enable chat interface and other protected features
        const chatContainer = document.getElementById('chat-container');
        const authRequired = document.getElementById('auth-required');
        
        if (chatContainer) chatContainer.classList.remove('hidden');
        if (authRequired) authRequired.classList.add('hidden');
    }

    disableProtectedFeatures() {
        // Show auth required message and hide protected features
        const chatContainer = document.getElementById('chat-container');
        const authRequired = document.getElementById('auth-required');
        
        if (chatContainer) chatContainer.classList.add('hidden');
        if (authRequired) {
            authRequired.classList.remove('hidden');
            
            // Add event listener for the auth required sign in button
            const authRequiredBtn = document.getElementById('auth-required-signin');
            if (authRequiredBtn) {
                authRequiredBtn.addEventListener('click', () => {
                    this.showModal('signin');
                });
            }
        }
    }
}

// Initialize auth UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize once and only on pages that opt-in to auth UI
    if (window.authUI) return;
    const shouldInit = !!document.getElementById('auth-required') || !!document.querySelector('[data-auth-ui="true"]');
    if (!shouldInit) return;
    window.authUI = new AuthUI();
});
