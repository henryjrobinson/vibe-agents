---
description: Product Requirements Document (Demo/Prototype)
---

# Story Collection PRD (Demo/Prototype)

## 1. Problem & Audience
- Elderly users want to share life stories; families want structured memories.
- Current app suffers from slow responses and timeouts.

## 2. Goal (Demo)
- Deliver a performant prototype that streams collaborator responses in real time while extracting structured memories in the background.

## 3. Scope (MVP)
- Frontend: Vanilla JS UI (existing).
- Backend: Node service on Render (always-on).
- LLM: Anthropic via official Node SDK.
- Streaming: SSE for collaborator tokens.
- Tool: Memory Keeper runs as a tool-like background job; emits SSE updates.
- Persistence: In-memory (demo) with easy path to Postgres later.

## 4. Non-Goals (for demo)
- Full auth/accounts, multi-tenant privacy.
- Durable jobs/queues, distributed tracing.
- Multi-agent orchestration beyond collaborator + extractor tool.

## 5. Success Metrics
- Time-to-first-token (TTFB) < 400ms on warm backend.
- Full response stream latency 1–3s typical.
- Memory extraction completes < 5s and appears asynchronously.
- Zero visible timeouts during demo flow.

## 6. Key User Journeys
- Start session → Type message → See tokens stream immediately → Memory objects appear a bit later → Continue conversation → Export JSON (optional).

## 7. Risks & Mitigations
- Cold starts: avoided by Render (always-on).
- Long LLM calls: set timeouts, reduce max tokens, retries.
- Streaming buffering: validate headers, use SSE.
- Vendor limits: per-user rate limiting and idempotency keys.

## 8. Future (Post-Demo)
- Next.js frontend, user accounts, Postgres, BullMQ/Redis, multi-agent flows, RAG connectors, analytics.
