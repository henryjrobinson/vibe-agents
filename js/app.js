// Global variables
let currentSession = {
    messages: [],
    memories: {
        people: [],
        dates: [],
        places: [],
        relationships: [],
        events: []
    }
};

// Bind SSE lifecycle to Firebase auth state changes
function setupAuthSSEBinding() {
    const bind = () => {
        if (!window.firebaseAuth) return;
        // React to future auth changes
        window.firebaseAuth.onAuthStateChanged(async (user) => {
            if (eventSource) {
                try { eventSource.close(); } catch (_) {}
                eventSource = null;
            }
            if (user) {
                // Immediately reflect auth state in UI while SSE connects
                updateMemoryStatus('Connecting...');
                await initializeSSE();
            } else {
                updateMemoryStatus('Sign in to enable memory updates');
            }
        });

        // Handle current state immediately
        if (window.firebaseAuth.isAuthenticated()) {
            // Show user we're connecting right away
            updateMemoryStatus('Connecting...');
            initializeSSE();
        } else {
            updateMemoryStatus('Sign in to enable memory updates');
        }
    };

    if (window.firebaseAuth) {
        bind();
    } else {
        window.addEventListener('firebase-ready', bind, { once: true });
    }
}

// Secure session management
const SESSION_STORAGE_KEY = 'story_session';
let sessionAutoSaveEnabled = true;
let isTyping = false;
let memoryDisplayVisible = true;
let loggingModeEnabled = false;
let selectedModel = 'claude-3-5-haiku-latest'; // Default model - Fast and reliable
let logEntries = [];
// Guard to prevent rapid double submissions
let sendInProgress = false;

// Conversation/session identifiers and SSE state
let conversationId = null;
let eventSource = null;
const seenMemoryIds = new Set();

// Generate or load a persistent conversationId
function getConversationId() {
    if (conversationId) return conversationId;
    try {
        const stored = localStorage.getItem('conversationId');
        if (stored) {
            conversationId = stored;
            return conversationId;
        }
        const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem('conversationId', id);
        conversationId = id;
        return conversationId;
    } catch (_) {
        conversationId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return conversationId;
    }
}

// Generate a per-message id
function generateMessageId() {
    return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Initialize SSE connection for memory updates
async function initializeSSE() {
    const id = getConversationId();
    try {
        if (eventSource) {
            try { eventSource.close(); } catch (_) {}
            eventSource = null;
        }
        
        // Build SSE URL with auth token if available
        // Indicate connection attempt before token fetch/network roundtrip
        updateMemoryStatus('Connecting...');
        let sseUrl = `/events?conversationId=${encodeURIComponent(id)}`;
        if (window.firebaseAuth && window.firebaseAuth.isAuthenticated()) {
            try {
                // Force refresh to avoid stale tokens in private/incognito mode
                const token = await window.firebaseAuth.getIdToken(true);
                sseUrl += `&token=${encodeURIComponent(token)}`;
            } catch (error) {
                console.error('Failed to get Firebase token for SSE:', error);
            }
        }
        
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
            updateMemoryStatus('Ready');
            addLogEntry('info', 'SSE', { status: 'open', conversationId: id }, false);
        };

        eventSource.onerror = (err) => {
            // EventSource auto-reconnects; just log
            addLogEntry('error', 'SSE', { error: 'connection_error', details: String(err) }, false);
        };

        eventSource.addEventListener('memory', (ev) => {
            try {
                const data = JSON.parse(ev.data || '{}');
                // Dedupe based on saved memory id if present
                if (data.id && seenMemoryIds.has(data.id)) return;
                if (data.id) seenMemoryIds.add(data.id);

                if (data.error) {
                    updateMemoryStatus('Error processing memories');
                    addLogEntry('error', 'Memory Keeper', data, false);
                    return;
                }

                const extracted = {
                    people: Array.isArray(data.people) ? data.people : [],
                    dates: Array.isArray(data.dates) ? data.dates : [],
                    places: Array.isArray(data.places) ? data.places : [],
                    relationships: Array.isArray(data.relationships) ? data.relationships : [],
                    events: Array.isArray(data.events) ? data.events : []
                };

                // If nothing meaningful, ignore
                const hasAny = Object.values(extracted).some(arr => arr && arr.length > 0);
                if (!hasAny) return;

                updateMemoryDisplay(extracted);
                updateMemoryStatus('Complete');
                addLogEntry('output', 'Memory Keeper', { source: 'sse', ...data }, false);
            } catch (e) {
                addLogEntry('error', 'SSE', { error: 'parse_error', details: String(e) }, false);
            }
        });
    } catch (e) {
        addLogEntry('error', 'SSE', { error: 'init_failed', details: String(e) }, false);
    }
}

// Small helper to enforce client-side timeouts for fetch with Firebase auth
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 20000, ...rest } = options;
    
    // Add Firebase auth token to headers if user is authenticated
    const headers = { ...rest.headers };
    if (window.firebaseAuth && window.firebaseAuth.isAuthenticated()) {
        try {
            const token = await window.firebaseAuth.getIdToken();
            headers['Authorization'] = `Bearer ${token}`;
        } catch (error) {
            console.error('Failed to get Firebase token:', error);
            // Continue without token - let server handle auth error
        }
    }
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { 
            ...rest, 
            headers,
            signal: controller.signal 
        });
        return response;
    } finally {
        clearTimeout(id);
    }
}

/**
 * Sanitize error messages for user-friendly display to seniors
 */
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

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    initializeToggles();
    initializeInput();
    initializeButtons();
    initializeModelSelector();
    initializeDebugPanel();
    setupAuthSSEBinding();
    await loadSecureSession(); // Load encrypted session data
    
    // Auto-trigger initial conversation for new users
    autoStartConversation();
});

/**
 * Secure Session Management Functions
 */

/**
 * Save current session data with encryption
 */
async function saveSecureSession() {
    if (!sessionAutoSaveEnabled || !window.secureStorage) {
        return;
    }

    try {
        // Only save if there's meaningful data to protect
        const hasMessages = currentSession.messages.length > 0;
        const hasMemories = Object.values(currentSession.memories).some(arr => arr.length > 0);
        
        if (hasMessages || hasMemories) {
            await window.secureStorage.setSecureItem(SESSION_STORAGE_KEY, {
                messages: currentSession.messages,
                memories: currentSession.memories,
                timestamp: new Date().toISOString(),
                version: '1.0'
            });
            console.log('🔐 Session data encrypted and saved securely');
        }
    } catch (error) {
        console.error('🚨 Failed to save secure session:', error);
        // Continue without throwing to avoid breaking the app
    }
}

/**
 * Load and decrypt session data
 */
async function loadSecureSession() {
    if (!window.secureStorage) {
        console.warn('🚨 Secure storage not available, using default session');
        return;
    }

    try {
        const savedSession = await window.secureStorage.getSecureItem(SESSION_STORAGE_KEY);
        
        if (savedSession && savedSession.messages && savedSession.memories) {
            // Restore session data
            currentSession.messages = savedSession.messages || [];
            currentSession.memories = savedSession.memories || {
                people: [],
                dates: [],
                places: [],
                relationships: [],
                events: []
            };
            
            console.log('🔐 Session data decrypted and loaded successfully');
            console.log(`📊 Restored ${currentSession.messages.length} messages and ${Object.values(currentSession.memories).reduce((sum, arr) => sum + arr.length, 0)} memories`);
            
            // Restore UI state if there's data
            if (currentSession.messages.length > 0) {
                restoreSessionUI();
            }
        } else {
            console.log('🔐 No previous secure session found, starting fresh');
        }
    } catch (error) {
        console.error('🚨 Failed to load secure session:', error);
        // Continue with empty session rather than breaking the app
    }
}

/**
 * Restore UI state from loaded session data
 */
function restoreSessionUI() {
    try {
        // Restore chat messages
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer && currentSession.messages.length > 0) {
            messagesContainer.innerHTML = ''; // Clear existing messages
            
            currentSession.messages.forEach(message => {
                addMessage(message.type, message.agent, message.content, {
                    timestamp: message.timestamp,
                    skipSave: true // Don't re-save during restoration
                });
            });
        }
        
        // Restore memory display
        updateMemoryDisplay();
        
        console.log('🔐 UI state restored from secure session');
    } catch (error) {
        console.error('🚨 Failed to restore UI state:', error);
    }
}

/**
 * Clear secure session data
 */
async function clearSecureSession() {
    try {
        if (window.secureStorage) {
            window.secureStorage.removeSecureItem(SESSION_STORAGE_KEY);
            console.log('🔐 Secure session data cleared');
        }
    } catch (error) {
        console.error('🚨 Failed to clear secure session:', error);
    }
}

/**
 * Auto-save session data after changes (debounced)
 */
let saveTimeout;
function scheduleSecureSave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    // Debounce saves to avoid excessive encryption operations
    saveTimeout = setTimeout(async () => {
        await saveSecureSession();
    }, 1000); // Save 1 second after last change
}

/**
 * Initialize toggle switches
 */
function initializeToggles() {
    const memoryToggle = document.getElementById('memory-display-toggle');
    const loggingToggle = document.getElementById('logging-mode-toggle');
    
    // Memory Keeper toggle is now hidden, so always show memory display
    memoryDisplayVisible = true;
    
    // Comment out memory toggle handling since it's hidden
    // if (memoryToggle) {
    //     memoryToggle.addEventListener('change', function() {
    //         memoryDisplayVisible = this.checked;
    //         toggleMemoryPanelVisibility();
    //     });
    //     memoryDisplayVisible = memoryToggle.checked;
    // }
    
    if (loggingToggle) {
        loggingToggle.addEventListener('change', function() {
            loggingModeEnabled = this.checked;
            toggleLoggingPanel();
        });
        loggingModeEnabled = loggingToggle.checked;
    }
}

/**
 * Initialize input handling
 */
function initializeInput() {
    const input = document.getElementById('chat-input');
    if (input) {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
}

/**
 * Initialize button event listeners
 */
function initializeButtons() {
    // Send button
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    // New story button
    const newStoryBtn = document.getElementById('new-story-btn');
    if (newStoryBtn) {
        newStoryBtn.addEventListener('click', startNewSession);
    }
    
    // Export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportSession);
    }
    
    // Start story button (in modal)
    const startStoryBtn = document.getElementById('start-story-btn');
    if (startStoryBtn) {
        startStoryBtn.addEventListener('click', startStorySession);
    }
    
    // Logging control buttons
    const clearLogBtn = document.getElementById('clear-log-btn');
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', clearLog);
    }
    
    const exportLogBtn = document.getElementById('export-log-btn');
    if (exportLogBtn) {
        exportLogBtn.addEventListener('click', exportLog);
    }
}

/**
 * Initialize model selector dropdown
 */
function initializeModelSelector() {
    const modelSelect = document.getElementById('modelSelect');
    if (modelSelect) {
        // Set initial value
        modelSelect.value = selectedModel;
        
        // Add change event listener
        modelSelect.addEventListener('change', function() {
            selectedModel = this.value;
            console.log('Model changed to:', selectedModel);
            
            // Add a visual indicator that model was changed
            addMessage('system', 'system', 
                `Model switched to: ${this.options[this.selectedIndex].text}`,
                { timestamp: new Date().toLocaleTimeString() }
            );
        });
    }
}

/**
 * Initialize debug panel functionality
 */
function initializeDebugPanel() {
    const debugToggleBtn = document.getElementById('debug-toggle-btn');
    const debugPanel = document.getElementById('debug-panel');
    const debugContent = document.getElementById('debug-content');
    
    if (debugToggleBtn && debugPanel) {
        let debugVisible = false;
        
        debugToggleBtn.addEventListener('click', function() {
            debugVisible = !debugVisible;
            debugPanel.style.display = debugVisible ? 'block' : 'none';
            debugContent.style.display = debugVisible ? 'block' : 'none';
            debugToggleBtn.textContent = debugVisible ? 'Hide Debug Info' : 'Show Debug Info';
        });
    }
}

/**
 * Toggle logging panel visibility
 */
function toggleLoggingPanel() {
    const panel = document.getElementById('logging-panel');
    if (panel) {
        panel.style.display = loggingModeEnabled ? 'block' : 'none';
    }
}

/**
 * Add entry to logging panel
 */
function addLogEntry(type, agent, data, isInput = true) {
    if (!loggingModeEnabled) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        timestamp,
        type,
        agent,
        data,
        isInput
    };
    
    logEntries.push(logEntry);
    
    const targetContainer = isInput ? 'log-inputs' : 'log-outputs';
    const container = document.getElementById(targetContainer);
    
    if (container) {
        const entryDiv = document.createElement('div');
        entryDiv.className = `log-entry ${type}`;
        
        entryDiv.innerHTML = `
            <div class="log-timestamp">${timestamp}</div>
            <div class="log-agent">${agent}</div>
            <pre>${JSON.stringify(data, null, 2)}</pre>
        `;
        
        container.appendChild(entryDiv);
        container.scrollTop = container.scrollHeight;
    }
}

/**
 * Clear logging panel
 */
function clearLog() {
    logEntries = [];
    const inputContainer = document.getElementById('log-inputs');
    const outputContainer = document.getElementById('log-outputs');
    
    if (inputContainer) inputContainer.innerHTML = '';
    if (outputContainer) outputContainer.innerHTML = '';
}

/**
 * Export log data
 */
function exportLog() {
    const logData = {
        timestamp: new Date().toISOString(),
        entries: logEntries,
        session: currentSession
    };
    
    const dataStr = JSON.stringify(logData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `agent-log-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

/**
 * Update debug panel with Memory Keeper processing info
 */
function updateDebugPanel(input, response, parsed) {
    // This function is kept for backward compatibility but logging mode replaces it
    console.log('Debug info:', { input, response, parsed });
}



/**
 * Send user message
 */
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (!input || !input.value.trim() || isTyping || sendInProgress) return;
    
    const message = input.value.trim();
    input.value = '';
    
    // Add user message
    addMessage('user', 'user', message, { timestamp: new Date().toLocaleTimeString() });
    
    // Disable input while processing
    input.disabled = true;
    sendBtn.disabled = true;
    isTyping = true;
    sendInProgress = true;
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Process both agents in parallel to cut latency
        const tasks = [
            processWithMemoryKeeper(message),
            processWithCollaborator(message)
        ];
        await Promise.allSettled(tasks);
        
    } catch (error) {
        console.error('Error processing message:', error);
        addMessage('ai', 'system', 
            "I'm sorry, I encountered an error processing your message. Please try again.",
            { timestamp: new Date().toLocaleTimeString() }
        );
    } finally {
        // Re-enable input
        input.disabled = false;
        sendBtn.disabled = false;
        isTyping = false;
        sendInProgress = false;
        hideTypingIndicator();
        input.focus();
    }
}

/**
 * Process message with Memory Keeper agent
 */
async function processWithMemoryKeeper(message) {
    console.log('=== MEMORY KEEPER PROCESSING ===');
    console.log('Processing message:', message);
    console.log('Selected model:', selectedModel);
    
    updateMemoryStatus('Processing...');
    
    try {
        const requestBody = { 
            message,
            model: selectedModel,
            conversationId: getConversationId(),
            messageId: generateMessageId()
        };
        
        // Log the input request
        addLogEntry('input', 'Memory Keeper', {
            action: 'extract_memories',
            input_message: message,
            model: selectedModel,
            timestamp: new Date().toISOString()
        }, true);
        
        console.log('Sending request to Memory Keeper API:', requestBody);
        
        const response = await fetchWithTimeout(window.API_CONFIG.MEMORY_KEEPER, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            timeout: 20000
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Memory Keeper API Error:', errorText);
            
            // Log the error
            addLogEntry('error', 'Memory Keeper', {
                error: `API Error ${response.status}`,
                details: errorText,
                timestamp: new Date().toISOString()
            }, false);
            
            throw new Error(`Memory Keeper API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Memory Keeper response:', data);
        
        // Log the output response
        addLogEntry('output', 'Memory Keeper', {
            action: 'extract_memories_response',
            raw_claude_response: data.debugInfo?.rawResponse,
            extracted_memories: data.memories,
            model_used: data.debugInfo?.selectedModel,
            timestamp: new Date().toISOString()
        }, false);
        
        const extractedMemories = data.memories;
        
        // Do not render memories directly here; rely on SSE 'memory' events to avoid duplicates
        updateMemoryStatus('Complete');
        
    } catch (error) {
        console.error('Memory Keeper Error:', error);
        const friendlyMessage = sanitizeErrorForUser(error);
        updateMemoryStatus('Unable to process memories: ' + friendlyMessage);
        
        // Log the error
        addLogEntry('error', 'Memory Keeper', {
            error: error.message,
            friendlyError: friendlyMessage,
            timestamp: new Date().toISOString()
        }, false);
    }
}

/**
 * Process message with Collaborator agent
 */
async function processWithCollaborator(message) {
    try {
        // Build conversation history for context
        const conversationHistory = currentSession.messages
            .filter(msg => msg.type === 'user' || (msg.type === 'ai' && msg.agent === 'collaborator'))
            .slice(-4) // Last 4 messages for context
            .map(msg => ({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: msg.content
            }));
        
        const requestBody = { 
            message,
            conversationHistory,
            model: selectedModel 
        };
        
        // Log the input request
        addLogEntry('input', 'Collaborator', {
            action: 'generate_response',
            user_message: message,
            conversation_history: conversationHistory,
            model: selectedModel,
            timestamp: new Date().toISOString()
        }, true);
        
        const response = await fetchWithTimeout(window.API_CONFIG.COLLABORATOR, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            timeout: 20000
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            
            // Log the error
            addLogEntry('error', 'Collaborator', {
                error: `API Error ${response.status}`,
                details: errorText,
                timestamp: new Date().toISOString()
            }, false);
            
            throw new Error(`Collaborator API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Log the output response
        addLogEntry('output', 'Collaborator', {
            action: 'generate_response_result',
            claude_response: data.response,
            model_used: selectedModel,
            timestamp: new Date().toISOString()
        }, false);
        
        // Add Collaborator response with delay for natural feel
        setTimeout(() => {
            addMessage('ai', 'collaborator', data.response, { 
                timestamp: new Date().toLocaleTimeString() 
            });
        }, 1000 + Math.random() * 1000); // 1-2 second delay
        
    } catch (error) {
        console.error('Collaborator Error:', error);
        
        // Log the error
        addLogEntry('error', 'Collaborator', {
            error: error.message,
            timestamp: new Date().toISOString()
        }, false);
        
        // Show error message to user
        setTimeout(() => {
            addMessage('ai', 'system', 
                'I\'m sorry, I\'m having trouble connecting to the Collaborator service. Please check your internet connection and try again.',
                { timestamp: new Date().toLocaleTimeString() }
            );
        }, 1000);
    }
}





/**
 * Add message to chat
 */
function addMessage(type, agent, content, metadata = {}) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const avatar = document.createElement('div');
    avatar.className = `message-avatar ${type}`;
    avatar.textContent = type === 'user' ? '👤' : (agent === 'collaborator' ? '🤝' : '🧠');
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = content;
    
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    
    if (type === 'ai') {
        const badge = document.createElement('span');
        badge.className = 'agent-badge';
        badge.textContent = agent === 'collaborator' ? 'Collaborator' : 'Memory Keeper';
        meta.appendChild(badge);
    }
    
    if (metadata.timestamp) {
        const timestamp = document.createElement('span');
        timestamp.textContent = metadata.timestamp;
        meta.appendChild(timestamp);
    }
    
    contentDiv.appendChild(bubble);
    if (meta.children.length > 0) {
        contentDiv.appendChild(meta);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Store in session
    currentSession.messages.push({
        type,
        agent,
        content,
        timestamp: metadata.timestamp || new Date().toISOString()
    });
    
    // Auto-save encrypted session data (unless this is a restoration)
    if (!metadata.skipSave) {
        scheduleSecureSave();
    }
}

/**
 * Update memory display with extracted memories using DOM batching for performance
 */
function updateMemoryDisplay(extractedMemories) {
    if (!extractedMemories) {
        console.log('No extracted memories to display');
        return;
    }
    
    console.log('Updating memory display with:', extractedMemories);
    
    // Use requestAnimationFrame for smooth DOM updates
    requestAnimationFrame(() => {
        // Batch all DOM updates using documentFragment for better performance
        const categories = Object.keys(extractedMemories);
        
        categories.forEach(category => {
            const items = extractedMemories[category];
            if (Array.isArray(items) && items.length > 0) {
                ensureMemorySection(category);
                batchAddMemoryItems(category, items);
            }
        });
    });
    
    // Update session memories
    let memoriesUpdated = false;
    Object.keys(extractedMemories).forEach(category => {
        if (currentSession.memories[category] && Array.isArray(extractedMemories[category])) {
            extractedMemories[category].forEach(item => {
                if (!currentSession.memories[category].includes(item)) {
                    currentSession.memories[category].push(item);
                    memoriesUpdated = true;
                }
            });
        }
    });
    
    // Auto-save encrypted session data if memories were updated
    if (memoriesUpdated) {
        scheduleSecureSave();
    }
}

/**
 * Batch add multiple memory items using documentFragment for better performance
 */
function batchAddMemoryItems(category, items) {
    const container = document.getElementById(`memory-${category}`);
    if (!container || !items.length) return;
    
    // Remove placeholder if it exists
    const placeholder = container.querySelector('.memory-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    console.log(`Batch adding ${items.length} memory items to ${category}`);
    
    // Create documentFragment for batched DOM operations
    const fragment = document.createDocumentFragment();
    
    // Create all elements in memory first
    items.forEach(item => {
        const itemElement = createMemoryItemElement(category, item);
        if (itemElement) {
            fragment.appendChild(itemElement);
        }
    });
    
    // Single DOM append for all items - much faster than individual appends
    container.appendChild(fragment);
}

/**
 * Ensure a memory section exists for a given category; create dynamically if missing
 */
function ensureMemorySection(category) {
    const containerId = `memory-${category}`;
    if (document.getElementById(containerId)) return;
    const memoryContent = document.querySelector('.memory-content');
    if (!memoryContent) return;

    const section = document.createElement('div');
    section.className = 'memory-section';

    const title = document.createElement('h4');
    title.textContent = category.charAt(0).toUpperCase() + category.slice(1);

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'memory-items';
    itemsDiv.id = containerId;

    const placeholder = document.createElement('div');
    placeholder.className = 'memory-placeholder';
    placeholder.textContent = `No ${category} mentioned yet`;
    itemsDiv.appendChild(placeholder);

    section.appendChild(title);
    section.appendChild(itemsDiv);
    memoryContent.appendChild(section);
}

/**
 * Generic object renderer for unknown memory structures
 */
function renderGenericObject(obj) {
    try {
        const title = obj.name || obj.title || obj.label || obj.type || '';
        const entries = Object.entries(obj)
            .filter(([k, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `<div class="memory-detail"><strong>${capitalize(k)}:</strong> ${typeof v === 'object' ? JSON.stringify(v) : v}</div>`) 
            .join('');
        return title
            ? `<div class="memory-title">${title}</div>${entries}`
            : entries || `<div class="memory-detail">${JSON.stringify(obj)}</div>`;
    } catch (e) {
        return `<div class="memory-detail">${JSON.stringify(obj)}</div>`;
    }
}

function capitalize(str) {
    const s = String(str || '');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Create a single memory item element (helper for batching)
 */
function createMemoryItemElement(category, item) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'memory-item';
    
    // Handle different item formats and categories (same logic as before)
    if (typeof item === 'string') {
        itemDiv.textContent = item;
    } else if (typeof item === 'object' && item !== null) {
        switch (category) {
            case 'people':
                if (item.name) {
                    itemDiv.innerHTML = `
                        <div class="memory-title">${item.name}</div>
                        ${item.relationship ? `<div class="memory-detail">Relationship: ${item.relationship}</div>` : ''}
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else {
                    itemDiv.innerHTML = renderGenericObject(item);
                }
                break;
                
            case 'dates':
                if (item.event || item.description || item.name) {
                    const title = item.event || item.description || item.name;
                    itemDiv.innerHTML = `
                        <div class="memory-title">${title}</div>
                        ${item.timeframe ? `<div class="memory-detail">When: ${item.timeframe}</div>` : ''}
                        ${item.date ? `<div class="memory-detail">Date: ${item.date}</div>` : ''}
                        ${item.time ? `<div class="memory-detail">Time: ${item.time}</div>` : ''}
                        ${item.significance ? `<div class="memory-detail">Significance: ${item.significance}</div>` : ''}
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else {
                    itemDiv.innerHTML = renderGenericObject(item);
                }
                break;
                
            case 'places':
                if (item.location || item.place || item.name) {
                    const title = item.location || item.place || item.name;
                    itemDiv.innerHTML = `
                        <div class="memory-title">${title}</div>
                        ${item.significance ? `<div class="memory-detail">Significance: ${item.significance}</div>` : ''}
                        ${item.type ? `<div class="memory-detail">Type: ${item.type}</div>` : ''}
                        ${item.description ? `<div class="memory-detail">${item.description}</div>` : ''}
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else {
                    itemDiv.innerHTML = renderGenericObject(item);
                }
                break;
                
            case 'relationships':
                if (item.person1 && item.person2 && item.type) {
                    itemDiv.innerHTML = `
                        <div class="memory-title">${item.person1} ↔ ${item.person2}</div>
                        <div class="memory-detail">Relationship: ${item.type}</div>
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else if (item.connection || item.relationship || item.name) {
                    const title = item.connection || item.relationship || item.name;
                    itemDiv.innerHTML = `
                        <div class="memory-title">${title}</div>
                        ${item.nature ? `<div class="memory-detail">Type: ${item.nature}</div>` : ''}
                        ${item.type ? `<div class="memory-detail">Type: ${item.type}</div>` : ''}
                        ${item.description ? `<div class="memory-detail">${item.description}</div>` : ''}
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else {
                    itemDiv.innerHTML = renderGenericObject(item);
                }
                break;
                
            case 'events':
                {
                    const eventTitle = item.event || item.description || item.name || item.title || item.type;
                    if (eventTitle) {
                        itemDiv.innerHTML = `
                            <div class="memory-title">${eventTitle}</div>
                            ${item.type ? `<div class="memory-detail">Type: ${item.type}</div>` : ''}
                            ${item.timeframe ? `<div class="memory-detail">When: ${item.timeframe}</div>` : ''}
                            ${item.date ? `<div class="memory-detail">Date: ${item.date}</div>` : ''}
                            ${item.location ? `<div class="memory-detail">Where: ${item.location}</div>` : ''}
                            ${item.significance ? `<div class="memory-detail">Significance: ${item.significance}</div>` : ''}
                            ${item.participants ? `<div class="memory-detail">Who: ${Array.isArray(item.participants) ? item.participants.join(', ') : item.participants}</div>` : ''}
                            ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                        `;
                    } else {
                        itemDiv.innerHTML = renderGenericObject(item);
                    }
                }
                break;
                
            default:
                itemDiv.innerHTML = renderGenericObject(item);
        }
    } else {
        itemDiv.textContent = String(item);
    }
    
    return itemDiv;
}

/**
 * Add memory item to display (legacy function - kept for compatibility)
 */
function addMemoryItem(category, item) {
    const container = document.getElementById(`memory-${category}`);
    if (!container) return;
    
    // Remove placeholder if it exists
    const placeholder = container.querySelector('.memory-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    console.log(`Adding memory item to ${category}:`, item);
    
    // Create the memory item element
    const itemDiv = document.createElement('div');
    itemDiv.className = 'memory-item';
    
    // Handle different item formats and categories
    if (typeof item === 'string') {
        // Simple string - just display it
        itemDiv.textContent = item;
    } else if (typeof item === 'object' && item !== null) {
        // Structured object - format based on category
        switch (category) {
            case 'people':
                if (item.name) {
                    itemDiv.innerHTML = `
                        <div class="memory-title">${item.name}</div>
                        ${item.relationship ? `<div class="memory-detail">Relationship: ${item.relationship}</div>` : ''}
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else {
                    itemDiv.textContent = item.person || JSON.stringify(item);
                }
                break;
                
            case 'dates':
                if (item.event || item.description || item.name) {
                    const title = item.event || item.description || item.name;
                    itemDiv.innerHTML = `
                        <div class="memory-title">${title}</div>
                        ${item.timeframe ? `<div class="memory-detail">When: ${item.timeframe}</div>` : ''}
                        ${item.date ? `<div class="memory-detail">Date: ${item.date}</div>` : ''}
                        ${item.time ? `<div class="memory-detail">Time: ${item.time}</div>` : ''}
                        ${item.significance ? `<div class="memory-detail">Significance: ${item.significance}</div>` : ''}
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else {
                    itemDiv.textContent = item.date || item.time || JSON.stringify(item);
                }
                break;
                
            case 'places':
                if (item.location || item.place || item.name) {
                    const title = item.location || item.place || item.name;
                    itemDiv.innerHTML = `
                        <div class="memory-title">${title}</div>
                        ${item.significance ? `<div class="memory-detail">Significance: ${item.significance}</div>` : ''}
                        ${item.type ? `<div class="memory-detail">Type: ${item.type}</div>` : ''}
                        ${item.description ? `<div class="memory-detail">${item.description}</div>` : ''}
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else {
                    itemDiv.textContent = JSON.stringify(item);
                }
                break;
                
            case 'relationships':
                if (item.person1 && item.person2 && item.type) {
                    // Handle Claude's actual relationship structure: person1, person2, type
                    itemDiv.innerHTML = `
                        <div class="memory-title">${item.person1} ↔ ${item.person2}</div>
                        <div class="memory-detail">Relationship: ${item.type}</div>
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else if (item.connection || item.relationship || item.name) {
                    // Fallback for other relationship formats
                    const title = item.connection || item.relationship || item.name;
                    itemDiv.innerHTML = `
                        <div class="memory-title">${title}</div>
                        ${item.nature ? `<div class="memory-detail">Type: ${item.nature}</div>` : ''}
                        ${item.type ? `<div class="memory-detail">Type: ${item.type}</div>` : ''}
                        ${item.description ? `<div class="memory-detail">${item.description}</div>` : ''}
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else {
                    itemDiv.textContent = item.person || JSON.stringify(item);
                }
                break;
                
            case 'events':
                if (item.event || item.description) {
                    const eventTitle = item.event || item.description;
                    itemDiv.innerHTML = `
                        <div class="memory-title">${eventTitle}</div>
                        ${item.date ? `<div class="memory-detail">When: ${item.date}</div>` : ''}
                        ${item.participants ? `<div class="memory-detail">Who: ${item.participants}</div>` : ''}
                        ${item.significance ? `<div class="memory-detail">Significance: ${item.significance}</div>` : ''}
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else {
                    itemDiv.textContent = item.name || JSON.stringify(item);
                }
                break;
                
            default:
                // Fallback for unknown categories
                if (item.name) {
                    itemDiv.textContent = item.name;
                } else if (item.text) {
                    itemDiv.textContent = item.text;
                } else {
                    itemDiv.textContent = JSON.stringify(item);
                }
        }
    } else {
        itemDiv.textContent = String(item);
    }
    
    // Check if similar item already exists (compare by main content)
    const mainText = itemDiv.querySelector('.memory-title')?.textContent || itemDiv.textContent;
    const existing = Array.from(container.children).find(child => {
        const existingMainText = child.querySelector('.memory-title')?.textContent || child.textContent;
        return existingMainText === mainText;
    });
    
    if (existing) {
        console.log(`Duplicate memory item skipped for ${category}:`, mainText);
        return;
    }
    
    container.appendChild(itemDiv);
}

/**
 * Update memory status
 */
function updateMemoryStatus(status) {
    const statusElement = document.getElementById('memory-status');
    if (statusElement) {
        statusElement.textContent = status;
        
        // Update status styling
        statusElement.className = 'memory-status';
        if (status.toLowerCase().includes('processing')) {
            statusElement.classList.add('processing');
        } else if (status.toLowerCase().includes('complete')) {
            statusElement.classList.add('complete');
        } else if (status.toLowerCase().includes('error')) {
            statusElement.classList.add('error');
        }
    }
    
    // Check if we have any memories and update status accordingly
    const hasMemories = Object.values(currentSession.memories).some(arr => arr.length > 0);
    if (hasMemories && status === 'Ready') {
        updateMemoryStatus('Memories Collected');
    }
}

/**
 * Show typing indicator with progressive messages
 */
function showTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.style.display = 'flex';
        
        // Progressive loading messages for better perceived performance
        const messages = [
            'Processing your story...',
            'Extracting memories...',
            'Generating response...',
            'Almost ready...'
        ];
        
        let messageIndex = 0;
        const messageElement = indicator.querySelector('.typing-message');
        
        // Update message every 800ms for perceived progress
        const messageInterval = setInterval(() => {
            if (messageElement && messageIndex < messages.length - 1) {
                messageIndex++;
                messageElement.textContent = messages[messageIndex];
            }
        }, 800);
        
        // Animate progress bar for visual feedback
        const progressBar = indicator.querySelector('#typing-progress-bar');
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15 + 5; // Random progress increments for realistic feel
            if (progress > 85) progress = 85; // Cap at 85% until completion
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
        }, 200);
        
        // Store interval IDs for cleanup
        indicator.dataset.messageInterval = messageInterval;
        indicator.dataset.progressInterval = progressInterval;
        
        // Set initial message and progress
        if (messageElement) {
            messageElement.textContent = messages[0];
        }
        if (progressBar) {
            progressBar.style.width = '10%';
        }
    }
}

/**
 * Hide typing indicator and cleanup intervals
 */
function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.style.display = 'none';
        
        // Clean up intervals to prevent memory leaks
        const messageInterval = indicator.dataset.messageInterval;
        const progressInterval = indicator.dataset.progressInterval;
        
        if (messageInterval) {
            clearInterval(parseInt(messageInterval));
            delete indicator.dataset.messageInterval;
        }
        
        if (progressInterval) {
            clearInterval(parseInt(progressInterval));
            delete indicator.dataset.progressInterval;
        }
        
        // Complete progress bar animation before hiding
        const progressBar = indicator.querySelector('#typing-progress-bar');
        if (progressBar) {
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressBar.style.width = '0%';
            }, 300);
        }
        
        // Reset message text
        const messageElement = indicator.querySelector('.typing-message');
        if (messageElement) {
            messageElement.textContent = '';
        }
    }
}

/**
 * Toggle memory panel visibility
 */
function toggleMemoryPanelVisibility() {
    const panel = document.getElementById('memory-panel');
    if (panel) {
        if (memoryDisplayVisible) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    }
}

/**
 * Start new session
 */
function startNewSession() {
    // Clear current session
    currentSession = {
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
    resetMemoryDisplay();
    
    // Clear secure session storage
    clearSecureSession();
    
    // Show welcome modal again
    showWelcomeModal();
}

/**
 * Auto-start conversation for new users coming from splash page
 */
function autoStartConversation() {
    // Check if user just came from splash page or is a new user
    const isNewUser = !localStorage.getItem('story_session_exists');
    const hasNoMessages = currentSession.messages.length === 0;
    const justStarted = localStorage.getItem('story-collection-used') === 'true';
    
    // Auto-start conversation for new users or those coming from splash
    if ((isNewUser || hasNoMessages) && justStarted) {
        console.log('🎬 New user detected, starting conversation automatically...');
        
        // Small delay for better UX, then start conversation
        setTimeout(() => {
            startInitialConversation();
        }, 1000);
    }
}

/**
 * Start the initial conversation with the Collaborator
 */
function startInitialConversation() {
    // Add initial collaborator message
    addMessage('assistant', 'Collaborator', 
        "Hello! I'm so glad you're here to share your stories with me. I'm your Collaborator, and I'll be asking thoughtful questions to help you share your memories. The Memory Keeper will be organizing everything we discuss.\n\nLet's start with something simple - could you tell me your name and where you grew up?",
        { timestamp: new Date().toLocaleTimeString() }
    );
    
    // Mark that we've started the session
    localStorage.setItem('story_session_exists', 'true');
    
    console.log('✅ Initial conversation started successfully');
}

/**
 * Reset memory display
 */
function resetMemoryDisplay() {
    const categories = ['people', 'dates', 'places', 'relationships', 'events'];
    categories.forEach(category => {
        const container = document.getElementById(`memory-${category}`);
        if (container) {
            container.innerHTML = '<div class="memory-placeholder">No ' + category + ' mentioned yet</div>';
        }
    });
    updateMemoryStatus('Ready');
}

/**
 * Export session data
 */
function exportSession() {
    const sessionData = {
        timestamp: new Date().toISOString(),
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
