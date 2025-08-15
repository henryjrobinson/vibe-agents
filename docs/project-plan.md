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

## Status
- Hosting topology decided: Render serves frontend + API
- Next: deploy service on Render, set env vars, verify `/`, `/api/*`, `/chat`, `/events`
