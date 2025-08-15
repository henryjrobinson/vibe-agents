---
description: Project Plan (Demo → Next)
---

# Project Plan

## Milestone A — Switch fully to Render (current)
- Single Render Web Service serves both frontend (static via `express.static('.')`) and backend API
- Backend: SSE `POST /chat`, background Memory Keeper, `/events`, `/healthz`
- Streaming from Collaborator; memory updates async (non-blocking)
- Anthropic SDK integration, timeouts/retries, basic rate limiting
- In-memory persistence; structured logging
- Render deployment: `render.yaml`, `npm start`, set env vars in Render dashboard (ANTHROPIC_API_KEY, SESSION_SECRET)
- Security: tighten Helmet CSP to remove `unsafe-inline`; align with production posture

## Milestone B — Hardening
- Postgres for conversations/messages/memories
- BullMQ/Redis for durable background jobs
- Auth (basic session/JWT)
- Metrics dashboard (TTFB, tokens/sec, error rates)

## Milestone C — Frontend modernization
- Migrate UI to React + Vite + TypeScript (client-only app hitting Render API)
- Native SSE consumption hooks and typed API client
- Componentize memory panels and chat stream
- Reuse current UX and accessibility patterns

## Milestone D — Agentic expansion
- Tool catalog; planner/supervisor
- Additional agents (retrieval, enrichment)
- Long-running tasks via workers

## Environment Variables (demo)
```
ANTHROPIC_API_KEY=
PORT=3000
NODE_ENV=production
# Omit CORS_ORIGIN for same-origin (Render serves frontend + API)
# If splitting hosting in the future, set CORS_ORIGIN to allowed origins
```

## Risks
- LLM latency variance → streaming mitigates
- Provider limits → rate limits + idempotency keys
- Infra drift → managed via `render.yaml` and docs

## Milestone E — SSE & Memory Tool Improvements (Post-Testing)

### Phase 1: Observability & Correlation (Medium Priority)
- **Include messageId in UI logs**: Add messageId to logging panel entries for better request-response correlation tracking
- **Echo request metadata**: Include conversationId and messageId in /api/memory-keeper JSON response for round-trip confirmation
- **Enhanced SSE logging**: Add connection state, reconnection attempts, and event correlation metrics to debug panel

### Phase 2: Relationship Intelligence (High Priority) ✅ COMPLETED
- ✅ **Eliminate relationship duplicates**: Implement deduplication logic for relationships (e.g., "John-Mary (father-daughter)" vs "Mary-John (daughter-father)")
- ✅ **Enhance family tree inference**: Improve relationship extraction to build complete family webs from conversational fragments
- ✅ **Relationship normalization**: Standardize relationship types (parent/child, spouse, sibling, aunt/uncle/cousin, etc.)
- ✅ **Bidirectional relationship mapping**: Automatically infer reciprocal relationships (if A is B's father, then B is A's child)
- ✅ **Multi-generational connection**: Connect people across generations using relationship chains

### Phase 3: Performance & Architecture (Low Priority)
- **Streaming collaborator**: Replace /api/collaborator REST calls with /chat SSE streaming for reduced latency
- **Memory extraction optimization**: Consider combining collaborator + memory extraction into single LLM call
- **Client-side caching**: Cache extracted memories to reduce redundant processing

### Phase 4: Advanced Memory Features (Future)
- **Memory editing**: Allow users to correct or enhance extracted memories through UI
- **Memory search**: Full-text search across extracted memories and conversations
- **Export enhancements**: Rich export formats (PDF, family tree diagrams, timeline views)
- **Memory validation**: Cross-reference extracted information for consistency

## Milestone F — Authentication & User Persistence (High Priority)

### Phase 1: Model Testing & Optimization
- **Claude model comparison**: Test different Claude models (3.5 Haiku vs 3.5 Sonnet) for memory extraction quality and performance
- **Prompt optimization**: A/B test different prompts to improve relationship inference and data extraction accuracy
- **Performance benchmarking**: Measure extraction quality, response time, and token usage across models

### Phase 2: Firebase Authentication Integration
- **Firebase setup**: Configure Firebase project with email/password authentication
- **Frontend auth UI**: Add login/signup forms with email verification
- **Session management**: Implement secure session handling with Firebase tokens
- **Protected routes**: Ensure chat interface requires authentication

### Phase 3: User-Based Data Persistence
- **Database schema update**: Add userId as primary key for conversations, messages, and memories
- **User isolation**: Ensure all data operations are scoped to authenticated user
- **Migration strategy**: Plan for existing anonymous data (if any) to be preserved or migrated
- **Data export**: Allow users to export their personal story collections and memories

### Phase 4: Planning Consolidation
- **Merge planning documents**: Consolidate plan.md, project-plan.md, react-frontend-plan.md, and agent_story_prd.md
- **Remove duplicates**: Eliminate redundant planning fragments across the codebase
- **Single source of truth**: Create unified project roadmap with clear priorities and status tracking

## Status
- ✅ SSE integration and memory tool correlation fully functional
- ✅ End-to-end testing completed successfully
- 🔄 Next: Improve relationship extraction and family tree building
- Hosting topology decided: Render serves frontend + API
