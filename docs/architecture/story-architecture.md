# Story System Architecture and Delivery Phases

## 1) Context & Goals (JTBD)
- __Job__: Help families capture, organize, and retrieve life stories with minimal effort.
- __Desired outcomes__: Accurate story extraction, fast retrieval, emotionally resonant conversations.
- __Alternatives__: Raw chat logs, manual notes, generic note apps without semantic retrieval.
- __Differentiator__: Agent-assisted extraction + story aggregation + semantic search scoped per user.
- __Success__: <2s perceived latency for replies; relevant stories retrieved >80% of the time.

## 2) System Overview
```
User → Collaborator (Anthropic) + Memory Keeper (background) → Memory Store
      → RAG Pipeline: Aggregation (OpenAI) → Embeddings (pgvector) → Story Store
      → Retrieval for Agents (RAG Client) → Context-augmented responses
```

- __Memory extraction__: `server/tools/memoryExtractor.js` (invoked via `executeTool()`)
- __RAG aggregation__: `server/tools/storyAggregator.js`
- __RAG orchestration__: `server/tools/ragService.js`
- __Vector storage & search__: PostgreSQL + pgvector via `server/database/index.js` and `server/storage/storyStore.js`
- __API gateways__: `server.js` endpoints under `/api/stories/*`, `/api/memory-keeper`, `/chat`
- __Agent integration__: `server/tools/ragClient.js`
- __Auth__: Firebase (`server/middleware/auth.js`), all endpoints gated
- __Privacy__: Optional encryption for payloads in DB via `server/database/index.js`

## 3) Domain Model (simplified)
- __Memory__ (extracted): people, places, dates, events, relationships; references `conversationId`, `userId`.
- __Story__: aggregated narrative derived from related memories, with `title`, `summary`, `content`, `embedding`, entities arrays; references source memory IDs and conversation IDs.
- __User__: Firebase UID mapped to internal `users.id` (`firebase_uid` column).

See schema initialization in `server/database/index.js`:
- `stories` table with `embedding vector(1536)` and GIN/IVFFlat indexes
- `encrypted_memories` for sensitive payload storage

## 4) Key Flows (mapped to code)
- __SSE Chat__: `POST /chat` in `server.js`
  - Streams Collaborator response (Anthropic)
  - Background Memory Keeper extraction saves to memory store and emits SSE updates
- __Direct Memory Keeper__: `POST /api/memory-keeper`
  - Extracts entities, persists memory, emits SSE
- __Process to Stories__: `POST /api/stories/process`
  - `ragService.processMemoriesIntoStories()` → `storyAggregator.aggregateMemories()` → `storyStore.saveStory()`
- __Semantic Search__: `POST /api/stories/search`
  - `ragService.searchStories()` → `storyStore.searchStories()` (vector similarity or text fallback)
- __Relevant Context__: `POST /api/stories/relevant`
  - Entity extraction + semantic search for agent prompts
- __Agent Usage__: `ragClient.getEnrichedContext()` combines retrieval + formatting

## 5) Security & Privacy
- __Auth__: Firebase token verified (`verifyFirebaseToken`, `ensureUserScope`) on all RAG endpoints in `server.js`.
- __User isolation__: Queries include `user_id` filter; stories created with the authenticated `userId`.
- __Encryption__: `encrypted_memories.encrypted_payload` supported via AES-256-CBC in `server/database/index.js`.
- __Rate limiting__: `express-rate-limit` on `/api/*`.
- __CSP/CORS__: Locked down in `server.js` (Helmet + configurable CORS).

## 6) Performance Principles
- __Model selection__: default `claude-3-5-haiku-latest` for speed.
- __Parallelism__: Memory extraction runs in background for SSE; combine steps where possible.
- __Token discipline__: Lower `max_tokens` and prompt size for speed.
- __Indexes__: IVFFlat for vectors; GIN on entity arrays.
- __Cold start mitigation__: warming endpoint `/warm` and scheduler (prod only).

## 7) Delivery Phases & Milestones

### Phase 0 — Baseline Enablement (0.5 day)
- __Verify env__: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, Firebase vars, `DATABASE_URL`, `ENCRYPTION_KEY` (64 hex or encryption off).
- __DB__: Ensure pgvector extension and indexes created automatically by `initializeSchema()`.
- __Health__: `/api/health` returns Anthropic/OpenAI configured.
- __Doc__: Confirm `docs/rag-system.md` and this file as the source of truth.
- __Outcome__: Endpoints online, basic search working with existing data.

### Phase 1 — Latency Quick Wins (0.5–1 day)
- __Model__: Ensure Haiku by default; reduce `max_tokens` (Collaborator ≈300, Memory ≈300).
- __Prompt footprint__: Truncate history to last 3–4 turns; already implemented in `server.js`.
- __Timeouts__: Keep hard timeouts (20s) via `withTimeout()`; surface errors gracefully.
- __Perceived speed__: Stream collaborator tokens; background memory extraction continues.
- __Success__: Typical responses in 1.5–3.0s; no user-facing regressions.

### Phase 2 — Unified LLM Pass + Streaming (1–2 days)
- __Goal__: Eliminate sequential LLM calls by merging extraction + reply when using REST flow.
- __Approach__: Add combined endpoint (e.g., `/api/chat-combined`) that prompts Collaborator to emit both reply and a compact, machine-parsable memory payload. Persist memory post-parse.
- __SSE__: Maintain streaming; memory payload emitted on `done`.
- __Success__: 40–50% latency reduction for REST usage; SSE path retains current behavior.

### Phase 3 — Retrieval Quality & Controls (1–2 days)
- __Ranking__: Add diversity re-ranker (simple MMR) post pgvector result.
- __Filters__: Expose people/places/events/date slider on client; pass-through to `/api/stories/search`.
- __Entity extraction__: Switch `extractEntitiesFromContext()` to faster, more reliable model and structured tool output; add caching.
- __Success__: Higher precision@k; fewer irrelevant stories included in prompts.

### Phase 4 — Product UX & Analytics (1–2 days)
- __UI__: Story browser (list, filters, detail) and “context used” preview; add to `story-collection-react/`.
- __Instrumentation__: Log retrieval stats and prompt-size metrics; simple dashboards.
- __Success__: Users can browse/confirm stories; improved trust and transparency.

## 8) Technical Considerations & Risks
- __Embedding model__: Currently `text-embedding-ada-002` (1536d). Consider `text-embedding-3-small` for cost/quality tradeoff; update dim accordingly.
- __Type safety__: `storyStore.saveStory()` passes JSON string for vector input; valid for pgvector’s text input format. If switching drivers/ORM, confirm vector binding.
- __Memory source__: `ragService.getAllMemoriesForUser()` is a placeholder; implement against actual memory store when processing global backfills.
- __Index build__: IVFFlat requires `ANALYZE`/vacuum; ensure index build happens on non-empty tables or plan initial backfill step.

## 9) Acceptance Criteria
- __Stories__: Created via `/api/stories/process` with titles, summaries, embeddings.
- __Search__: `/api/stories/search` returns relevant results with entity filters.
- __Agent context__: `ragClient.getEnrichedContext()` yields formatted snippets used by Collaborator.
- __Security__: All endpoints require Firebase auth; user data isolation verified.
- __Performance__: P50 response <3s; warm path under typical load.

## 10) Next Steps
1. Execute Phase 0 checks and run a small end-to-end: extract → process → search.
2. Choose Phase 1–2 priorities (speed vs. consolidation).
3. If needed, implement `getAllMemoriesForUser(userId)` for whole-account processing/backfill.

---
References:
- RAG details: `docs/rag-system.md`
- Endpoints: `server.js` (`/api/stories/*`, `/api/memory-keeper`, `/chat`)
- Storage/DB: `server/storage/storyStore.js`, `server/database/index.js` (pgvector)
- RAG orchestration: `server/tools/ragService.js`
- Agent client: `server/tools/ragClient.js`
