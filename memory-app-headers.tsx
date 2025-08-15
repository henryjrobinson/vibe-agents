<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MemoryKeeper Headers</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
</head>
<body class="bg-gray-100 min-h-screen">

<!-- Landing Page Header -->
<header id="landing-header" class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between py-4 space-y-4 lg:space-y-0">
            <!-- Logo and Navigation -->
            <div class="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-8">
                <div class="flex items-center">
                    <h1 class="text-2xl font-bold text-gray-900">MemoryKeeper</h1>
                </div>
                
                <nav class="flex flex-wrap gap-4 sm:gap-6">
                    <a href="#about" class="text-gray-600 hover:text-gray-900 font-medium text-lg py-2 px-1 transition-colors">
                        About
                    </a>
                    <a href="#how-it-works" class="text-gray-600 hover:text-gray-900 font-medium text-lg py-2 px-1 transition-colors">
                        How it Works
                    </a>
                    <a href="#pricing" class="text-gray-600 hover:text-gray-900 font-medium text-lg py-2 px-1 transition-colors">
                        Pricing
                    </a>
                    <a href="#support" class="text-gray-600 hover:text-gray-900 font-medium text-lg py-2 px-1 transition-colors">
                        Support
                    </a>
                </nav>
            </div>

            <!-- Auth Section -->
            <div class="bg-gray-50 rounded-lg p-6 w-full lg:w-auto lg:min-w-96">
                <div class="space-y-4">
                    <!-- Auth Toggle -->
                    <div class="flex space-x-2 bg-white rounded-lg p-1">
                        <button
                            id="sign-in-btn"
                            class="flex-1 py-3 px-4 text-lg font-medium rounded-md transition-colors bg-blue-600 text-white auth-toggle"
                            data-mode="signin"
                        >
                            Sign In
                        </button>
                        <button
                            id="sign-up-btn"
                            class="flex-1 py-3 px-4 text-lg font-medium rounded-md transition-colors text-gray-600 hover:text-gray-900 auth-toggle"
                            data-mode="signup"
                        >
                            Sign Up
                        </button>
                    </div>

                    <!-- Auth Form -->
                    <div class="space-y-4">
                        <div>
                            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                class="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="your@email.com"
                            />
                        </div>

                        <div>
                            <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                class="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <div id="confirm-password-section" class="hidden">
                            <label for="confirm-password" class="block text-sm font-medium text-gray-700 mb-2">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                id="confirm-password"
                                class="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            id="auth-submit-btn"
                            class="w-full bg-blue-600 text-white py-3 px-6 text-lg font-medium rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        >
                            Sign In
                        </button>
                    </div>

                    <div id="forgot-password-link" class="text-center">
                        <a href="#forgot-password" class="text-blue-600 hover:text-blue-700 text-sm">
                            Forgot your password?
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</header>

<!-- App Header (Hidden by default) -->
<header id="app-header" class="bg-white shadow-sm border-b hidden">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16 sm:h-20">
            <!-- Logo -->
            <div class="flex items-center">
                <h1 class="text-xl sm:text-2xl font-bold text-gray-900">MemoryKeeper</h1>
            </div>

            <!-- Controls -->
            <div class="flex items-center space-x-2 sm:space-x-4">
                <!-- Create Artifact Button -->
                <button id="create-artifact-btn" class="flex items-center space-x-2 bg-purple-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-md hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors text-sm sm:text-base font-medium">
                    <i data-lucide="sparkles" class="w-4 h-4 sm:w-5 sm:h-5"></i>
                    <span class="hidden sm:inline">Create Artifact</span>
                    <span class="sm:hidden">Create</span>
                </button>

                <!-- Reset Chat -->
                <button id="reset-chat-btn" class="flex items-center space-x-2 bg-orange-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-md hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors text-sm sm:text-base font-medium">
                    <i data-lucide="rotate-ccw" class="w-4 h-4 sm:w-5 sm:h-5"></i>
                    <span class="hidden sm:inline">Reset Chat</span>
                    <span class="sm:hidden">Reset</span>
                </button>

                <!-- Export Chat -->
                <button id="export-chat-btn" class="flex items-center space-x-2 bg-green-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors text-sm sm:text-base font-medium">
                    <i data-lucide="download" class="w-4 h-4 sm:w-5 sm:h-5"></i>
                    <span class="hidden sm:inline">Export</span>
                </button>

                <!-- AI Model Dropdown -->
                <div class="relative">
                    <button
                        id="model-dropdown-btn"
                        class="flex items-center space-x-2 bg-blue-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm sm:text-base font-medium"
                    >
                        <i data-lucide="settings" class="w-4 h-4 sm:w-5 sm:h-5"></i>
                        <span id="selected-model" class="hidden lg:inline">Claude Sonnet 4</span>
                        <span class="lg:hidden">Model</span>
                        <i data-lucide="chevron-down" class="w-4 h-4"></i>
                    </button>

                    <div id="model-dropdown" class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50 hidden">
                        <div class="py-1">
                            <button class="model-option w-full text-left px-4 py-3 text-sm font-medium transition-colors bg-blue-50 text-blue-600" data-model="Claude Sonnet 4">
                                Claude Sonnet 4
                            </button>
                            <button class="model-option w-full text-left px-4 py-3 text-sm font-medium transition-colors text-gray-700 hover:bg-gray-50" data-model="Claude Opus 4">
                                Claude Opus 4
                            </button>
                            <button class="model-option w-full text-left px-4 py-3 text-sm font-medium transition-colors text-gray-700 hover:bg-gray-50" data-model="Claude Haiku 4">
                                Claude Haiku 4
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Profile Dropdown -->
                <div class="relative">
                    <button
                        id="profile-dropdown-btn"
                        class="flex items-center space-x-2 bg-gray-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-md hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors text-sm sm:text-base font-medium"
                    >
                        <i data-lucide="user" class="w-4 h-4 sm:w-5 sm:h-5"></i>
                        <span class="hidden sm:inline">Profile</span>
                        <i data-lucide="chevron-down" class="w-4 h-4"></i>
                    </button>

                    <div id="profile-dropdown" class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50 hidden">
                        <div class="py-1">
                            <a href="#settings" class="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                Settings
                            </a>
                            <a href="#help" class="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                Help & Support
                            </a>
                            <hr class="my-1">
                            <button id="logout-btn" class="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</header>

<!-- Demo Content -->
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Header Demo</h2>
        <p class="text-gray-600 mb-4">
            Click the button below to toggle between the landing page header and the app header.
        </p>
        <button
            id="toggle-view-btn"
            class="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
            View App Header
        </button>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // State
    var isLoggedIn = false;
    var isSignUp = false;
    var selectedModel = 'Claude Sonnet 4';

    // Elements
    var landingHeader = document.getElementById('landing-header');
    var appHeader = document.getElementById('app-header');
    var toggleViewBtn = document.getElementById('toggle-view-btn');
    var authToggleBtns = document.querySelectorAll('.auth-toggle');
    var confirmPasswordSection = document.getElementById('confirm-password-section');
    var forgotPasswordLink = document.getElementById('forgot-password-link');
    var authSubmitBtn = document.getElementById('auth-submit-btn');

    // Dropdown elements
    var modelDropdownBtn = document.getElementById('model-dropdown-btn');
    var modelDropdown = document.getElementById('model-dropdown');
    var profileDropdownBtn = document.getElementById('profile-dropdown-btn');
    var profileDropdown = document.getElementById('profile-dropdown');
    var selectedModelSpan = document.getElementById('selected-model');
    var modelOptions = document.querySelectorAll('.model-option');

    // Toggle between landing and app view
    toggleViewBtn.addEventListener('click', function() {
        isLoggedIn = !isLoggedIn;
        if (isLoggedIn) {
            landingHeader.classList.add('hidden');
            appHeader.classList.remove('hidden');
            toggleViewBtn.textContent = 'View Landing Header';
        } else {
            landingHeader.classList.remove('hidden');
            appHeader.classList.add('hidden');
            toggleViewBtn.textContent = 'View App Header';
        }
    });

    // Auth toggle functionality
    authToggleBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var mode = this.dataset.mode;
            isSignUp = mode === 'signup';
            
            // Update button styles
            authToggleBtns.forEach(function(b) {
                if (b.dataset.mode === mode) {
                    b.className = 'flex-1 py-3 px-4 text-lg font-medium rounded-md transition-colors bg-blue-600 text-white auth-toggle';
                } else {
                    b.className = 'flex-1 py-3 px-4 text-lg font-medium rounded-md transition-colors text-gray-600 hover:text-gray-900 auth-toggle';
                }
            });

            // Toggle confirm password and forgot password
            if (isSignUp) {
                confirmPasswordSection.classList.remove('hidden');
                forgotPasswordLink.classList.add('hidden');
                authSubmitBtn.textContent = 'Create Account';
            } else {
                confirmPasswordSection.classList.add('hidden');
                forgotPasswordLink.classList.remove('hidden');
                authSubmitBtn.textContent = 'Sign In';
            }
        });
    });

    // Model dropdown
    modelDropdownBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        modelDropdown.classList.toggle('hidden');
        profileDropdown.classList.add('hidden');
    });

    // Profile dropdown
    profileDropdownBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        profileDropdown.classList.toggle('hidden');
        modelDropdown.classList.add('hidden');
    });

    // Model selection
    modelOptions.forEach(function(option) {
        option.addEventListener('click', function() {
            var model = this.dataset.model;
            selectedModel = model;
            selectedModelSpan.textContent = model;
            
            // Update selected state
            modelOptions.forEach(function(opt) {
                if (opt.dataset.model === model) {
                    opt.className = 'model-option w-full text-left px-4 py-3 text-sm font-medium transition-colors bg-blue-50 text-blue-600';
                } else {
                    opt.className = 'model-option w-full text-left px-4 py-3 text-sm font-medium transition-colors text-gray-700 hover:bg-gray-50';
                }
            });
            
            modelDropdown.classList.add('hidden');
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function() {
        modelDropdown.classList.add('hidden');
        profileDropdown.classList.add('hidden');
    });

    // Button event listeners
    document.getElementById('create-artifact-btn').addEventListener('click', function() {
        alert('Create Artifact clicked');
    });

    document.getElementById('reset-chat-btn').addEventListener('click', function() {
        if (confirm('Are you sure you want to reset the current chat session?')) {
            alert('Chat reset');
        }
    });

    document.getElementById('export-chat-btn').addEventListener('click', function() {
        alert('Export chat clicked');
    });

    document.getElementById('logout-btn').addEventListener('click', function() {
        if (confirm('Are you sure you want to sign out?')) {
            // Reset to landing view
            isLoggedIn = false;
            landingHeader.classList.remove('hidden');
            appHeader.classList.add('hidden');
            toggleViewBtn.textContent = 'View App Header';
            alert('Logged out');
        }
    });

    // Auth submit
    authSubmitBtn.addEventListener('click', function() {
        var email = document.getElementById('email').value;
        var password = document.getElementById('password').value;
        var confirmPassword = document.getElementById('confirm-password').value;

        if (!email || !password) {
            alert('Please fill in all required fields');
            return;
        }

        if (isSignUp && password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        alert(isSignUp ? 'Account created successfully!' : 'Signed in successfully!');
        
        // Auto-switch to app view for demo
        isLoggedIn = true;
        landingHeader.classList.add('hidden');
        appHeader.classList.remove('hidden');
        toggleViewBtn.textContent = 'View Landing Header';
    });
});
</script>

</body>
</html>