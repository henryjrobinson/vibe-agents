const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

class EnhancedStoryAggregator {
    constructor() {
        // OpenAI for embeddings
        const openaiKey = process.env.OPENAI_API_KEY;
        this.hasOpenAI = Boolean(openaiKey);
        if (this.hasOpenAI) {
            this.openai = new OpenAI({ apiKey: openaiKey });
        }

        // Anthropic for narrative generation
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        this.hasAnthropic = Boolean(anthropicKey);
        if (this.hasAnthropic) {
            this.anthropic = new Anthropic({ apiKey: anthropicKey });
        }
    }

    /**
     * Automatically detect and create stories from accumulated memories
     */
    async autoCreateStories(memories, userId) {
        if (!memories || memories.length === 0) return [];

        // Group memories by topic similarity
        const topicGroups = await this.groupMemoriesByTopic(memories);
        
        const stories = [];
        for (const group of topicGroups) {
            // Only create story if group has enough substance (3+ memories or significant events)
            if (group.memories.length >= 3 || this.hasSignificantEvents(group.memories)) {
                try {
                    const story = await this.createStoryFromMemories(group, userId);
                    if (story) stories.push(story);
                } catch (error) {
                    console.error('Error creating story:', error);
                }
            }
        }

        return stories;
    }

    /**
     * Group memories by topic using semantic similarity and entity overlap
     */
    async groupMemoriesByTopic(memories) {
        const groups = [];
        const processed = new Set();

        for (const memory of memories) {
            if (processed.has(memory.id)) continue;

            // Start a new topic group
            const group = {
                memories: [memory],
                primaryPeople: new Set(memory.payload?.people || []),
                primaryPlaces: new Set(memory.payload?.places || []),
                primaryEvents: new Set(memory.payload?.events || []),
                dateRange: this.extractDateRange([memory])
            };
            processed.add(memory.id);

            // Find related memories for this topic
            for (const otherMemory of memories) {
                if (processed.has(otherMemory.id)) continue;

                const similarity = this.calculateTopicSimilarity(group, otherMemory);
                if (similarity > 0.3) { // Lowered threshold for better grouping
                    group.memories.push(otherMemory);
                    processed.add(otherMemory.id);
                    
                    // Update group entities
                    (otherMemory.payload?.people || []).forEach(p => group.primaryPeople.add(p));
                    (otherMemory.payload?.places || []).forEach(p => group.primaryPlaces.add(p));
                    (otherMemory.payload?.events || []).forEach(e => group.primaryEvents.add(e));
                }
            }

            groups.push(group);
        }

        return groups;
    }

    /**
     * Calculate similarity between a topic group and a memory
     */
    calculateTopicSimilarity(group, memory) {
        const memoryPeople = new Set(memory.payload?.people || []);
        const memoryPlaces = new Set(memory.payload?.places || []);
        const memoryEvents = new Set(memory.payload?.events || []);

        // Calculate overlaps
        const peopleOverlap = this.setOverlap(group.primaryPeople, memoryPeople);
        const placesOverlap = this.setOverlap(group.primaryPlaces, memoryPlaces);
        const eventsOverlap = this.setOverlap(group.primaryEvents, memoryEvents);
        
        // Check for similar terms (Dad/father, etc.)
        const hasSimilarPeople = this.hasSimilarTerms(group.primaryPeople, memoryPeople);
        const hasSimilarEvents = this.hasSimilarTerms(group.primaryEvents, memoryEvents);

        // Weighted similarity score with bonus for similar terms
        let score = (peopleOverlap * 0.4) + (placesOverlap * 0.3) + (eventsOverlap * 0.3);
        if (hasSimilarPeople) score += 0.2;
        if (hasSimilarEvents) score += 0.2;
        
        return Math.min(1.0, score);
    }
    
    /**
     * Check if sets have similar terms (Dad/father, death/passed away, etc.)
     */
    hasSimilarTerms(set1, set2) {
        const similarityMap = {
            'dad': ['father', 'papa', 'pop'],
            'mom': ['mother', 'mama'],
            'death': ['passed away', 'died', 'passing', 'funeral'],
            'hospital': ['medical', 'clinic', 'mount sinai']
        };
        
        const terms1 = Array.from(set1).map(t => t.toLowerCase());
        const terms2 = Array.from(set2).map(t => t.toLowerCase());
        
        for (const term1 of terms1) {
            for (const term2 of terms2) {
                // Direct match or partial match
                if (term1.includes(term2) || term2.includes(term1)) return true;
                
                // Check similarity map
                for (const [key, values] of Object.entries(similarityMap)) {
                    if ((term1.includes(key) || values.some(v => term1.includes(v))) &&
                        (term2.includes(key) || values.some(v => term2.includes(v)))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Calculate Jaccard similarity between two sets
     */
    setOverlap(set1, set2) {
        if (set1.size === 0 && set2.size === 0) return 0;
        const intersection = [...set1].filter(x => set2.has(x)).length;
        const union = set1.size + set2.size - intersection;
        return union > 0 ? intersection / union : 0;
    }

    /**
     * Check if memories contain significant events worth creating a story
     */
    hasSignificantEvents(memories) {
        const significantKeywords = [
            'death', 'birth', 'wedding', 'marriage', 'divorce', 'moved', 'graduation',
            'accident', 'diagnosis', 'surgery', 'retirement', 'promotion', 'fired',
            'immigrated', 'emigrated', 'war', 'deployed', 'enlisted'
        ];

        for (const memory of memories) {
            const events = (memory.payload?.events || []).join(' ').toLowerCase();
            if (significantKeywords.some(keyword => events.includes(keyword))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Create a comprehensive story from a group of memories
     */
    async createStoryFromMemories(group, userId) {
        // Extract all entities
        const people = Array.from(group.primaryPeople);
        const places = Array.from(group.primaryPlaces);
        const events = Array.from(group.primaryEvents);
        const dates = this.extractAllDates(group.memories);
        const relationships = this.extractAllRelationships(group.memories);

        // Analyze tone and emotional content
        const { tone, emotionalTags } = await this.analyzeToneAndEmotion(group.memories);

        // Generate the narrative
        const narrative = await this.generateNarrative(group.memories, tone);

        // Generate title and summaries
        const { title, summary, briefSummary } = await this.generateTitleAndSummaries(
            narrative, people, places, events
        );

        // Calculate significance based on event importance and memory count
        const significanceRating = this.calculateSignificance(group.memories, events);

        // Generate embedding for semantic search
        const embedding = await this.generateEmbedding(narrative + ' ' + summary);

        return {
            userId,
            title,
            content: this.combineMemoryContent(group.memories), // Factual content
            narrative, // Rich narrative
            summary, // Longer summary for display
            brief_summary: briefSummary, // Very short summary for quick reference
            embedding,
            people,
            places,
            dates,
            events,
            relationships,
            emotional_tags: emotionalTags,
            tone,
            significance_rating: significanceRating,
            privacy_level: 'private',
            media_references: [],
            version: 1,
            is_complete: false,
            source_memory_ids: group.memories.map(m => m.id),
            conversation_ids: [...new Set(group.memories.map(m => m.conversationId))]
        };
    }

    /**
     * Analyze tone and emotional content of memories
     */
    async analyzeToneAndEmotion(memories) {
        if (!this.hasAnthropic) {
            return { tone: 'neutral', emotionalTags: [] };
        }

        const memoryTexts = memories.map(m => 
            JSON.stringify(m.payload || {})
        ).join('\n');

        const prompt = `Analyze the emotional tone and content of these memories:

${memoryTexts}

Determine:
1. Overall tone (one word): nostalgic, happy, sad, reflective, proud, anxious, excited, melancholic, grateful, bitter
2. Emotional tags (up to 3): joy, sadness, loss, achievement, fear, love, anger, regret, hope, nostalgia

Return as JSON: {"tone": "word", "emotionalTags": ["tag1", "tag2"]}`;

        try {
            const response = await this.anthropic.messages.create({
                model: 'claude-3-5-haiku-latest',
                max_tokens: 100,
                messages: [{ role: 'user', content: prompt }]
            });

            const result = JSON.parse(response.content[0].text);
            return {
                tone: result.tone || 'neutral',
                emotionalTags: result.emotionalTags || []
            };
        } catch (error) {
            console.error('Error analyzing tone:', error);
            return { tone: 'neutral', emotionalTags: [] };
        }
    }

    /**
     * Generate a rich narrative from memories
     */
    async generateNarrative(memories, tone) {
        if (!this.hasAnthropic) {
            return this.combineMemoryContent(memories);
        }

        const memoryContent = this.combineMemoryContent(memories);
        const toneGuidance = this.getToneGuidance(tone);

        const prompt = `Create a cohesive narrative from these memory fragments. ${toneGuidance}

Memory fragments:
${memoryContent}

Write a flowing narrative in first person that tells this story naturally, as if the person is recounting it to a loved one. Include emotional context and connections between events. Keep it authentic to how someone would actually tell this story.`;

        try {
            const response = await this.anthropic.messages.create({
                model: 'claude-3-5-haiku-latest',
                max_tokens: 800,
                messages: [{ role: 'user', content: prompt }]
            });

            return response.content[0].text;
        } catch (error) {
            console.error('Error generating narrative:', error);
            return memoryContent;
        }
    }

    /**
     * Get tone guidance for narrative generation
     */
    getToneGuidance(tone) {
        const toneGuides = {
            nostalgic: "Write with warm nostalgia, focusing on cherished memories and how things used to be.",
            happy: "Write with joy and celebration, emphasizing positive moments and achievements.",
            sad: "Write with gentle sadness, acknowledging loss while honoring memories.",
            reflective: "Write thoughtfully, considering lessons learned and personal growth.",
            proud: "Write with pride in accomplishments and milestones achieved.",
            melancholic: "Write with bittersweet emotion, acknowledging both joy and sorrow.",
            grateful: "Write with gratitude, appreciating people and experiences.",
            neutral: "Write factually but warmly, letting the events speak for themselves."
        };
        return toneGuides[tone] || toneGuides.neutral;
    }

    /**
     * Generate title and summaries
     */
    async generateTitleAndSummaries(narrative, people, places, events) {
        if (!this.hasAnthropic) {
            return this.generateFallbackTitleAndSummaries(people, places, events);
        }

        const prompt = `Based on this story narrative, create:
1. A compelling title (max 60 chars)
2. A full summary (max 200 chars) 
3. A very brief summary (max 50 chars) - like "Moving from Italy to New York"

Narrative:
${narrative.substring(0, 1000)}

Key people: ${people.slice(0, 3).join(', ')}
Key places: ${places.slice(0, 3).join(', ')}
Key events: ${events.slice(0, 3).join(', ')}

Return as JSON: {"title": "...", "summary": "...", "briefSummary": "..."}`;

        try {
            const response = await this.anthropic.messages.create({
                model: 'claude-3-5-haiku-latest',
                max_tokens: 150,
                messages: [{ role: 'user', content: prompt }]
            });

            const result = JSON.parse(response.content[0].text);
            return {
                title: result.title || 'Untitled Story',
                summary: result.summary || 'A personal story',
                briefSummary: result.briefSummary || result.title || 'A memory'
            };
        } catch (error) {
            console.error('Error generating summaries:', error);
            return this.generateFallbackTitleAndSummaries(people, places, events);
        }
    }

    /**
     * Fallback title and summary generation
     */
    generateFallbackTitleAndSummaries(people, places, events) {
        const mainPerson = people[0] || '';
        const mainPlace = places[0] || '';
        const mainEvent = events[0] || 'life events';

        let title = mainEvent;
        if (mainPerson) title = `${mainPerson} and ${mainEvent}`;
        
        const summary = `A story about ${people.join(', ')} involving ${events.join(', ')}`;
        const briefSummary = mainPlace ? `${mainEvent} in ${mainPlace}` : mainEvent;

        return { title, summary, briefSummary };
    }

    /**
     * Calculate story significance rating (1-5)
     */
    calculateSignificance(memories, events) {
        let score = 3; // Default middle significance

        // More memories = potentially more significant
        if (memories.length > 5) score++;
        if (memories.length > 10) score++;

        // Check for life-changing events
        const majorEvents = ['death', 'birth', 'wedding', 'moved', 'immigrated', 'war'];
        const eventText = events.join(' ').toLowerCase();
        if (majorEvents.some(e => eventText.includes(e))) {
            score = Math.min(5, score + 1);
        }

        return score;
    }

    /**
     * Extract all dates from memories
     */
    extractAllDates(memories) {
        const dates = new Set();
        memories.forEach(m => {
            (m.payload?.dates || []).forEach(d => dates.add(d));
        });
        return Array.from(dates);
    }

    /**
     * Extract all relationships from memories
     */
    extractAllRelationships(memories) {
        const relationships = [];
        const seen = new Set();

        memories.forEach(m => {
            (m.payload?.relationships || []).forEach(r => {
                const key = `${r.from}-${r.relation}-${r.to}`;
                if (!seen.has(key)) {
                    relationships.push(r);
                    seen.add(key);
                }
            });
        });

        return relationships;
    }

    /**
     * Extract date range from memories
     */
    extractDateRange(memories) {
        const dates = [];
        memories.forEach(m => {
            if (m.createdAt) dates.push(new Date(m.createdAt));
            (m.payload?.dates || []).forEach(d => {
                const parsed = this.parseDate(d);
                if (parsed) dates.push(parsed);
            });
        });

        if (dates.length === 0) return null;
        dates.sort((a, b) => a - b);
        return { start: dates[0], end: dates[dates.length - 1] };
    }

    /**
     * Parse various date formats
     */
    parseDate(dateStr) {
        // Try to parse year
        const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            return new Date(yearMatch[0]);
        }
        
        // Try standard date parse
        const parsed = new Date(dateStr);
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * Combine memory content (factual)
     */
    combineMemoryContent(memories) {
        const sections = [];
        const sorted = memories.sort((a, b) => 
            new Date(a.createdAt) - new Date(b.createdAt)
        );

        for (const memory of sorted) {
            const payload = memory.payload || {};
            let section = [];

            if (payload.events?.length > 0) {
                section.push(`Events: ${payload.events.join(', ')}`);
            }
            if (payload.people?.length > 0) {
                section.push(`People: ${payload.people.join(', ')}`);
            }
            if (payload.places?.length > 0) {
                section.push(`Places: ${payload.places.join(', ')}`);
            }
            if (payload.dates?.length > 0) {
                section.push(`When: ${payload.dates.join(', ')}`);
            }
            if (payload.relationships?.length > 0) {
                const rels = payload.relationships.map(r => 
                    `${r.from} is ${r.relation} of ${r.to}`
                );
                section.push(`Relationships: ${rels.join(', ')}`);
            }

            if (section.length > 0) {
                sections.push(section.join('\n'));
            }
        }

        return sections.join('\n\n');
    }

    /**
     * Generate embedding for semantic search
     */
    async generateEmbedding(text) {
        if (!this.hasOpenAI) return null;

        try {
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: text.substring(0, 8000)
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error('Error generating embedding:', error);
            return null;
        }
    }
}

module.exports = new EnhancedStoryAggregator();