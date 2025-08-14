---
description: API Specification (Demo)
---

# API

## Auth
- Demo: none. Add user/session later.

## Headers (general)
- Content-Type: application/json (requests)
- SSE responses: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive

## POST /chat (SSE response)
Request JSON:
```json
{
  "conversationId": "string",
  "messageId": "string",
  "text": "user input",
  "userId": "optional"
}
```
SSE Events (examples):
```
event: token
data: {"text":"Hello"}

event: token
data: {"text":" there"}

event: done
data: {"messageId":"..."}
```
Errors:
- HTTP 400 invalid input
- HTTP 500 upstream/timeout

## GET /events?conversationId=ID (SSE)
Streams memory updates for a conversation.

Events:
```
event: memory
data: {"messageId":"...","entities":[...],"dates":[...],"places":[...],"tags":[...]}
```

## GET /healthz
- 200 OK, body: { status: "ok" }

## Error format (JSON)
```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

## Rate limiting (demo)
- Basic per-IP/per-session throttle; respond 429 with retry-after
