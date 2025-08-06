/**
 * Conversation Service for Server-Centric Architecture
 * Handles conversations, messages, and memories via backend API
 */

class ConversationService {
    constructor() {
        this.baseURL = 'http://localhost:3000/api';
        this.currentConversationId = null;
    }

    /**
     * Get all conversations for the user
     */
    async getConversations() {
        try {
            const response = await window.authService.authenticatedFetch(`${this.baseURL}/conversations`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to fetch conversations');
            }

            const result = await response.json();
            return result.conversations || [];
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
            throw error;
        }
    }

    /**
     * Create a new conversation
     */
    async createConversation(title = 'New Story Session') {
        try {
            const response = await window.authService.authenticatedFetch(`${this.baseURL}/conversations`, {
                method: 'POST',
                body: JSON.stringify({ title })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create conversation');
            }

            const result = await response.json();
            this.currentConversationId = result.conversation.id;
            return result.conversation;
        } catch (error) {
            console.error('Failed to create conversation:', error);
            throw error;
        }
    }

    /**
     * Get conversation with messages and memories
     */
    async getConversation(conversationId) {
        try {
            const response = await window.authService.authenticatedFetch(`${this.baseURL}/conversations/${conversationId}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to fetch conversation');
            }

            const result = await response.json();
            return result.conversation;
        } catch (error) {
            console.error('Failed to fetch conversation:', error);
            throw error;
        }
    }

    /**
     * Send a message and get AI response
     */
    async sendMessage(message, model = 'claude-3-5-sonnet-20241022') {
        if (!this.currentConversationId) {
            // Create a new conversation if none exists
            await this.createConversation();
        }

        try {
            const response = await window.authService.authenticatedFetch(
                `${this.baseURL}/conversations/${this.currentConversationId}/messages`,
                {
                    method: 'POST',
                    body: JSON.stringify({ 
                        content: message,
                        model: model
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to send message');
            }

            const result = await response.json();
            return {
                userMessage: result.userMessage,
                aiResponse: result.aiResponse,
                memories: result.memories || []
            };
        } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
        }
    }

    /**
     * Get all memories for the user
     */
    async getMemories(filters = {}) {
        try {
            const queryParams = new URLSearchParams();
            
            if (filters.category) queryParams.append('category', filters.category);
            if (filters.conversationId) queryParams.append('conversationId', filters.conversationId);
            if (filters.verified !== undefined) queryParams.append('verified', filters.verified);
            if (filters.search) queryParams.append('search', filters.search);
            if (filters.limit) queryParams.append('limit', filters.limit);
            if (filters.offset) queryParams.append('offset', filters.offset);

            const url = `${this.baseURL}/memories${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            const response = await window.authService.authenticatedFetch(url);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to fetch memories');
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Failed to fetch memories:', error);
            throw error;
        }
    }

    /**
     * Update a memory (verify, edit content, etc.)
     */
    async updateMemory(memoryId, updates) {
        try {
            const response = await window.authService.authenticatedFetch(`${this.baseURL}/memories/${memoryId}`, {
                method: 'PUT',
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update memory');
            }

            const result = await response.json();
            return result.memory;
        } catch (error) {
            console.error('Failed to update memory:', error);
            throw error;
        }
    }

    /**
     * Delete a memory
     */
    async deleteMemory(memoryId) {
        try {
            const response = await window.authService.authenticatedFetch(`${this.baseURL}/memories/${memoryId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete memory');
            }

            return true;
        } catch (error) {
            console.error('Failed to delete memory:', error);
            throw error;
        }
    }

    /**
     * Delete a conversation
     */
    async deleteConversation(conversationId) {
        try {
            const response = await window.authService.authenticatedFetch(`${this.baseURL}/conversations/${conversationId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete conversation');
            }

            if (this.currentConversationId === conversationId) {
                this.currentConversationId = null;
            }

            return true;
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            throw error;
        }
    }

    /**
     * Update conversation (title, archive status)
     */
    async updateConversation(conversationId, updates) {
        try {
            const response = await window.authService.authenticatedFetch(`${this.baseURL}/conversations/${conversationId}`, {
                method: 'PUT',
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update conversation');
            }

            const result = await response.json();
            return result.conversation;
        } catch (error) {
            console.error('Failed to update conversation:', error);
            throw error;
        }
    }

    /**
     * Set current conversation ID
     */
    setCurrentConversation(conversationId) {
        this.currentConversationId = conversationId;
    }

    /**
     * Get current conversation ID
     */
    getCurrentConversationId() {
        return this.currentConversationId;
    }
}

// Create global conversation service instance
window.conversationService = new ConversationService();
