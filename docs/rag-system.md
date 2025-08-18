# RAG System Documentation

## Overview

The RAG (Retrieval-Augmented Generation) system transforms your story collection app from simple memory storage into an intelligent knowledge base. It aggregates extracted memories into coherent stories, generates semantic embeddings, and provides powerful search capabilities for agents to access relevant context.

## Architecture

```
Memory Keeper → Story Aggregation → Vector Embeddings → Semantic Search → Agent Integration
```

### Components

1. **Story Aggregation Service** (`server/tools/storyAggregator.js`)
   - Groups related memories by conversation, people, places, and time
   - Creates coherent narratives from memory fragments
   - Generates titles and summaries using LLM

2. **Vector Storage** (PostgreSQL + pgvector)
   - Stores story embeddings for semantic search
   - Indexes people, places, events for filtering
   - Maintains user isolation and encryption

3. **RAG Service** (`server/tools/ragService.js`)
   - Processes memories into stories
   - Handles semantic search queries
   - Extracts entities for better retrieval

4. **RAG Client** (`server/tools/ragClient.js`)
   - Simple interface for agent integration
   - Formats stories for agent context
   - Provides specialized search methods

## Database Schema

The system extends your existing PostgreSQL database with:

```sql
CREATE TABLE stories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    embedding vector(1536),           -- OpenAI ada-002 embeddings
    people TEXT[],                    -- Array of people mentioned
    places TEXT[],                    -- Array of places mentioned
    dates TEXT[],                     -- Array of dates/time periods
    events TEXT[],                    -- Array of events
    source_memory_ids INTEGER[],      -- Original memory IDs
    conversation_ids INTEGER[],       -- Source conversations
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Endpoints

### Process Memories into Stories
```http
POST /api/stories/process
Content-Type: application/json
Authorization: Bearer <firebase-token>

{
  "conversationId": "optional-conversation-id"
}
```

### Search Stories
```http
POST /api/stories/search
Content-Type: application/json
Authorization: Bearer <firebase-token>

{
  "query": "childhood memories with grandmother",
  "limit": 10,
  "threshold": 0.7,
  "people": ["grandmother"],
  "places": ["farm"],
  "events": ["summer vacation"]
}
```

### Get Relevant Stories for Context
```http
POST /api/stories/relevant
Content-Type: application/json
Authorization: Bearer <firebase-token>

{
  "context": "Tell me about family traditions during holidays",
  "maxStories": 5
}
```

### List User Stories
```http
GET /api/stories?limit=20&offset=0&sortBy=created_at&sortOrder=DESC
Authorization: Bearer <firebase-token>
```

### Get Story Statistics
```http
GET /api/stories/stats
Authorization: Bearer <firebase-token>
```

## Agent Integration

### Using RAG Client

```javascript
const { createRAGClient } = require('./server/tools/ragClient');

// In your agent code
const ragClient = createRAGClient(userId);

// Search for relevant stories
const stories = await ragClient.searchStories("family traditions");

// Get context for current conversation
const context = await ragClient.getEnrichedContext(userMessage, conversationHistory);

// Format stories for agent prompt
const formattedContext = ragClient.formatStoriesForContext(stories, true);
```

### Enhanced Collaborator Agent

```javascript
// Example: Enhanced collaborator with RAG context
app.post('/api/collaborator-enhanced', verifyFirebaseToken, async (req, res) => {
    const { message, conversationHistory = [] } = req.body;
    const ragClient = createRAGClient(req.userId);
    
    // Get relevant story context
    const context = await ragClient.getEnrichedContext(message, conversationHistory);
    
    // Build enhanced prompt with story context
    let systemPrompt = COLLABORATOR_SYSTEM_PROMPT;
    if (context.hasRelevantStories) {
        systemPrompt += `\n\nRELEVANT FAMILY STORIES:\n${context.formattedContext}`;
    }
    
    const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }]
    });
    
    res.json({ response: response.content[0].text });
});
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install openai pgvector
```

### 2. Environment Variables
Add to your `.env` file:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Database Setup
The system automatically:
- Enables pgvector extension
- Creates stories table
- Sets up indexes for performance

### 4. Process Existing Memories
```javascript
// Process all existing memories into stories
const ragService = require('./server/tools/ragService');
await ragService.processMemoriesIntoStories(userId);
```

## Usage Examples

### 1. Basic Story Search
```javascript
const stories = await ragClient.searchStories("grandmother's cooking");
```

### 2. People-Specific Stories
```javascript
const stories = await ragClient.getStoriesAboutPeople(["John", "Mary"]);
```

### 3. Location-Based Stories
```javascript
const stories = await ragClient.getStoriesFromPlaces(["Chicago", "family farm"]);
```

### 4. Event-Based Stories
```javascript
const stories = await ragClient.getStoriesAboutEvents(["wedding", "graduation"]);
```

### 5. Enriched Agent Context
```javascript
const context = await ragClient.getEnrichedContext(
    "Tell me about family recipes",
    ["We were talking about holidays", "My grandmother was a great cook"]
);

if (context.hasRelevantStories) {
    console.log(`Found ${context.storyCount} relevant stories`);
    console.log(context.formattedContext);
}
```

## Performance Considerations

### Embedding Generation
- Uses OpenAI's `text-embedding-ada-002` (1536 dimensions)
- Processes stories up to 8000 characters
- Cached in PostgreSQL for fast retrieval

### Search Performance
- pgvector IVFFlat index for fast similarity search
- GIN indexes on people, places, events arrays
- Configurable similarity threshold (default: 0.7)

### Memory Usage
- Stories are aggregated from related memories
- Reduces storage compared to individual memory embeddings
- Maintains references to source memories

## Security

- **User Isolation**: All stories scoped to authenticated user
- **Encryption**: Inherits encryption from existing memory system
- **Authentication**: All endpoints require Firebase token
- **Rate Limiting**: Protected by existing rate limits

## Monitoring

### Story Statistics
```javascript
const stats = await ragClient.getStats();
// Returns: total_stories, unique_people, unique_places, unique_events, etc.
```

### Health Check
```http
GET /api/health
```
Returns OpenAI configuration status alongside existing checks.

## Troubleshooting

### Common Issues

1. **No embeddings generated**: Check OPENAI_API_KEY configuration
2. **pgvector not found**: Ensure PostgreSQL has pgvector extension installed
3. **Slow searches**: Check if indexes are created properly
4. **Empty search results**: Verify similarity threshold (try lowering from 0.7 to 0.5)

### Debug Mode
Set `NODE_ENV=development` for detailed error messages in API responses.

## Future Enhancements

- **Hybrid Search**: Combine semantic + keyword search
- **Story Clustering**: Group similar stories automatically  
- **Temporal Search**: Find stories from specific time periods
- **Relationship Mapping**: Visual family tree from story connections
- **Multi-modal**: Support for image and audio story content
