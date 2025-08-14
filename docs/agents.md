---
description: Agents and Tools (Collaborator + Memory Keeper)
---

# Agents

## Collaborator (single agent)
- Role: empathetic conversational guide
- Behaviors:
  - Stream tokens immediately to client
  - Decide when to call `memory_extractor` tool based on user content
  - Keep responses concise and friendly for elderly users
- Model: Claude 3.5 (Haiku/Sonnet based on perf)

## Tool: memory_extractor
- Purpose: extract structured memory objects from the latest user/assistant turns
- Invocation: tool call from Collaborator or background invocation in parallel
- Output schema (example):
```json
{
  "entities": [{"name":"John","relation":"brother"}],
  "dates": [{"text":"in 1972","iso":"1972-01-01"}],
  "places": [{"name":"Queens, NY","type":"city"}],
  "events": [{"title":"wedding","year":1972}],
  "tags": ["family","wedding"]
}
```
- Validation: server validates outputs; non-conforming results are discarded/retried

## Prompts (locations)
- Collaborator system prompt: `server.js` (to be factored later)
- Tool instruction prompt: `server.js` (schema + examples)

## Persistence
- Demo: in-memory store by `conversationId` and `messageId`
- Future: Postgres (messages, memories tables)

## Evolution path
- Add planner/supervisor to schedule tools and other agents
- Introduce queues (BullMQ/Redis) and durable workers
- Capture traces/telemetry for decisions and results
