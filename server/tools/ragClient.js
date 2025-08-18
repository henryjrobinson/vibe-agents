/**
 * RAG Client for Agent Integration
 * Provides simple interface for agents to access story knowledge base
 */

const ragService = require('./ragService');

class RAGClient {
    constructor(userId) {
        this.userId = userId;
    }

    /**
     * Search for relevant stories based on query
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Array of relevant stories
     */
    async searchStories(query, options = {}) {
        try {
            const result = await ragService.searchStories(this.userId, query, options);
            return result.results || [];
        } catch (error) {
            console.error('RAG Client search error:', error);
            return [];
        }
    }

    /**
     * Get stories relevant to current conversation context
     * @param {string} context - Current conversation context
     * @param {number} maxStories - Maximum number of stories to return
     * @returns {Promise<Array>} Array of relevant stories
     */
    async getRelevantContext(context, maxStories = 3) {
        try {
            const result = await ragService.getRelevantStories(this.userId, context, maxStories);
            return result.stories || [];
        } catch (error) {
            console.error('RAG Client context error:', error);
            return [];
        }
    }

    /**
     * Get stories about specific people
     * @param {Array<string>} people - Names of people to search for
     * @param {number} limit - Maximum number of stories
     * @returns {Promise<Array>} Stories involving the specified people
     */
    async getStoriesAboutPeople(people, limit = 5) {
        try {
            const result = await ragService.searchStories(this.userId, '', {
                people,
                limit
            });
            return result.results || [];
        } catch (error) {
            console.error('RAG Client people search error:', error);
            return [];
        }
    }

    /**
     * Get stories from specific places
     * @param {Array<string>} places - Places to search for
     * @param {number} limit - Maximum number of stories
     * @returns {Promise<Array>} Stories from the specified places
     */
    async getStoriesFromPlaces(places, limit = 5) {
        try {
            const result = await ragService.searchStories(this.userId, '', {
                places,
                limit
            });
            return result.results || [];
        } catch (error) {
            console.error('RAG Client places search error:', error);
            return [];
        }
    }

    /**
     * Get stories about specific events
     * @param {Array<string>} events - Events to search for
     * @param {number} limit - Maximum number of stories
     * @returns {Promise<Array>} Stories about the specified events
     */
    async getStoriesAboutEvents(events, limit = 5) {
        try {
            const result = await ragService.searchStories(this.userId, '', {
                events,
                limit
            });
            return result.results || [];
        } catch (error) {
            console.error('RAG Client events search error:', error);
            return [];
        }
    }

    /**
     * Format stories for agent context
     * @param {Array} stories - Array of story objects
     * @param {boolean} includeMetadata - Whether to include metadata
     * @returns {string} Formatted context string
     */
    formatStoriesForContext(stories, includeMetadata = false) {
        if (!stories || stories.length === 0) {
            return '';
        }

        return stories.map((story, index) => {
            let formatted = `Story ${index + 1}: ${story.title}\n${story.summary || story.content}`;
            
            if (includeMetadata) {
                const metadata = [];
                if (story.people && story.people.length > 0) {
                    metadata.push(`People: ${story.people.join(', ')}`);
                }
                if (story.places && story.places.length > 0) {
                    metadata.push(`Places: ${story.places.join(', ')}`);
                }
                if (story.events && story.events.length > 0) {
                    metadata.push(`Events: ${story.events.join(', ')}`);
                }
                if (metadata.length > 0) {
                    formatted += `\n(${metadata.join(' | ')})`;
                }
            }
            
            return formatted;
        }).join('\n\n');
    }

    /**
     * Get enriched context for agent responses
     * @param {string} userMessage - Current user message
     * @param {Array<string>} conversationHistory - Recent conversation history
     * @returns {Promise<Object>} Enriched context object
     */
    async getEnrichedContext(userMessage, conversationHistory = []) {
        try {
            // Combine user message and recent history for context
            const contextText = [userMessage, ...conversationHistory.slice(-3)].join(' ');
            
            // Get relevant stories
            const relevantStories = await this.getRelevantContext(contextText, 3);
            
            // Format for agent use
            const formattedContext = this.formatStoriesForContext(relevantStories, true);
            
            return {
                hasRelevantStories: relevantStories.length > 0,
                storyCount: relevantStories.length,
                formattedContext,
                stories: relevantStories
            };
        } catch (error) {
            console.error('RAG Client enriched context error:', error);
            return {
                hasRelevantStories: false,
                storyCount: 0,
                formattedContext: '',
                stories: []
            };
        }
    }

    /**
     * Process new memories into stories
     * @param {string} conversationId - Conversation ID to process
     * @returns {Promise<Object>} Processing result
     */
    async processMemories(conversationId = null) {
        try {
            return await ragService.processMemoriesIntoStories(this.userId, conversationId);
        } catch (error) {
            console.error('RAG Client process memories error:', error);
            return { success: false, message: 'Failed to process memories', stories: [] };
        }
    }

    /**
     * Get user's story statistics
     * @returns {Promise<Object>} Story statistics
     */
    async getStats() {
        try {
            const result = await ragService.getStoryStats(this.userId);
            return result.stats || {};
        } catch (error) {
            console.error('RAG Client stats error:', error);
            return {};
        }
    }
}

/**
 * Factory function to create RAG client for a user
 * @param {string} userId - User ID
 * @returns {RAGClient} RAG client instance
 */
function createRAGClient(userId) {
    return new RAGClient(userId);
}

module.exports = {
    RAGClient,
    createRAGClient
};
