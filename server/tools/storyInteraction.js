const storyStore = require('../storage/storyStore');
const database = require('../database');
const OpenAI = require('openai');

/**
 * Tool for the Collaborator agent to search, retrieve, and interact with stories
 */
class StoryInteraction {
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        this.hasOpenAI = Boolean(apiKey);
        if (this.hasOpenAI) {
            this.openai = new OpenAI({ apiKey });
        }
    }

    /**
     * Search for stories based on user's message
     * Returns brief summaries for agent to present
     */
    async searchUserStories(userId, userMessage, limit = 3) {
        try {
            // Generate embedding for semantic search
            let embedding = null;
            if (this.hasOpenAI) {
                const embResponse = await this.openai.embeddings.create({
                    model: 'text-embedding-ada-002',
                    input: userMessage.substring(0, 8000)
                });
                embedding = embResponse.data[0].embedding;
            }

            // Search with both semantic and text matching
            const searchQuery = embedding ? { text: userMessage, embedding } : userMessage;
            const stories = await storyStore.searchStories(userId, searchQuery, { limit });

            // Format results for agent
            if (stories.length === 0) {
                return {
                    found: false,
                    message: "I couldn't find any stories about that. Would you like to tell me about it so I can create a new story?",
                    stories: []
                };
            }

            // Update access stats
            for (const story of stories) {
                await this.updateStoryAccess(story.id, userId);
            }

            return {
                found: true,
                stories: stories.map(s => ({
                    id: s.id,
                    briefSummary: s.brief_summary || s.title,
                    title: s.title,
                    significance: s.significance_rating,
                    tone: s.tone,
                    people: s.people?.slice(0, 3),
                    dates: s.dates?.slice(0, 2)
                })),
                suggestedResponse: this.generateSuggestedResponse(stories)
            };
        } catch (error) {
            console.error('Error searching stories:', error);
            return {
                found: false,
                error: true,
                message: "I had trouble searching for stories. Could you tell me more about what you're looking for?"
            };
        }
    }

    /**
     * Generate suggested response for agent based on found stories
     */
    generateSuggestedResponse(stories) {
        if (stories.length === 1) {
            const story = stories[0];
            return `I found your story about "${story.brief_summary || story.title}". Would you like me to tell you this story, or would you like to add more details to it?`;
        } else {
            const summaries = stories.slice(0, 3).map(s => 
                `• ${s.brief_summary || s.title}`
            ).join('\n');
            return `I found ${stories.length} related stories:\n${summaries}\n\nWhich one would you like to explore, or shall I tell you about all of them?`;
        }
    }

    /**
     * Retrieve full story for reliving/retelling
     */
    async getStoryForRetelling(storyId, userId) {
        try {
            const story = await storyStore.getStoryById(storyId, userId);
            if (!story) {
                return {
                    success: false,
                    message: "I couldn't find that story."
                };
            }

            // Update access stats
            await this.updateStoryAccess(storyId, userId);

            return {
                success: true,
                story: {
                    id: story.id,
                    title: story.title,
                    narrative: story.narrative || story.content,
                    tone: story.tone,
                    emotionalTags: story.emotional_tags,
                    people: story.people,
                    places: story.places,
                    dates: story.dates,
                    events: story.events,
                    mediaReferences: story.media_references
                }
            };
        } catch (error) {
            console.error('Error retrieving story:', error);
            return {
                success: false,
                message: "I had trouble retrieving that story."
            };
        }
    }

    /**
     * Add new information to an existing story
     */
    async appendToStory(storyId, userId, newInformation, checkContradictions = true) {
        try {
            const story = await storyStore.getStoryById(storyId, userId);
            if (!story) {
                return {
                    success: false,
                    message: "I couldn't find that story to update."
                };
            }

            // Check for contradictions if enabled
            if (checkContradictions) {
                const contradictions = await this.detectContradictions(story, newInformation);
                if (contradictions.length > 0) {
                    return {
                        success: false,
                        needsClarification: true,
                        contradictions,
                        message: this.formatContradictionMessage(contradictions)
                    };
                }
            }

            // Append to narrative
            const updatedNarrative = await this.appendNarrative(
                story.narrative || story.content, 
                newInformation,
                story.tone
            );

            // Extract new entities from the information
            const newEntities = await this.extractEntitiesFromText(newInformation);

            // Merge entities
            const updatedPeople = [...new Set([...story.people, ...newEntities.people])];
            const updatedPlaces = [...new Set([...story.places, ...newEntities.places])];
            const updatedEvents = [...new Set([...story.events, ...newEntities.events])];
            const updatedDates = [...new Set([...story.dates, ...newEntities.dates])];

            // Update the story
            const updates = {
                narrative: updatedNarrative,
                people: updatedPeople,
                places: updatedPlaces,
                events: updatedEvents,
                dates: updatedDates,
                version: (story.version || 1) + 1
            };

            const updatedStory = await storyStore.updateStory(storyId, userId, updates);

            // Save version history
            await this.saveStoryVersion(storyId, story, 'append', 
                `Added new information: ${newInformation.substring(0, 100)}...`);

            return {
                success: true,
                message: "I've added that information to your story.",
                story: updatedStory
            };
        } catch (error) {
            console.error('Error appending to story:', error);
            return {
                success: false,
                message: "I had trouble updating that story."
            };
        }
    }

    /**
     * Detect contradictions between existing story and new information
     */
    async detectContradictions(story, newInformation) {
        const contradictions = [];

        // Extract entities from new information
        const newEntities = await this.extractEntitiesFromText(newInformation);

        // Check date contradictions
        for (const newDate of newEntities.dates) {
            for (const existingDate of story.dates || []) {
                if (this.areDatesContradictory(existingDate, newDate)) {
                    contradictions.push({
                        type: 'date',
                        original: existingDate,
                        new: newDate,
                        message: `The story mentions ${existingDate}, but you just said ${newDate}`
                    });
                }
            }
        }

        // More sophisticated contradiction detection could be added here
        // For now, keeping it simple with date conflicts

        return contradictions;
    }

    /**
     * Check if two dates are contradictory
     */
    areDatesContradictory(date1, date2) {
        // Simple check - if both mention the same event but different years
        const year1 = date1.match(/\b(19|20)\d{2}\b/);
        const year2 = date2.match(/\b(19|20)\d{2}\b/);
        
        if (year1 && year2 && year1[0] !== year2[0]) {
            // Check if they're talking about the same thing
            const words1 = date1.toLowerCase().split(/\s+/);
            const words2 = date2.toLowerCase().split(/\s+/);
            const commonWords = words1.filter(w => words2.includes(w) && w.length > 3);
            
            return commonWords.length > 0;
        }
        
        return false;
    }

    /**
     * Format contradiction message for user
     */
    formatContradictionMessage(contradictions) {
        const messages = contradictions.map(c => c.message);
        return `I noticed some details that might need clarification:\n${messages.join('\n')}\n\nCould you help me understand which is correct?`;
    }

    /**
     * Append new information to existing narrative
     */
    async appendNarrative(existingNarrative, newInfo, tone) {
        if (!this.hasOpenAI) {
            return `${existingNarrative}\n\n${newInfo}`;
        }

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{
                    role: 'user',
                    content: `Seamlessly integrate this new information into the existing narrative. Maintain the ${tone || 'same'} tone.

Existing narrative:
${existingNarrative}

New information to add:
${newInfo}

Return the complete updated narrative with the new information naturally woven in.`
                }],
                max_tokens: 1000,
                temperature: 0.7
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Error appending narrative:', error);
            return `${existingNarrative}\n\n${newInfo}`;
        }
    }

    /**
     * Extract entities from text
     */
    async extractEntitiesFromText(text) {
        if (!this.hasOpenAI) {
            return { people: [], places: [], events: [], dates: [] };
        }

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{
                    role: 'user',
                    content: `Extract entities from: "${text}"
Return JSON: {"people": [], "places": [], "events": [], "dates": []}`
                }],
                max_tokens: 200,
                temperature: 0.3
            });

            return JSON.parse(response.choices[0].message.content);
        } catch (error) {
            console.error('Error extracting entities:', error);
            return { people: [], places: [], events: [], dates: [] };
        }
    }

    /**
     * Update story access statistics
     */
    async updateStoryAccess(storyId, userId) {
        try {
            await database.pool.query(`
                UPDATE stories 
                SET last_accessed_at = NOW(), 
                    access_count = COALESCE(access_count, 0) + 1
                WHERE id = $1 AND user_id = $2
            `, [storyId, userId]);
        } catch (error) {
            console.error('Error updating story access:', error);
        }
    }

    /**
     * Save story version for history tracking
     */
    async saveStoryVersion(storyId, previousStory, changeType, changeSummary) {
        try {
            const versionNumber = (previousStory.version || 1);
            await database.pool.query(`
                INSERT INTO story_versions 
                (story_id, version_number, content, narrative, change_type, change_summary)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                storyId,
                versionNumber,
                previousStory.content,
                previousStory.narrative,
                changeType,
                changeSummary
            ]);
        } catch (error) {
            console.error('Error saving story version:', error);
        }
    }

    /**
     * Create a new story from user input
     */
    async createStoryFromConversation(userId, title, content, entities) {
        try {
            // This would be called when user wants to create a new story
            // The memory extractor would have already pulled out entities
            
            const story = {
                userId,
                title,
                content,
                narrative: content, // Will be enhanced later
                brief_summary: title.substring(0, 50),
                summary: content.substring(0, 200),
                people: entities.people || [],
                places: entities.places || [],
                dates: entities.dates || [],
                events: entities.events || [],
                emotional_tags: [],
                tone: 'neutral',
                significance_rating: 3,
                privacy_level: 'private'
            };

            // Generate embedding if available
            if (this.hasOpenAI) {
                const embResponse = await this.openai.embeddings.create({
                    model: 'text-embedding-ada-002',
                    input: (content + ' ' + title).substring(0, 8000)
                });
                story.embedding = embResponse.data[0].embedding;
            }

            const savedStory = await storyStore.saveStory(story);
            
            return {
                success: true,
                message: `I've created a new story: "${title}"`,
                storyId: savedStory.id
            };
        } catch (error) {
            console.error('Error creating story:', error);
            return {
                success: false,
                message: "I had trouble creating that story."
            };
        }
    }
}

module.exports = new StoryInteraction();