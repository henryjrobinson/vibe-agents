const storyAggregator = require('./storyAggregator');
const storyStore = require('../storage/storyStore');
const memoryStore = require('../storage/database');
const OpenAI = require('openai');

class RAGService {
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        this.hasOpenAI = Boolean(apiKey);
        if (this.hasOpenAI) {
            this.openai = new OpenAI({
                apiKey
            });
        } else {
            this.openai = null;
            console.warn('OPENAI_API_KEY not set; RAGService will skip embeddings and entity extraction (using fallbacks).');
        }
    }

    /**
     * Process memories into stories and store them
     */
    async processMemoriesIntoStories(userId, conversationId = null) {
        try {
            // Get memories for the user
            let memories;
            if (conversationId) {
                memories = await memoryStore.listMemories(conversationId, userId);
            } else {
                // Get all memories for user (you'll need to implement this method)
                memories = await this.getAllMemoriesForUser(userId);
            }

            if (!memories || memories.length === 0) {
                return { success: true, message: 'No memories to process', stories: [] };
            }

            // Aggregate memories into stories
            const stories = await storyAggregator.aggregateMemories(memories, userId);

            // Save stories to database
            const savedStories = [];
            for (const story of stories) {
                try {
                    const savedStory = await storyStore.saveStory(story);
                    savedStories.push(savedStory);
                } catch (error) {
                    console.error('Error saving story:', error);
                }
            }

            return {
                success: true,
                message: `Processed ${memories.length} memories into ${savedStories.length} stories`,
                stories: savedStories
            };
        } catch (error) {
            console.error('Error processing memories into stories:', error);
            throw error;
        }
    }

    /**
     * Search stories using semantic search
     */
    async searchStories(userId, query, options = {}) {
        try {
            let searchQuery = query;

            // If query is a string, generate embedding
            if (typeof query === 'string') {
                const embedding = await this.generateQueryEmbedding(query);
                searchQuery = { text: query, embedding };
            }

            // Search stories
            const stories = await storyStore.searchStories(userId, searchQuery, options);

            return {
                success: true,
                query: typeof query === 'string' ? query : 'semantic search',
                results: stories,
                count: stories.length
            };
        } catch (error) {
            console.error('Error searching stories:', error);
            throw error;
        }
    }

    /**
     * Get relevant stories for agent context
     */
    async getRelevantStories(userId, context, maxStories = 5) {
        try {
            // Extract key entities from context
            const entities = await this.extractEntitiesFromContext(context);
            
            // Search for stories using entities
            const searchOptions = {
                limit: maxStories,
                people: entities.people,
                places: entities.places,
                events: entities.events
            };

            // Perform semantic search with context
            const searchResult = await this.searchStories(userId, context, searchOptions);
            
            return {
                success: true,
                context: context.substring(0, 100) + '...',
                stories: searchResult.results,
                entities
            };
        } catch (error) {
            console.error('Error getting relevant stories:', error);
            throw error;
        }
    }

    /**
     * Generate embedding for search query
     */
    async generateQueryEmbedding(query) {
        // If OpenAI is not configured, skip embedding generation
        if (!this.hasOpenAI) return null;

        try {
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: query.substring(0, 8000)
            });

            return response.data[0].embedding;
        } catch (error) {
            console.error('Error generating query embedding:', error);
            return null;
        }
    }

    /**
     * Extract entities from context for better search
     */
    async extractEntitiesFromContext(context) {
        // If OpenAI is not configured, return empty entities as a safe fallback
        if (!this.hasOpenAI) return { people: [], places: [], events: [] };

        try {
            const prompt = `Extract key entities from this text for story search:

"${context}"

Return JSON with arrays for:
- people: names of people mentioned
- places: locations mentioned  
- events: activities or events mentioned

Format: {"people": [], "places": [], "events": []}`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200,
                temperature: 0.3
            });

            const entities = JSON.parse(response.choices[0].message.content);
            return {
                people: entities.people || [],
                places: entities.places || [],
                events: entities.events || []
            };
        } catch (error) {
            console.error('Error extracting entities:', error);
            return { people: [], places: [], events: [] };
        }
    }
    
    /**
     * Get all memories for a user (placeholder - implement based on your memory store)
     */
    async getAllMemoriesForUser(userId) {
        // This is a placeholder - you'll need to implement this based on your memory store structure
        // For now, return empty array
        console.warn('getAllMemoriesForUser not implemented - returning empty array');
        return [];
    }

    /**
     * Get story statistics
     */
    async getStoryStats(userId) {
        try {
            const stats = await storyStore.getStoryStats(userId);
            return {
                success: true,
                stats
            };
        } catch (error) {
            console.error('Error getting story stats:', error);
            throw error;
        }
    }

    /**
     * Get stories by user with pagination
     */
    async getUserStories(userId, options = {}) {
        try {
            const stories = await storyStore.getStoriesByUser(userId, options);
            return {
                success: true,
                stories,
                count: stories.length
            };
        } catch (error) {
            console.error('Error getting user stories:', error);
            throw error;
        }
    }
}

module.exports = new RAGService();
