---
description: Agents and Tools (Collaborator + Memory Keeper)
---

# Agents

## Collaborator (single agent)
- Role: empathetic conversational guide for elderly users
- Behaviors:
  - Stream tokens immediately to client via SSE
  - Focus purely on empathetic conversation and story gathering
  - Keep responses concise and friendly for elderly users
  - Does NOT directly call tools - tools run independently
- Model: Claude 3.5 (Haiku/Sonnet based on performance requirements)
- System Prompt: Extensive prompt focused on warmth, validation, and memory encouragement

## Tool: memory_extractor
- Purpose: extract structured memory objects from user messages
- Invocation: **Automatic background process** - runs on every user message in parallel with Collaborator
- Model: Claude 3.5 Haiku (fast extraction)
- Output schema (actual implementation):
```json
{
  "narrator": "Henry Robinson",
  "people": ["John", "Mary"],
  "dates": ["1972", "in the summer"],
  "places": ["Queens, NY", "Chicago"],
  "relationships": [{"from": "John", "to": "narrator", "relation": "brother"}],
  "events": ["wedding", "family reunion"]
}
```
- Validation: server validates outputs; non-conforming results are discarded
- Persistence: encrypted storage in PostgreSQL with integrity checking

## Tool: story_manager
- Purpose: search, retrieve, and manage user stories about life events
- Actions supported: `search`, `retrieve`, `append`, `create`
- Integration: works with `storyInteraction.js` and `storyStore.js`
- Features:
  - Semantic search using OpenAI embeddings
  - Story versioning and contradiction detection
  - Entity extraction and merging

## Architecture Pattern: Separation of Concerns

The system uses **parallel processing** rather than agent-to-agent communication:

1. **User sends message** → `POST /chat`
2. **Two parallel processes start:**
   - Collaborator generates empathetic response (streams via SSE)
   - Memory Keeper extracts entities (runs in background)
3. **Results delivered independently:**
   - Chat tokens stream immediately
   - Memory updates broadcast via SSE when ready

This avoids the complexity of agents calling other agents while maintaining real-time responsiveness.

## API Endpoints

### Main Chat (SSE Streaming)
- `POST /chat` - Collaborative chat with background memory extraction
- `GET /events` - SSE channel for memory updates

### Direct Agent Access
- `POST /api/collaborator` - Direct collaborator endpoint
- `POST /api/memory-keeper` - Direct memory extraction endpoint

### Story Management
- `POST /api/stories/process` - Process memories into stories (requires RAG integration)
- Story manager tool available via `story_manager` tool calls

## Prompts (locations)
- Collaborator system prompt: `server.js:220-267` (comprehensive empathy-focused prompt)
- Memory extractor prompt: `server/tools/memoryExtractor.js:3-35`
- Tool schemas: defined in respective tool files

## Persistence (Current Implementation)
- **PostgreSQL with pgvector**: Full database implementation with encryption
- **User isolation**: All data scoped by Firebase UID
- **Memory storage**: `encrypted_memories` table with AES-256-CBC encryption
- **Story storage**: `stories` table with vector embeddings for semantic search
- **Audit logging**: All actions tracked in `audit_logs` table

## Authentication & Security
- **Firebase Authentication**: Required for all endpoints
- **Rate limiting**: Applied to all API routes
- **CORS protection**: Configurable origin allowlist
- **Data encryption**: Optional AES-256-CBC for sensitive payloads
- **User data isolation**: Strict user_id filtering on all queries
