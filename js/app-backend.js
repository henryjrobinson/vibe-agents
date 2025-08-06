/**
 * Main Application Logic - Server-Centric Architecture
 * Integrates with backend API for authentication, conversations, and memories
 */

// Global variables
let currentSession = {
    conversationId: null,
    messages: [],
    memories: {
        people: [],
        dates: [],
        places: [],
        relationships: [],
        events: []
    }
};

let isTyping = false;
let memoryDisplayVisible = true;
let loggingModeEnabled = false;
let selectedModel = 'claude-3-5-sonnet-20241022'; // Default to working model
let logEntries = [];

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initializing Story Collection App...');
    
    // Wait for all services to be available
    await waitForServices();
    
    // Initialize UI components first
    initializeToggles();
    initializeInput();
    initializeButtons();
    initializeModelSelector();
    initializeDebugPanel();
    
    // Check authentication status
    console.log('🔐 Checking authentication status...');
    
    try {
        const isAuthenticated = await window.authUI.checkAuthenticationStatus();
        console.log('Authentication result:', isAuthenticated);
        
        if (isAuthenticated) {
            console.log('✅ User is authenticated, initializing app...');
            await initializeAuthenticatedApp();
        } else {
            console.log('❌ User not authenticated, auth modal should be showing...');
            // Force show auth modal if it's not already showing
            setTimeout(() => {
                if (!window.authService.isAuthenticated()) {
                    console.log('🔑 Forcing auth modal to show...');
                    window.authUI.showModal();
                }
            }, 500);
        }
    } catch (error) {
        console.error('❌ Authentication check failed:', error);
        // Force show auth modal on error
        window.authUI.showModal();
    }
});

/**
 * Wait for all required services to be available
 */
async function waitForServices() {
    const maxWait = 5000; // 5 seconds max
    const checkInterval = 100; // Check every 100ms
    let waited = 0;
    
    while (waited < maxWait) {
        if (window.authService && window.conversationService && window.authUI) {
            console.log('✅ All services loaded successfully');
            return;
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waited += checkInterval;
    }
    
    console.error('❌ Services failed to load within timeout');
    throw new Error('Required services not available');
}

/**
 * Initialize authenticated application
 */
window.initializeAuthenticatedApp = async function() {
    console.log('✅ User authenticated, initializing app...');
    
    try {
        // Update UI with user info
        updateUserInfo();
        
        // Load existing conversations or create new one
        await loadOrCreateConversation();
        
        // Show welcome modal for new sessions
        if (!currentSession.conversationId || currentSession.messages.length === 0) {
            showWelcomeModal();
        }
        
        console.log('🎉 App initialized successfully!');
    } catch (error) {
        console.error('❌ Failed to initialize authenticated app:', error);
        showError('Failed to initialize app. Please refresh and try again.');
    }
};

/**
 * Update user info display
 */
function updateUserInfo() {
    const userInfo = document.getElementById('user-info');
    const userEmail = document.getElementById('user-email');
    
    if (window.authService.user && userInfo && userEmail) {
        userEmail.textContent = window.authService.user.email;
        userInfo.classList.remove('hidden');
    }
}

/**
 * Load existing conversation or create new one
 */
async function loadOrCreateConversation() {
    try {
        // Get user's conversations
        const conversations = await window.conversationService.getConversations();
        
        if (conversations.length > 0) {
            // Load the most recent conversation
            const recentConversation = conversations[0];
            await loadConversation(recentConversation.id);
        } else {
            // Create a new conversation
            console.log('📝 Creating new conversation...');
            const conversation = await window.conversationService.createConversation('New Story Session');
            currentSession.conversationId = conversation.id;
        }
    } catch (error) {
        console.error('❌ Failed to load/create conversation:', error);
        throw error;
    }
}

/**
 * Load specific conversation
 */
async function loadConversation(conversationId) {
    try {
        console.log(`📖 Loading conversation ${conversationId}...`);
        
        const conversation = await window.conversationService.getConversation(conversationId);
        
        // Set current session
        currentSession.conversationId = conversation.id;
        currentSession.messages = conversation.messages || [];
        
        // Restore UI
        restoreConversationUI(conversation);
        
        // Load memories for this conversation
        await loadConversationMemories(conversationId);
        
        console.log(`✅ Loaded conversation with ${conversation.messages?.length || 0} messages`);
    } catch (error) {
        console.error('❌ Failed to load conversation:', error);
        throw error;
    }
}

/**
 * Restore conversation UI
 */
function restoreConversationUI(conversation) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    // Clear existing messages
    messagesContainer.innerHTML = '';
    
    // Add messages to UI
    if (conversation.messages) {
        conversation.messages.forEach(message => {
            addMessageToUI(
                message.role === 'user' ? 'user' : 'ai',
                message.role === 'user' ? 'user' : 'collaborator',
                message.content
            );
        });
    }
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Load memories for conversation
 */
async function loadConversationMemories(conversationId) {
    try {
        const result = await window.conversationService.getMemories({ 
            conversationId: conversationId 
        });
        
        // Organize memories by category
        const organizedMemories = {
            people: [],
            dates: [],
            places: [],
            relationships: [],
            events: []
        };
        
        result.memories.forEach(memory => {
            if (organizedMemories[memory.category]) {
                organizedMemories[memory.category].push({
                    content: memory.content,
                    confidence: memory.confidence_score,
                    verified: memory.is_verified
                });
            }
        });
        
        // Update current session and UI
        currentSession.memories = organizedMemories;
        updateMemoryDisplayFromSession();
        
    } catch (error) {
        console.error('❌ Failed to load memories:', error);
    }
}

/**
 * Initialize toggle switches
 */
function initializeToggles() {
    const loggingToggle = document.getElementById('logging-mode-toggle');
    if (loggingToggle) {
        loggingToggle.addEventListener('change', function() {
            loggingModeEnabled = this.checked;
            toggleLoggingPanel();
        });
    }
}

/**
 * Initialize input handling
 */
function initializeInput() {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
}

/**
 * Initialize button event listeners
 */
function initializeButtons() {
    const newStoryBtn = document.getElementById('new-story-btn');
    const exportBtn = document.getElementById('export-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (newStoryBtn) {
        newStoryBtn.addEventListener('click', startNewSession);
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportSession);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await window.authService.logout();
            location.reload();
        });
    }
}

/**
 * Initialize model selector dropdown
 */
function initializeModelSelector() {
    const modelSelect = document.getElementById('modelSelect');
    if (modelSelect) {
        modelSelect.addEventListener('change', function() {
            selectedModel = this.value;
            console.log('🤖 Model changed to:', selectedModel);
        });
    }
}

/**
 * Initialize debug panel functionality
 */
function initializeDebugPanel() {
    const clearLogBtn = document.getElementById('clear-log-btn');
    const exportLogBtn = document.getElementById('export-log-btn');
    
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', clearLog);
    }
    
    if (exportLogBtn) {
        exportLogBtn.addEventListener('click', exportLog);
    }
}

/**
 * Show welcome modal
 */
function showWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    const startBtn = document.getElementById('start-story-btn');
    
    console.log('📖 Showing welcome modal...');
    
    if (modal) {
        modal.classList.remove('hidden');
    }
    
    if (startBtn) {
        startBtn.onclick = function() {
            console.log('🚀 Start Story button clicked!');
            modal.classList.add('hidden');
            
            // Focus on message input to start conversation
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.focus();
                messageInput.placeholder = 'Tell me about a memory you\'d like to share...';
            }
            
            // Add a helpful first message
            addMessageToUI('ai', 'collaborator', 
                'Hello! I\'m so glad you\'re here to share your stories with me. What memory would you like to start with today? It could be about family, a special place, or any moment that\'s meaningful to you.');
        };
    } else {
        console.error('❌ Start story button not found!');
    }
}

/**
 * Send user message
 */
async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (!messageInput || !sendBtn) return;
    
    const message = messageInput.value.trim();
    if (!message || isTyping) return;
    
    try {
        // Disable input
        messageInput.disabled = true;
        sendBtn.disabled = true;
        isTyping = true;
        
        // Add user message to UI immediately
        addMessageToUI('user', 'user', message);
        messageInput.value = '';
        
        // Show typing indicator
        showTypingIndicator();
        
        // Log the input if logging is enabled
        if (loggingModeEnabled) {
            addLogEntry('input', 'user', { message: message });
        }
        
        // Send message to backend
        const result = await window.conversationService.sendMessage(message, selectedModel);
        
        // Add AI response to UI
        addMessageToUI('ai', 'collaborator', result.aiResponse.content);
        
        // Update memories if any were extracted
        if (result.memories && result.memories.length > 0) {
            await updateMemoriesFromBackend(result.memories);
        }
        
        // Log the response if logging is enabled
        if (loggingModeEnabled) {
            addLogEntry('output', 'collaborator', result.aiResponse);
            if (result.memories.length > 0) {
                addLogEntry('output', 'memory-keeper', { 
                    extracted: result.memories.length,
                    memories: result.memories 
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Failed to send message:', error);
        hideTypingIndicator();
        showError(sanitizeErrorForUser(error));
    } finally {
        // Re-enable input
        messageInput.disabled = false;
        sendBtn.disabled = false;
        isTyping = false;
        hideTypingIndicator();
        messageInput.focus();
    }
}

/**
 * Add message to UI
 */
function addMessageToUI(type, agent, content, metadata = {}) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = `avatar ${agent}-avatar`;
    avatarDiv.textContent = type === 'user' ? '👤' : '🤖';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    const metaDiv = document.createElement('div');
    metaDiv.className = 'message-meta';
    metaDiv.textContent = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(metaDiv);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Update current session
    currentSession.messages.push({
        role: type === 'user' ? 'user' : 'assistant',
        content: content,
        timestamp: new Date().toISOString()
    });
}

/**
 * Update memories from backend response
 */
async function updateMemoriesFromBackend(memories) {
    try {
        // Organize memories by category
        const organizedMemories = {
            people: [],
            dates: [],
            places: [],
            relationships: [],
            events: []
        };
        
        memories.forEach(memory => {
            if (organizedMemories[memory.category]) {
                organizedMemories[memory.category].push({
                    content: memory.content,
                    confidence: memory.confidence_score,
                    verified: memory.is_verified
                });
            }
        });
        
        // Merge with existing memories
        Object.keys(organizedMemories).forEach(category => {
            if (organizedMemories[category].length > 0) {
                currentSession.memories[category] = [
                    ...currentSession.memories[category],
                    ...organizedMemories[category]
                ];
            }
        });
        
        // Update UI
        updateMemoryDisplayFromSession();
        
        console.log(`✅ Updated memories: ${memories.length} new items`);
        
    } catch (error) {
        console.error('❌ Failed to update memories:', error);
    }
}

/**
 * Update memory display from current session
 */
function updateMemoryDisplayFromSession() {
    const categories = ['people', 'dates', 'places', 'relationships', 'events'];
    
    categories.forEach(category => {
        const container = document.getElementById(`memory-${category}`);
        if (!container) return;
        
        const memories = currentSession.memories[category] || [];
        
        if (memories.length === 0) {
            container.innerHTML = `<div class="memory-placeholder">No ${category} mentioned yet</div>`;
        } else {
            container.innerHTML = '';
            memories.forEach(memory => {
                addMemoryItemToUI(category, memory);
            });
        }
    });
    
    // Update memory status
    const totalMemories = Object.values(currentSession.memories)
        .reduce((sum, arr) => sum + arr.length, 0);
    
    updateMemoryStatus(totalMemories > 0 ? `${totalMemories} memories collected` : 'Ready');
}

/**
 * Add memory item to UI
 */
function addMemoryItemToUI(category, memory) {
    const container = document.getElementById(`memory-${category}`);
    if (!container) return;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'memory-item';
    
    // Format content based on category
    let displayContent = '';
    if (typeof memory.content === 'object') {
        // Handle relationship objects
        if (category === 'relationships' && memory.content.person1 && memory.content.person2) {
            displayContent = `${memory.content.person1} - ${memory.content.type} - ${memory.content.person2}`;
        } else {
            displayContent = JSON.stringify(memory.content);
        }
    } else {
        displayContent = memory.content;
    }
    
    itemDiv.innerHTML = `
        <div class="memory-text">${displayContent}</div>
        <div class="memory-confidence">Confidence: ${Math.round((memory.confidence || 0.8) * 100)}%</div>
    `;
    
    container.appendChild(itemDiv);
}

/**
 * Start new session
 */
async function startNewSession() {
    try {
        console.log('🆕 Starting new session...');
        
        // Create new conversation
        const conversation = await window.conversationService.createConversation('New Story Session');
        
        // Reset current session
        currentSession = {
            conversationId: conversation.id,
            messages: [],
            memories: {
                people: [],
                dates: [],
                places: [],
                relationships: [],
                events: []
            }
        };
        
        // Clear UI
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        
        // Reset memory display
        updateMemoryDisplayFromSession();
        
        // Show welcome modal
        showWelcomeModal();
        
        console.log('✅ New session started');
        
    } catch (error) {
        console.error('❌ Failed to start new session:', error);
        showError('Failed to start new session. Please try again.');
    }
}

/**
 * Export session data
 */
async function exportSession() {
    try {
        const sessionData = {
            timestamp: new Date().toISOString(),
            conversationId: currentSession.conversationId,
            messages: currentSession.messages,
            memories: currentSession.memories,
            summary: generateSessionSummary()
        };
        
        const dataStr = JSON.stringify(sessionData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `story-session-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        console.log('📁 Session exported successfully');
        
    } catch (error) {
        console.error('❌ Failed to export session:', error);
        showError('Failed to export session. Please try again.');
    }
}

/**
 * Generate session summary
 */
function generateSessionSummary() {
    const messageCount = currentSession.messages.length;
    const memoryCount = Object.values(currentSession.memories).reduce((sum, arr) => sum + arr.length, 0);
    
    return {
        totalMessages: messageCount,
        totalMemories: memoryCount,
        memoriesBreakdown: {
            people: currentSession.memories.people.length,
            dates: currentSession.memories.dates.length,
            places: currentSession.memories.places.length,
            relationships: currentSession.memories.relationships.length,
            events: currentSession.memories.events.length
        }
    };
}

/**
 * Utility functions
 */
function showTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.classList.remove('hidden');
    }
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.classList.add('hidden');
    }
}

function updateMemoryStatus(status) {
    const statusElement = document.getElementById('memory-status');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

function toggleLoggingPanel() {
    const panel = document.getElementById('logging-panel');
    if (panel) {
        if (loggingModeEnabled) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    }
}

function addLogEntry(type, agent, data, isInput = true) {
    if (!loggingModeEnabled) return;
    
    const targetContainer = isInput ? 'log-inputs' : 'log-outputs';
    const container = document.getElementById(targetContainer);
    
    if (container) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
            <div class="log-timestamp">${new Date().toLocaleTimeString()}</div>
            <div class="log-agent">${agent}</div>
            <div class="log-data">${JSON.stringify(data, null, 2)}</div>
        `;
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
    }
    
    logEntries.push({
        timestamp: new Date().toISOString(),
        type,
        agent,
        data,
        isInput
    });
}

function clearLog() {
    const inputs = document.getElementById('log-inputs');
    const outputs = document.getElementById('log-outputs');
    
    if (inputs) inputs.innerHTML = '';
    if (outputs) outputs.innerHTML = '';
    
    logEntries = [];
}

function exportLog() {
    const logData = {
        timestamp: new Date().toISOString(),
        entries: logEntries
    };
    
    const dataStr = JSON.stringify(logData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `agent-log-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function showError(message) {
    // Simple error display - could be enhanced with a modal
    alert(message);
}

function sanitizeErrorForUser(error) {
    const errorMessage = error.message || error.toString();
    
    // Map technical errors to friendly messages
    const friendlyMessages = {
        'Failed to fetch': 'Having trouble connecting. Please check your internet connection and try again.',
        'Network request failed': 'Connection problem. Please try again in a moment.',
        'Timeout': 'The request is taking too long. Please try again.',
        'Authentication': 'Please refresh the page and try again.',
        'Forbidden': 'Access issue. Please refresh the page.',
        'Too Many Requests': 'Please wait a moment before trying again.',
        'Internal Server Error': 'We\'re experiencing technical difficulties. Please try again shortly.',
        'Service Unavailable': 'Service is temporarily unavailable. Please try again in a few minutes.'
    };
    
    // Check if error message contains any technical terms
    for (const [technical, friendly] of Object.entries(friendlyMessages)) {
        if (errorMessage.includes(technical)) {
            return friendly;
        }
    }
    
    // For API errors with status codes
    if (errorMessage.includes('403')) {
        return 'Access issue. Please refresh the page and try again.';
    }
    if (errorMessage.includes('500')) {
        return 'We\'re experiencing technical difficulties. Please try again in a moment.';
    }
    if (errorMessage.includes('429')) {
        return 'Please wait a moment before sending another message.';
    }
    
    // Default friendly message
    return 'Something went wrong. Please try again, or refresh the page if the problem continues.';
}

console.log('📱 Backend-integrated app.js loaded successfully!');
