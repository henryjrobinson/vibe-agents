const OpenAI = require('openai');

class StoryAggregator {
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        this.hasOpenAI = Boolean(apiKey);
        if (this.hasOpenAI) {
            this.openai = new OpenAI({
                apiKey
            });
        } else {
            this.openai = null;
            console.warn('OPENAI_API_KEY not set; StoryAggregator will use fallback generation for titles/summaries and skip embeddings.');
        }
    }

    /**
     * Aggregate memories into coherent stories
     * @param {Array} memories - Array of memory objects with payload data
     * @param {string} userId - User ID for story creation
     * @returns {Array} Array of story objects
     */
    async aggregateMemories(memories, userId) {
        if (!memories || memories.length === 0) return [];

        // Group memories by conversation and temporal proximity
        const groups = this.groupMemories(memories);
        
        const stories = [];
        for (const group of groups) {
            try {
                const story = await this.createStoryFromGroup(group, userId);
                if (story) stories.push(story);
            } catch (error) {
                console.error('Error creating story from group:', error);
            }
        }

        return stories;
    }

    /**
     * Group memories by conversation, people, and temporal proximity
     */
    groupMemories(memories) {
        const groups = [];
        const processed = new Set();

        for (const memory of memories) {
            if (processed.has(memory.id)) continue;

            const group = [memory];
            processed.add(memory.id);

            // Find related memories
            for (const otherMemory of memories) {
                if (processed.has(otherMemory.id)) continue;

                if (this.areMemoriesRelated(memory, otherMemory)) {
                    group.push(otherMemory);
                    processed.add(otherMemory.id);
                }
            }

            groups.push(group);
        }

        return groups;
    }

    /**
     * Check if two memories are related
     */
    areMemoriesRelated(memory1, memory2) {
        // Same conversation
        if (memory1.conversationId === memory2.conversationId) return true;

        // Shared people
        const people1 = new Set(memory1.payload.people || []);
        const people2 = new Set(memory2.payload.people || []);
        const sharedPeople = [...people1].filter(p => people2.has(p));
        if (sharedPeople.length > 0) return true;

        // Shared places
        const places1 = new Set(memory1.payload.places || []);
        const places2 = new Set(memory2.payload.places || []);
        const sharedPlaces = [...places1].filter(p => places2.has(p));
        if (sharedPlaces.length > 0) return true;

        // Temporal proximity (within 7 days)
        const date1 = new Date(memory1.createdAt);
        const date2 = new Date(memory2.createdAt);
        const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 7) return true;

        return false;
    }

    /**
     * Create a coherent story from a group of memories
     */
    async createStoryFromGroup(memoryGroup, userId) {
        // Extract all entities from the group
        const allPeople = [...new Set(memoryGroup.flatMap(m => m.payload.people || []))];
        const allPlaces = [...new Set(memoryGroup.flatMap(m => m.payload.places || []))];
        const allDates = [...new Set(memoryGroup.flatMap(m => m.payload.dates || []))];
        const allEvents = [...new Set(memoryGroup.flatMap(m => m.payload.events || []))];
        const allRelationships = memoryGroup.flatMap(m => m.payload.relationships || []);

        // Create story content by combining memory extractions
        const storyContent = this.combineMemoryContent(memoryGroup);
        
        // Generate title and summary using LLM
        const { title, summary } = await this.generateTitleAndSummary(storyContent, allPeople, allEvents);

        // Generate embedding for the story
        const embedding = await this.generateEmbedding(storyContent + ' ' + summary);

        return {
            userId,
            title,
            content: storyContent,
            summary,
            embedding,
            people: allPeople,
            places: allPlaces,
            dates: allDates,
            events: allEvents,
            sourceMemoryIds: memoryGroup.map(m => m.id),
            conversationIds: [...new Set(memoryGroup.map(m => m.conversationId))]
        };
    }

    /**
     * Combine memory content into a coherent narrative
     */
    combineMemoryContent(memoryGroup) {
        const sections = [];

        // Sort by creation date
        const sortedMemories = memoryGroup.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        for (const memory of sortedMemories) {
            const payload = memory.payload;
            let section = '';

            if (payload.events && payload.events.length > 0) {
                section += `Events: ${payload.events.join(', ')}\n`;
            }

            if (payload.people && payload.people.length > 0) {
                section += `People involved: ${payload.people.join(', ')}\n`;
            }

            if (payload.places && payload.places.length > 0) {
                section += `Locations: ${payload.places.join(', ')}\n`;
            }

            if (payload.dates && payload.dates.length > 0) {
                section += `Time references: ${payload.dates.join(', ')}\n`;
            }

            if (payload.relationships && payload.relationships.length > 0) {
                const relationshipTexts = payload.relationships.map(r => 
                    `${r.from} is ${r.relation} of ${r.to}`
                );
                section += `Relationships: ${relationshipTexts.join(', ')}\n`;
            }

            if (section) {
                sections.push(section.trim());
            }
        }

        return sections.join('\n\n');
    }

    /**
     * Generate title and summary using LLM
     */
    async generateTitleAndSummary(content, people, events) {
        const prompt = `Based on the following story information, create a compelling title and brief summary:

Content:
${content}

Key People: ${people.join(', ')}
Key Events: ${events.join(', ')}

Please provide:
1. A compelling, descriptive title (max 60 characters)
2. A brief summary (max 200 characters)

Format as JSON: {"title": "...", "summary": "..."}`;

        // If OpenAI is not configured, return a sensible fallback immediately
        if (!this.hasOpenAI) {
            const mainPeople = people.slice(0, 2).join(' and ');
            const mainEvent = events[0] || 'life experiences';
            return {
                title: mainPeople ? `${mainPeople}: ${mainEvent}` : (mainEvent || 'Untitled Story'),
                summary: `A story involving ${people.join(', ')} and events including ${events.join(', ')}.`
            };
        }

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 150,
                temperature: 0.7
            });

            const result = JSON.parse(response.choices[0].message.content);
            return {
                title: result.title || 'Untitled Story',
                summary: result.summary || 'A story about life experiences.'
            };
        } catch (error) {
            console.error('Error generating title/summary:', error);
            
            // Fallback title generation
            const mainPeople = people.slice(0, 2).join(' and ');
            const mainEvent = events[0] || 'life experiences';
            
            return {
                title: mainPeople ? `${mainPeople}: ${mainEvent}` : mainEvent,
                summary: `A story involving ${people.join(', ')} and events including ${events.join(', ')}.`
            };
        }
    }

    /**
     * Generate embedding using OpenAI
     */
    async generateEmbedding(text) {
        // If OpenAI is not configured, skip embedding generation
        if (!this.hasOpenAI) return null;

        try {
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: text.substring(0, 8000) // Limit input length
            });

            return response.data[0].embedding;
        } catch (error) {
            console.error('Error generating embedding:', error);
            return null;
        }
    }
}

module.exports = new StoryAggregator();
