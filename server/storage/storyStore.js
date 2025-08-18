const database = require('../database');

class StoryStore {
    constructor() {
        this.db = database;
    }

    /**
     * Save a story to the database
     */
    async saveStory(story) {
        try {
            const result = await this.db.pool.query(`
                INSERT INTO stories (
                    user_id, title, content, summary, embedding, 
                    people, places, dates, events, 
                    source_memory_ids, conversation_ids
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id, created_at
            `, [
                story.userId,
                story.title,
                story.content,
                story.summary,
                story.embedding ? JSON.stringify(story.embedding) : null,
                story.people || [],
                story.places || [],
                story.dates || [],
                story.events || [],
                story.sourceMemoryIds || [],
                story.conversationIds || []
            ]);

            return {
                id: result.rows[0].id,
                ...story,
                createdAt: result.rows[0].created_at
            };
        } catch (error) {
            console.error('Error saving story:', error);
            throw error;
        }
    }

    /**
     * Search stories using semantic similarity
     */
    async searchStories(userId, query, options = {}) {
        const {
            limit = 10,
            threshold = 0.7,
            people = [],
            places = [],
            events = []
        } = options;

        try {
            let whereClause = 'WHERE user_id = $1';
            let params = [userId];
            let paramIndex = 2;

            // Add filters
            if (people.length > 0) {
                whereClause += ` AND people && $${paramIndex}`;
                params.push(people);
                paramIndex++;
            }

            if (places.length > 0) {
                whereClause += ` AND places && $${paramIndex}`;
                params.push(places);
                paramIndex++;
            }

            if (events.length > 0) {
                whereClause += ` AND events && $${paramIndex}`;
                params.push(events);
                paramIndex++;
            }

            // If we have a query embedding, use semantic search
            if (query && typeof query === 'object' && query.embedding) {
                const searchQuery = `
                    SELECT 
                        id, title, content, summary, people, places, dates, events,
                        source_memory_ids, conversation_ids, created_at, updated_at,
                        1 - (embedding <=> $${paramIndex}) as similarity
                    FROM stories 
                    ${whereClause}
                    AND embedding IS NOT NULL
                    AND 1 - (embedding <=> $${paramIndex}) > $${paramIndex + 1}
                    ORDER BY similarity DESC
                    LIMIT $${paramIndex + 2}
                `;
                
                params.push(JSON.stringify(query.embedding), threshold, limit);
                
                const result = await this.db.pool.query(searchQuery, params);
                return result.rows;
            } else {
                // Fallback to text search
                const searchQuery = `
                    SELECT 
                        id, title, content, summary, people, places, dates, events,
                        source_memory_ids, conversation_ids, created_at, updated_at,
                        ts_rank(to_tsvector('english', title || ' ' || content || ' ' || summary), plainto_tsquery('english', $${paramIndex})) as rank
                    FROM stories 
                    ${whereClause}
                    AND (
                        to_tsvector('english', title || ' ' || content || ' ' || summary) @@ plainto_tsquery('english', $${paramIndex})
                        OR title ILIKE $${paramIndex + 1}
                        OR content ILIKE $${paramIndex + 1}
                    )
                    ORDER BY rank DESC
                    LIMIT $${paramIndex + 2}
                `;
                
                params.push(query, `%${query}%`, limit);
                
                const result = await this.db.pool.query(searchQuery, params);
                return result.rows;
            }
        } catch (error) {
            console.error('Error searching stories:', error);
            throw error;
        }
    }

    /**
     * Get stories by user with pagination
     */
    async getStoriesByUser(userId, options = {}) {
        const { limit = 20, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = options;

        try {
            const result = await this.db.pool.query(`
                SELECT 
                    id, title, content, summary, people, places, dates, events,
                    source_memory_ids, conversation_ids, created_at, updated_at
                FROM stories 
                WHERE user_id = $1
                ORDER BY ${sortBy} ${sortOrder}
                LIMIT $2 OFFSET $3
            `, [userId, limit, offset]);

            return result.rows;
        } catch (error) {
            console.error('Error getting stories by user:', error);
            throw error;
        }
    }

    /**
     * Get a single story by ID
     */
    async getStoryById(storyId, userId) {
        try {
            const result = await this.db.pool.query(`
                SELECT 
                    id, title, content, summary, people, places, dates, events,
                    source_memory_ids, conversation_ids, created_at, updated_at
                FROM stories 
                WHERE id = $1 AND user_id = $2
            `, [storyId, userId]);

            return result.rows[0] || null;
        } catch (error) {
            console.error('Error getting story by ID:', error);
            throw error;
        }
    }

    /**
     * Update a story
     */
    async updateStory(storyId, userId, updates) {
        try {
            const setClause = [];
            const params = [];
            let paramIndex = 1;

            // Build dynamic update query
            Object.keys(updates).forEach(key => {
                if (key === 'embedding' && updates[key]) {
                    setClause.push(`${key} = $${paramIndex}`);
                    params.push(JSON.stringify(updates[key]));
                } else if (updates[key] !== undefined) {
                    setClause.push(`${key} = $${paramIndex}`);
                    params.push(updates[key]);
                }
                paramIndex++;
            });

            if (setClause.length === 0) return null;

            setClause.push(`updated_at = NOW()`);
            params.push(storyId, userId);

            const result = await this.db.pool.query(`
                UPDATE stories 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
                RETURNING id, title, content, summary, people, places, dates, events,
                         source_memory_ids, conversation_ids, created_at, updated_at
            `, params);

            return result.rows[0] || null;
        } catch (error) {
            console.error('Error updating story:', error);
            throw error;
        }
    }

    /**
     * Delete a story
     */
    async deleteStory(storyId, userId) {
        try {
            const result = await this.db.pool.query(`
                DELETE FROM stories 
                WHERE id = $1 AND user_id = $2
                RETURNING id
            `, [storyId, userId]);

            return result.rows.length > 0;
        } catch (error) {
            console.error('Error deleting story:', error);
            throw error;
        }
    }

    /**
     * Get story statistics for a user
     */
    async getStoryStats(userId) {
        try {
            const result = await this.db.pool.query(`
                SELECT 
                    COUNT(*) as total_stories,
                    COUNT(DISTINCT unnest(people)) as unique_people,
                    COUNT(DISTINCT unnest(places)) as unique_places,
                    COUNT(DISTINCT unnest(events)) as unique_events,
                    MIN(created_at) as first_story,
                    MAX(created_at) as latest_story
                FROM stories 
                WHERE user_id = $1
            `, [userId]);

            return result.rows[0];
        } catch (error) {
            console.error('Error getting story stats:', error);
            throw error;
        }
    }
}

module.exports = new StoryStore();
