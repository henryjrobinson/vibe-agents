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
let agentMetadataVisible = true;
let memoryDisplayVisible = true;
let selectedModel = 'claude-3-5-sonnet-20241022'; // Default model

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
    const agentToggle = document.getElementById('agent-metadata-toggle');
    const memoryToggle = document.getElementById('memory-display-toggle');
    
    if (agentToggle) {
        agentToggle.addEventListener('change', function() {
            agentMetadataVisible = this.checked;
            toggleAgentMetadataVisibility();
        });
        agentMetadataVisible = agentToggle.checked;
    }
    
    if (memoryToggle) {
        memoryToggle.addEventListener('change', function() {
            memoryDisplayVisible = this.checked;
            toggleMemoryPanelVisibility();
        });
        memoryDisplayVisible = memoryToggle.checked;
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
    
    // Start story button (in modal)
    const startStoryBtn = document.getElementById('start-story-btn');
    if (startStoryBtn) {
        startStoryBtn.addEventListener('click', startStorySession);
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
 * Update debug panel with Memory Keeper processing info
 */
function updateDebugPanel(input, response, parsed) {
    const debugInput = document.getElementById('debug-input');
    const debugResponse = document.getElementById('debug-response');
    const debugParsed = document.getElementById('debug-parsed');
    
    if (debugInput) debugInput.textContent = input || 'No input data';
    if (debugResponse) debugResponse.textContent = response || 'No response data';
    if (debugParsed) debugParsed.textContent = JSON.stringify(parsed, null, 2) || 'No parsed data';
    
    // Auto-show debug panel if there's an issue
    if (response && (!parsed || Object.values(parsed).every(arr => arr.length === 0))) {
        const debugPanel = document.getElementById('debug-panel');
        const debugContent = document.getElementById('debug-content');
        const debugToggleBtn = document.getElementById('debug-toggle-btn');
        
        if (debugPanel && debugContent && debugToggleBtn) {
            debugPanel.style.display = 'block';
            debugContent.style.display = 'block';
            debugToggleBtn.textContent = 'Hide Debug Info';
        }
    }
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
    console.log('=== MEMORY KEEPER FRONTEND DEBUG ===');
    console.log('Processing message:', message);
    console.log('Selected model:', selectedModel);
    console.log('Message length:', message.length);
    
    updateMemoryStatus('Processing...');
    
    try {
        const requestBody = { 
            message,
            model: selectedModel 
        };
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        
        const response = await fetch('/api/memory-keeper', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`Memory Keeper API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Memory Keeper response:', JSON.stringify(data, null, 2));
        const extractedMemories = data.memories;
        
        // Update debug panel with processing info
        updateDebugPanel(
            message, 
            data.debugInfo?.rawResponse || 'Debug info not available', 
            extractedMemories
        );
        
        // Update memory display
        updateMemoryDisplay(extractedMemories);
        updateMemoryStatus('Complete');
        
    } catch (error) {
        console.error('Memory Keeper Error:', error);
        updateMemoryStatus('Error: ' + error.message);
        
        // Update debug panel with error info
        updateDebugPanel(
            message,
            `Error: ${error.message}`,
            null
        );
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
        
        const response = await fetch('/api/collaborator', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                message,
                conversationHistory,
                model: selectedModel 
            })
        });
        
        if (!response.ok) {
            throw new Error(`Collaborator API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Add collaborator response after a realistic delay
        setTimeout(() => {
            addMessage('ai', 'collaborator', data.response, { 
                timestamp: new Date().toLocaleTimeString() 
            });
        }, 1000 + Math.random() * 1000); // 1-2 second delay
        
    } catch (error) {
        console.error('Collaborator Error:', error);
        
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
    
    if (agentMetadataVisible && type === 'ai') {
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
    
    // Check if item already exists
    const existing = Array.from(container.children).find(child => 
        child.textContent === item
    );
    if (existing) return;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'memory-item';
    itemDiv.textContent = item;
    
    container.appendChild(itemDiv);
}

/**
 * Update memory status
 */
function updateMemoryStatus(status) {
    const statusElement = document.getElementById('memory-status');
    if (statusElement) {
        statusElement.textContent = status;
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
 * Toggle agent metadata visibility
 */
function toggleAgentMetadataVisibility() {
    const messages = document.querySelectorAll('.message.ai .agent-badge');
    messages.forEach(badge => {
        badge.style.display = agentMetadataVisible ? 'inline' : 'none';
    });
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
