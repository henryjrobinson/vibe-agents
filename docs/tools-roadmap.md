# Tools Architecture & Roadmap

## Current State
- Memory extraction refactored into a first-class tool: `memory_extractor`
  - Location: `server/tools/memoryExtractor.js`
  - Registry: `server/tools/index.js` (exports `tools`, `getTool`, `executeTool`)
  - Usage:
    - `/api/memory-keeper` → uses `executeTool('memory_extractor', ...)`
    - `/chat` → background extraction uses the tool (non-blocking SSE `memory` event)

## Near-Term Plan (Phase 2)
- Combined single LLM call for `/chat` with true streaming:
  - One Anthropic streaming request returns both:
    - `assistant_response` (stream tokens to client via SSE `token` events)
    - `memories` (strict JSON) → emit SSE `memory` event when parsed
  - Fallback if JSON parse fails: empty structure
  - Benefits: simpler control flow on client, lower latency vs two calls

## Future Tools (Scaffolds in registry)
1. render_scene (Rendering Tool)
   - Purpose: Render a visual scene for the memory (e.g., 1950s snowball fight)
   - Input: `{ prompt, style?, aspectRatio? }`
   - Output: `{ imageUrl, provider, meta }`
   - Providers: Midjourney-compatible API (or alternative image gen provider)
   - Notes: Requires API key, rate limits, content safety filters

2. search_photos (Google Photos Search)
   - Purpose: Find matching photos for people/places mentioned
   - Input: `{ query?, people?, places?, timeRange? }`
   - Output: `{ results: [{ id, thumbnailUrl, mediaUrl, timestamp, people, places }] }`
   - Auth: OAuth 2.0 (offline token), per-user consent
   - Notes: Careful with PII, caching, and quota management

## Security & Governance
- Centralized validation: all tools define `inputSchema`; runtime validation before `run`
- Rate limiting per tool (middleware hook)
- Observability: structured logs per tool invocation (success/failure, latency)
- Feature flags: enable tools per environment or cohort

## API Contract
- Server-side executor: `executeTool(name, input, context)`
- Context contains per-request clients/keys (e.g., `anthropic`, provider SDKs)
- Tools return JSON-safe objects; errors are caught and reported without leaking secrets

## Incremental Rollout
1. Done: Toolize memory extractor and adopt in `/chat` + `/api/memory-keeper`
2. Next: Combined streaming `/chat` (single call + SSE events)
3. Implement `render_scene` (pick provider, add env/config, error handling)
4. Implement `search_photos` (OAuth flow, secure storage, scopes, UI hooks)
5. Add client UI affordances (render carousel, photo picker)

## Configuration
- Env vars (examples):
  - `ANTHROPIC_API_KEY`
  - `RENDER_PROVIDER=midjourney` (placeholder)
  - `RENDER_API_KEY`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

## Testing Strategy
- Unit: Tool `run()` with mocked SDKs
- Integration: `/api/memory-keeper` and `/chat` SSE flow with tool executor
- E2E: User sends story → assistant reply streams → memory SSE event appears → optional rendering/photos tool triggers

## Open Questions
- Rendering provider selection and cost controls
- Photo privacy and consent UX for Google Photos
- Tool invocation policy (automatic vs user-confirmed)
