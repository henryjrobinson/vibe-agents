---
description: Project Plan (Demo → Next)
---

# Project Plan

## Milestone A — Demo on Render (current)
- Backend: SSE `POST /chat`, background Memory Keeper, `/events`, `/healthz`
- Streaming from Collaborator; memory updates async
- Anthropic SDK integration, timeouts/retries, basic rate limiting
- In-memory persistence; structured logging
- Render deployment: Web Service, `node server.js`, env vars

## Milestone B — Hardening
- Postgres for conversations/messages/memories
- BullMQ/Redis for durable background jobs
- Auth (basic session/JWT)
- Metrics dashboard (TTFB, tokens/sec, error rates)

## Milestone C — Frontend modernization
- Migrate to Next.js (optional)
- Use Vercel AI SDK or native SSE consumption hooks
- Componentize memory panels and chat stream

## Milestone D — Agentic expansion
- Tool catalog; planner/supervisor
- Additional agents (retrieval, enrichment)
- Long-running tasks via workers

## Environment Variables (demo)
```
ANTHROPIC_API_KEY=
PORT=3000
NODE_ENV=production
CORS_ORIGIN=http://localhost:8080  # example
```

## Risks
- LLM latency variance → streaming mitigates
- Provider limits → rate limits + idempotency keys
- Infra drift → IaC later (render.yaml)
