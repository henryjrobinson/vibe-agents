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
let isTyping = false;
let memoryDisplayVisible = true;
let loggingModeEnabled = false;
let selectedModel = 'claude-3-5-sonnet-20241022'; // Default model
let logEntries = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeToggles();
    initializeInput();
    initializeButtons();
    initializeModelSelector();
    initializeDebugPanel();
    showWelcomeModal();
});

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
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
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
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
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
 * Show welcome modal
 */
function showWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

/**
 * Start story session - hide modal and begin conversation
 */
function startStorySession() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Add initial collaborator message
    setTimeout(() => {
        addMessage('ai', 'collaborator', 
            "Hello! I'm so glad you're here to share your stories with me. I'm your Collaborator, and I'll be asking thoughtful questions to help you share your memories. The Memory Keeper will be organizing everything we discuss.\n\nLet's start with something simple - could you tell me your name and where you grew up?",
            { timestamp: new Date().toLocaleTimeString() }
        );
    }, 500);
}

/**
 * Send user message
 */
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (!input || !input.value.trim() || isTyping) return;
    
    const message = input.value.trim();
    input.value = '';
    
    // Add user message
    addMessage('user', 'user', message, { timestamp: new Date().toLocaleTimeString() });
    
    // Disable input while processing
    input.disabled = true;
    sendBtn.disabled = true;
    isTyping = true;
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Process with Memory Keeper first
        await processWithMemoryKeeper(message);
        
        // Then get Collaborator response
        await processWithCollaborator(message);
        
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
            model: selectedModel 
        };
        
        // Log the input request
        addLogEntry('input', 'Memory Keeper', {
            action: 'extract_memories',
            input_message: message,
            model: selectedModel,
            timestamp: new Date().toISOString()
        }, true);
        
        console.log('Sending request to Memory Keeper API:', requestBody);
        
        const response = await fetch('/api/memory-keeper', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
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
        
        // Update memory display
        updateMemoryDisplay(extractedMemories);
        updateMemoryStatus('Complete');
        
    } catch (error) {
        console.error('Memory Keeper Error:', error);
        updateMemoryStatus('Error: ' + error.message);
        
        // Log the error
        addLogEntry('error', 'Memory Keeper', {
            error: error.message,
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
            .slice(-6) // Last 6 messages for context
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
        
        const response = await fetch('/api/collaborator', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
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
}

/**
 * Update memory display with extracted memories
 */
function updateMemoryDisplay(extractedMemories) {
    if (!extractedMemories) {
        console.log('No extracted memories to display');
        return;
    }
    
    console.log('Updating memory display with:', extractedMemories);
    
    // Update each category
    if (extractedMemories.people && extractedMemories.people.length > 0) {
        extractedMemories.people.forEach(person => addMemoryItem('people', person));
    }
    if (extractedMemories.dates && extractedMemories.dates.length > 0) {
        extractedMemories.dates.forEach(date => addMemoryItem('dates', date));
    }
    if (extractedMemories.places && extractedMemories.places.length > 0) {
        extractedMemories.places.forEach(place => addMemoryItem('places', place));
    }
    if (extractedMemories.relationships && extractedMemories.relationships.length > 0) {
        extractedMemories.relationships.forEach(rel => addMemoryItem('relationships', rel));
    }
    if (extractedMemories.events && extractedMemories.events.length > 0) {
        extractedMemories.events.forEach(event => addMemoryItem('events', event));
    }
    
    // Update session memories
    Object.keys(extractedMemories).forEach(category => {
        if (currentSession.memories[category] && Array.isArray(extractedMemories[category])) {
            extractedMemories[category].forEach(item => {
                if (!currentSession.memories[category].includes(item)) {
                    currentSession.memories[category].push(item);
                }
            });
        }
    });
}

/**
 * Add memory item to display
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
                itemDiv.textContent = item.name || item.person || JSON.stringify(item);
                break;
                
            case 'dates':
                if (item.event && item.timeframe) {
                    itemDiv.innerHTML = `
                        <div class="memory-title">${item.event}</div>
                        <div class="memory-detail">When: ${item.timeframe}</div>
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else {
                    itemDiv.textContent = item.date || item.time || JSON.stringify(item);
                }
                break;
                
            case 'places':
                if (item.location) {
                    itemDiv.innerHTML = `
                        <div class="memory-title">${item.location}</div>
                        ${item.significance ? `<div class="memory-detail">${item.significance}</div>` : ''}
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else {
                    itemDiv.textContent = item.place || item.name || JSON.stringify(item);
                }
                break;
                
            case 'relationships':
                if (item.connection && item.nature) {
                    itemDiv.innerHTML = `
                        <div class="memory-title">${item.connection}</div>
                        <div class="memory-detail">Relationship: ${item.nature}</div>
                        ${item.details ? `<div class="memory-detail">${item.details}</div>` : ''}
                    `;
                } else {
                    itemDiv.textContent = item.relationship || item.person || JSON.stringify(item);
                }
                break;
                
            case 'events':
                if (item.event) {
                    itemDiv.innerHTML = `
                        <div class="memory-title">${item.event}</div>
                        ${item.participants ? `<div class="memory-detail">Who: ${item.participants}</div>` : ''}
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
 * Show typing indicator
 */
function showTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.style.display = 'flex';
    }
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.style.display = 'none';
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
    
    // Show welcome modal again
    showWelcomeModal();
}

/**
 * Logout function
 */
function logout() {
    // Clear authentication
    sessionStorage.removeItem('storyAuth');
    
    // Redirect to auth page
    window.location.href = '/auth.html';
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
