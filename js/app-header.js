/**
 * App Header Controller
 * Handles the modern app header interactions for the chat interface
 */

class AppHeader {
    constructor() {
        this.selectedModel = 'claude-3-5-sonnet-latest';
        this.init();
    }

    init() {
        console.log('🎛️ App header initializing...');
        this.setupEventListeners();
        this.updateModelDisplay();
    }

    setupEventListeners() {
        // Model dropdown
        const modelDropdownBtn = document.getElementById('model-dropdown-btn');
        const modelDropdown = document.getElementById('model-dropdown');
        const modelOptions = document.querySelectorAll('.model-option');

        if (modelDropdownBtn) {
            modelDropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown('model-dropdown');
            });
        }

        // Profile dropdown
        const profileDropdownBtn = document.getElementById('profile-dropdown-btn');
        const profileDropdown = document.getElementById('profile-dropdown');

        if (profileDropdownBtn) {
            profileDropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown('profile-dropdown');
            });
        }

        // Model selection
        modelOptions.forEach(option => {
            option.addEventListener('click', () => {
                this.selectModel(option.dataset.model, option.textContent.trim());
            });
        });

        // Control buttons
        this.setupControlButtons();

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            this.closeAllDropdowns();
        });

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }
    }

    setupControlButtons() {
        // Create Artifact button
        const createArtifactBtn = document.getElementById('create-artifact-btn');
        if (createArtifactBtn) {
            createArtifactBtn.addEventListener('click', () => {
                console.log('✨ Create Artifact clicked');
                this.showNotification('Create Artifact feature coming soon!');
            });
        }

        // Reset Chat button
        const resetChatBtn = document.getElementById('reset-chat-btn');
        if (resetChatBtn) {
            resetChatBtn.addEventListener('click', () => {
                this.handleResetChat();
            });
        }

        // Export Chat button
        const exportChatBtn = document.getElementById('export-chat-btn');
        if (exportChatBtn) {
            exportChatBtn.addEventListener('click', () => {
                this.handleExportChat();
            });
        }
    }

    toggleDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        // Close other dropdowns first
        this.closeAllDropdowns();

        // Toggle the requested dropdown
        dropdown.classList.toggle('hidden');
    }

    closeAllDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown-menu');
        dropdowns.forEach(dropdown => {
            dropdown.classList.add('hidden');
        });
    }

    selectModel(modelValue, modelName) {
        console.log('🤖 Model changed to:', modelValue);
        
        this.selectedModel = modelValue;
        
        // Update display
        const selectedModelSpan = document.getElementById('selected-model');
        if (selectedModelSpan) {
            selectedModelSpan.textContent = modelName;
        }

        // Update active state
        const modelOptions = document.querySelectorAll('.model-option');
        modelOptions.forEach(option => {
            if (option.dataset.model === modelValue) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });

        // Update the main app's model selector if it exists
        const mainModelSelect = document.getElementById('modelSelect');
        if (mainModelSelect) {
            mainModelSelect.value = modelValue;
            // Trigger change event for the main app
            mainModelSelect.dispatchEvent(new Event('change'));
        }

        this.closeAllDropdowns();
        this.showNotification(`Switched to ${modelName}`);
    }

    updateModelDisplay() {
        // Sync with existing model selector if present
        const mainModelSelect = document.getElementById('modelSelect');
        if (mainModelSelect) {
            this.selectedModel = mainModelSelect.value;
            const selectedOption = mainModelSelect.options[mainModelSelect.selectedIndex];
            const modelName = selectedOption.textContent;
            
            const selectedModelSpan = document.getElementById('selected-model');
            if (selectedModelSpan) {
                selectedModelSpan.textContent = modelName;
            }
        }
    }

    handleResetChat() {
        console.log('🔄 Reset Chat clicked');
        
        if (confirm('Are you sure you want to reset the current chat session? This will clear all messages and memories.')) {
            // Trigger the main app's reset functionality
            const newStoryBtn = document.getElementById('new-story-btn');
            if (newStoryBtn) {
                newStoryBtn.click();
            } else {
                // Fallback: clear messages directly
                this.clearChatMessages();
            }
            
            this.showNotification('Chat session reset');
        }
    }

    handleExportChat() {
        console.log('📤 Export Chat clicked');
        
        // Trigger the main app's export functionality
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.click();
        } else {
            // Fallback: basic export
            this.exportChatBasic();
        }
    }

    handleLogout() {
        console.log('👋 Logout clicked');
        
        if (confirm('Are you sure you want to sign out?')) {
            // Clear any stored auth data
            localStorage.removeItem('story-collection-used');
            
            // Redirect to landing page
            window.location.href = 'index.html';
        }
    }

    clearChatMessages() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
        
        // Clear memory panels
        const memoryItems = document.querySelectorAll('.memory-items');
        memoryItems.forEach(container => {
            container.innerHTML = '<div class="memory-placeholder">No data yet</div>';
        });
    }

    exportChatBasic() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) {
            this.showNotification('No chat messages to export');
            return;
        }

        const messages = chatMessages.querySelectorAll('.message');
        let exportText = 'MemoryKeeper Chat Export\n';
        exportText += '========================\n\n';

        messages.forEach(message => {
            const isUser = message.classList.contains('user');
            const content = message.querySelector('.message-bubble')?.textContent || '';
            const sender = isUser ? 'You' : 'AI';
            
            exportText += `${sender}: ${content}\n\n`;
        });

        // Create and download file
        const blob = new Blob([exportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `memorykeeper-chat-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Chat exported successfully');
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'app-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 5rem;
            right: 1rem;
            background: #2c3e50;
            color: white;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1001;
            font-size: 0.9rem;
            font-weight: 500;
            animation: slideInRight 0.3s ease-out;
        `;

        // Add animation keyframes if not already added
        if (!document.querySelector('#app-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'app-notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Public method to get current model
    getCurrentModel() {
        return this.selectedModel;
    }

    // Public method to update model from external source
    setModel(modelValue, modelName) {
        this.selectModel(modelValue, modelName);
    }
}

// Initialize app header when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if app header exists
    if (document.getElementById('app-header')) {
        console.log('🎛️ Initializing app header...');
        window.appHeader = new AppHeader();
    }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppHeader;
}
